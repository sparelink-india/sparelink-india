import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  part,
  partCategory,
  dealer,
  firm,
  dealerListing,
  inventory,
} from "@/drizzle/schema";
import {
  parseCSV,
  parseExcel,
  normalizeHeader,
  createHeaderMap,
  detectImportType,
  parseImportRows,
  validateProductRow,
  validateListingRow,
  generatePreview,
  type ValidationContext,
  type ParsedImportData,
  type ImportRow,
} from "@/lib/import-utils";
import { typesense } from "@/lib/typesense";

// Store previews in memory (in production, use a cache like Redis)
const previewCache = new Map<string, ParsedImportData>();

async function getValidationContext(): Promise<ValidationContext> {
  const db = getDb();

  const [parts, categories, dealers, firms, skus] = await Promise.all([
    db.select({ partNumber: part.partNumber }).from(part),
    db.select({ name: partCategory.name, id: partCategory.id }).from(partCategory),
    db.select({ businessName: dealer.businessName, id: dealer.id }).from(dealer),
    db.select({ name: firm.name, id: firm.id }).from(firm),
    db
      .select({ sku: dealerListing.sku })
      .from(dealerListing),
  ]);

  const existingPartNumbers = new Set(
    parts.map((p) => p.partNumber),
  );
  const existingSKUs = new Set(
    skus
      .map((s) => s.sku)
      .filter((s): s is string => Boolean(s)),
  );
  const existingFirmNames = new Set(firms.map((f) => f.name));
  const existingDealerNames = new Set(dealers.map((d) => d.businessName));
  const existingCategories = new Set(categories.map((c) => c.name));

  const firmNameToId = new Map(firms.map((f) => [f.name, f.id]));
  const dealerNameToId = new Map(dealers.map((d) => [d.businessName, d.id]));
  const categoryNameToId = new Map(categories.map((c) => [c.name, c.id]));

  return {
    existingPartNumbers,
    existingSKUs,
    existingFirmNames,
    existingDealerNames,
    existingCategories,
    firmNameToId,
    dealerNameToId,
    categoryNameToId,
  };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const action = formData.get("action") as string || "preview";
    const previewId = formData.get("previewId") as string || "";

    if (!file && action === "preview") {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 },
      );
    }

    // PREVIEW PHASE
    if (action === "preview") {
      const buffer = Buffer.from(await file!.arrayBuffer());
      const fileName = file!.name.toLowerCase();

      let data: string[][];
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        data = await parseExcel(buffer);
      } else if (fileName.endsWith(".csv")) {
        data = parseCSV(buffer.toString("utf-8"));
      } else {
        return NextResponse.json(
          { error: "File must be CSV or Excel (.xlsx/.xls)" },
          { status: 400 },
        );
      }

      if (data.length < 2) {
        return NextResponse.json(
          { error: "File must have at least header and one data row" },
          { status: 400 },
        );
      }

      const headers = data[0].map((h) => String(h || "").trim());
      const headerMap = createHeaderMap(headers);

      if (headerMap.size === 0) {
        return NextResponse.json(
          { error: "No valid columns detected in file" },
          { status: 400 },
        );
      }

      const importType = detectImportType(headers);
      if (importType === "unknown") {
        return NextResponse.json(
          { error: "Could not detect import type. Missing required columns." },
          { status: 400 },
        );
      }

      // Parse rows
      let rows = parseImportRows(data, headerMap);

      // Validate context
      const context = await getValidationContext();

      // Validate each row
      if (importType === "product") {
        rows.forEach((row) => validateProductRow(row, context));
      } else {
        rows.forEach((row) => validateListingRow(row, context));
      }

      // Generate preview
      const preview = generatePreview(rows);
      const id = randomUUID();
      previewCache.set(id, preview);

      // Auto-cleanup after 30 minutes
      setTimeout(() => previewCache.delete(id), 30 * 60 * 1000);

      return NextResponse.json({
        previewId: id,
        importType,
        preview: {
          totalRows: preview.totalRows,
          validRows: preview.validRows,
          invalidRows: preview.invalidRows,
          columnHeaders: preview.columnHeaders,
          sampleRows: preview.rows.slice(0, 5).map((r) => ({
            rowNumber: r.rowNumber,
            isValid: r.isValid,
            errors: r.errors,
          })),
        },
      });
    }

    // CONFIRM PHASE
    if (action === "confirm") {
      if (!previewId) {
        return NextResponse.json(
          { error: "previewId is required" },
          { status: 400 },
        );
      }

      const preview = previewCache.get(previewId);
      if (!preview) {
        return NextResponse.json(
          { error: "Preview expired or not found" },
          { status: 400 },
        );
      }

      const validRows = preview.rows.filter((r) => r.isValid);
      if (validRows.length === 0) {
        return NextResponse.json(
          { error: "No valid rows to import" },
          { status: 400 },
        );
      }

      const db = getDb();
      const context = await getValidationContext();

      try {
        let importedCount = 0;
        let indexedCount = 0;

        // Execute import in transaction
        await db.transaction(async (tx) => {
          const docs: any[] = [];

          // Assuming product import for now (can be extended for listings)
          for (const row of validRows) {
            const data = row.data;

            // Check if part already exists by partNumber
            const existing = await tx
              .select({ id: part.id })
              .from(part)
              .where(eq(part.partNumber, data.part_number!))
              .limit(1);

            let partId: string;

            if (existing.length > 0) {
              // Update existing part
              partId = existing[0].id;
              const categoryId = data.category
                ? context.categoryNameToId.get(data.category)
                : undefined;

              await tx
                .update(part)
                .set({
                  name: data.part_name!,
                  description: data.description,
                  brand: data.brand,
                  categoryId,
                  updatedAt: new Date(),
                })
                .where(eq(part.id, partId));
            } else {
              // Create new part
              partId = randomUUID();
              const categoryId = data.category
                ? context.categoryNameToId.get(data.category)
                : undefined;

              await tx.insert(part).values({
                id: partId,
                partNumber: data.part_number!,
                name: data.part_name!,
                description: data.description,
                brand: data.brand,
                categoryId,
              });
            }

            // Prepare for Typesense indexing
            docs.push({
              id: partId,
              part_number: data.part_number!,
              name: data.part_name!,
              description: data.description || "",
              brand: data.brand || "",
              category: data.category || "",
              vehicle_ids: [],
            });

            importedCount++;
          }

          // Re-index in Typesense
          if (typesense && docs.length > 0) {
            try {
              await typesense
                .collections("parts")
                .documents()
                .import(docs, { action: "upsert" });
              indexedCount = docs.length;
            } catch (indexError) {
              console.error("Typesense indexing error:", indexError);
              // Don't fail the import if Typesense fails
            }
          }
        });

        // Clean up cache
        previewCache.delete(previewId);

        return NextResponse.json({
          success: true,
          message: `Import completed: ${importedCount} records processed, ${indexedCount} indexed`,
          importedCount,
          indexedCount,
        });
      } catch (error) {
        console.error("Import error:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Import failed. Transaction rolled back.",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Import processing error:", error);
    return NextResponse.json(
      {
        error: "Failed to process import",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
