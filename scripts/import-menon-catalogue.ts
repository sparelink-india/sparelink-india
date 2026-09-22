import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import XLSX from "xlsx";

const EXTRACT_JSON = path.join("data", "menon-brakes-catalogue", "extracted.json");
const REPORT_PATH = path.join("data", "menon-brakes-catalogue", "import-run-report.json");
const VALIDATION_PATH = path.join("data", "menon-brakes-catalogue", "xlsx-revalidation.json");
const HCV_XLSX = path.join("data", "menon-brakes-catalogue", "source", "REGULAR HCV.xlsx");
const LCV_XLSX = path.join("data", "menon-brakes-catalogue", "source", "REGULAR LCV.xlsx");
const FIRM_NAME = "Hind Motors";
const DEALER_CANDIDATES = ["dealer-test-001", "dealer-001"];
const BRAND = "Menon Brakes";
const MANUFACTURER = "MENON BRAKES LIMITED";
const CATEGORY_NAME = "Brake Linings";

type ExtractedProduct = {
  manufacturer: string;
  brand: string;
  listTitle: string;
  listKind: "HCV" | "LCV";
  sourcePdf: string;
  sourceXlsx: string;
  sourceRow: number;
  section: string;
  application: string;
  cataloguePartNumber: string;
  referenceNo: string;
  size: string;
  pcsPerSet: number | null;
  mrp: number | null;
  priceToDistributors: number | null;
  sellingPrice: number | null;
  stock: number;
  gst: number | null;
  firm: string | null;
  validationStatus: string;
  reviewReasons: string[];
  notes?: string;
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "item"
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function rupeesToPaise(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function parseSpec(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function importKey(partNumber: string): string {
  return `MENON-${slugify(partNumber)}`.toUpperCase().slice(0, 96);
}

function cellText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cellNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function readSheetRows(file: string, sheetName?: string): unknown[][] {
  const wb = XLSX.readFile(file);
  const name = sheetName || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
}

function revalidateAgainstXlsx(products: ExtractedProduct[]) {
  const mismatches: Array<Record<string, unknown>> = [];
  const missingFiles: string[] = [];
  const byKind: Record<string, unknown[][]> = {};
  if (!existsSync(HCV_XLSX)) missingFiles.push(HCV_XLSX);
  else byKind.HCV = readSheetRows(HCV_XLSX, "Table 1");
  if (!existsSync(LCV_XLSX)) missingFiles.push(LCV_XLSX);
  else byKind.LCV = readSheetRows(LCV_XLSX, "Table 1");

  for (const product of products) {
    const sheet = byKind[product.listKind];
    if (!sheet) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        reason: "source_xlsx_missing",
        listKind: product.listKind,
      });
      continue;
    }
    const excelRow = sheet[product.sourceRow - 1];
    if (!excelRow) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        reason: "source_row_missing",
        sourceRow: product.sourceRow,
      });
      continue;
    }
    const reference = cellText(excelRow[1]);
    const size = cellText(excelRow[2]);
    const pcs = cellNumber(excelRow[3]);
    const mrp = cellNumber(excelRow[4]);
    const dist = cellNumber(excelRow[5]);
    if (reference && reference !== product.referenceNo && !/^reference no/i.test(reference)) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        field: "referenceNo",
        expected: product.referenceNo,
        actual: reference,
      });
    }
    if (size !== product.size) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        field: "size",
        expected: product.size,
        actual: size,
      });
    }
    if (pcs != null && pcs !== product.pcsPerSet) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        field: "pcsPerSet",
        expected: product.pcsPerSet,
        actual: pcs,
      });
    }
    if (mrp !== product.mrp) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        field: "mrp",
        expected: product.mrp,
        actual: mrp,
      });
    }
    if (dist !== product.priceToDistributors) {
      mismatches.push({
        cataloguePartNumber: product.cataloguePartNumber,
        field: "priceToDistributors",
        expected: product.priceToDistributors,
        actual: dist,
      });
    }
  }

  const report = {
    products: products.length,
    missingFiles,
    mismatches: mismatches.length,
    mismatchSample: mismatches.slice(0, 20),
  };
  writeFileSync(VALIDATION_PATH, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing Menon import against production DB target.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!existsSync(EXTRACT_JSON)) throw new Error("extracted.json is missing.");

  const extracted = JSON.parse(readFileSync(EXTRACT_JSON, "utf8")) as {
    products: ExtractedProduct[];
  };
  const products = extracted.products || [];
  if (products.length !== 113) {
    throw new Error(`Expected 113 extracted Menon rows, found ${products.length}.`);
  }

  const validation = revalidateAgainstXlsx(products);
  if (validation.missingFiles.length) {
    throw new Error(`Menon source XLSX missing: ${validation.missingFiles.join(", ")}`);
  }
  if (validation.mismatches) {
    throw new Error(
      `Menon XLSX revalidation failed: ${validation.mismatches} field mismatches. See ${VALIDATION_PATH}`,
    );
  }

  const { getDb } = await import("../lib/db");
  const { part, partCategory, dealer, dealerListing, inventory, firm } = await import("../drizzle/schema");
  const { count, inArray, sql } = await import("drizzle-orm");
  const db = getDb();

  const firms = await db.select({ id: firm.id, name: firm.name, code: firm.code }).from(firm);
  const hind = firms.find((row) => row.name === FIRM_NAME);
  if (!hind) throw new Error("Hind Motors firm not found. Refusing to create a new firm.");

  const dealers = await db.select({ id: dealer.id, businessName: dealer.businessName }).from(dealer);
  const dealerRow = dealers.find((row) => DEALER_CANDIDATES.includes(row.id)) || dealers[0];
  if (!dealerRow) throw new Error("No dealer exists for listing.dealer_id.");

  const existingParts = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      brand: part.brand,
      specifications: part.specifications,
    })
    .from(part);
  const existingByNumber = new Map(existingParts.map((row) => [row.partNumber, row]));
  const existingByImportKey = new Map(
    existingParts.map((row) => [parseSpec(row.specifications).internal_import_key, row]),
  );

  const [partsTotalBefore] = await db.select({ n: count() }).from(part);
  const [listingsTotalBefore] = await db.select({ n: count() }).from(dealerListing);
  const [inventoryTotalBefore] = await db.select({ n: count() }).from(inventory);

  const classified = [];
  const seenPart = new Set<string>();
  for (const product of products) {
    const pn = String(product.cataloguePartNumber || "").trim();
    const application = String(product.application || "").trim();
    const row = {
      ...product,
      cataloguePartNumber: pn,
      importKey: importKey(pn),
      classification: "READY" as "READY" | "REVIEW" | "DUPLICATE" | "CONFLICT",
      reason: "valid_source_identity",
    };
    if (!pn || !application) {
      row.classification = "REVIEW";
      row.reason = "missing_identity";
      classified.push(row);
      continue;
    }
    if (product.sellingPrice != null) {
      row.classification = "REVIEW";
      row.reason = "unexpected_selling_price_in_source_extract";
      classified.push(row);
      continue;
    }
    if (seenPart.has(pn.toLowerCase())) {
      row.classification = "DUPLICATE";
      row.reason = "duplicate_part_number_in_extract";
      classified.push(row);
      continue;
    }
    seenPart.add(pn.toLowerCase());
    const existing = existingByNumber.get(pn) || existingByImportKey.get(row.importKey);
    if (existing) {
      const brand = (existing.brand || "").toLowerCase();
      if (brand && brand !== "menon" && brand !== "menon brakes") {
        row.classification = "CONFLICT";
        row.reason = "part_number_owned_by_non_menon_part";
        classified.push(row);
        continue;
      }
      row.classification = "DUPLICATE";
      row.reason = "existing_part_number";
      classified.push(row);
      continue;
    }
    classified.push(row);
  }

  const ready = classified.filter((row) => row.classification === "READY");
  const duplicates = classified.filter((row) => row.classification === "DUPLICATE");
  const conflicts = classified.filter((row) => row.classification === "CONFLICT");
  const reviews = classified.filter((row) => row.classification === "REVIEW");
  if (conflicts.length) {
    throw new Error(`Refusing Menon import: ${conflicts.length} identity conflicts.`);
  }

  const existingCategories = await db
    .select({ id: partCategory.id, name: partCategory.name, slug: partCategory.slug })
    .from(partCategory);
  let category = existingCategories.find(
    (row) => row.name === CATEGORY_NAME || row.slug === "brake-linings",
  );
  if (!category) {
    const usedIds = new Set(existingCategories.map((row) => row.id));
    const usedSlugs = new Set(existingCategories.map((row) => row.slug));
    let id = "cat-menon-brake-linings";
    let slug = "brake-linings";
    let n = 2;
    while (usedIds.has(id)) {
      id = `cat-menon-brake-linings-${n}`;
      n += 1;
    }
    n = 2;
    while (usedSlugs.has(slug)) {
      slug = `brake-linings-${n}`;
      n += 1;
    }
    await db.insert(partCategory).values({
      id,
      name: CATEGORY_NAME,
      slug,
      description: "Asbestos-free brake linings, brake shoes and brake pads from Menon Brakes source lists.",
    });
    category = { id, name: CATEGORY_NAME, slug };
  }

  let insertedParts = 0;
  let insertedListings = 0;
  let insertedInventory = 0;
  const rowErrors: Array<{ partNumber: string; error: string }> = [];
  const typesenseDocs: Array<{
    id: string;
    part_number: string;
    name: string;
    description: string;
    brand: string;
    category: string;
    vehicle_ids: string[];
  }> = [];

  for (const group of chunk(ready, 20)) {
    const partRows: Array<{
      id: string;
      partNumber: string;
      name: string;
      description: string;
      brand: string;
      categoryId: string;
      oemNumber: string | null;
      barcode: null;
      specifications: string;
      slug: string;
      isPublished: boolean;
    }> = [];
    const listingRows: Array<{
      id: string;
      dealerId: string;
      firmId: string;
      partId: string;
      sku: string;
      pricePaise: number;
      mrpPaise: number | null;
      status: "active";
    }> = [];
    const inventoryRows: Array<{
      id: string;
      dealerListingId: string;
      quantity: number;
      reservedQuantity: number;
      warehouseCode: string;
    }> = [];
    for (const row of group) {
      const key = row.importKey;
      const partId = `part-${key.toLowerCase()}`;
      const listingId = `listing-hin-${key.toLowerCase()}`;
      const inventoryId = `inv-hin-${key.toLowerCase()}`;
      const name = `${row.application} (${row.cataloguePartNumber})`;
      const description = [
        row.listTitle,
        row.section,
        row.application,
        `Reference ${row.referenceNo}`,
        row.size ? `Size ${row.size}` : "",
        row.pcsPerSet != null ? `${row.pcsPerSet} pcs per set` : "",
        row.listKind,
      ]
        .filter(Boolean)
        .join(" | ");
      const spec = {
        manufacturer: MANUFACTURER,
        source: "Menon Brakes Regular Grade price list (companion XLSX to HCV/LCV PDFs)",
        source_pdf: row.sourcePdf,
        source_xlsx: row.sourceXlsx,
        source_row: row.sourceRow,
        list_kind: row.listKind,
        list_title: row.listTitle,
        section: row.section,
        application: row.application,
        reference_no: row.referenceNo,
        size: row.size,
        pcs_per_set: row.pcsPerSet,
        price_to_distributors: row.priceToDistributors,
        source_mrp: row.mrp,
        fulfilled_by: FIRM_NAME,
        internal_import_key: key,
        selling_price: null,
      };
      partRows.push({
        id: partId,
        partNumber: row.cataloguePartNumber,
        name,
        description,
        brand: BRAND,
        categoryId: category.id,
        oemNumber: row.referenceNo || null,
        barcode: null,
        specifications: JSON.stringify(spec),
        slug: key.toLowerCase(),
        isPublished: true,
      });
      listingRows.push({
        id: listingId,
        dealerId: dealerRow.id,
        firmId: hind.id,
        partId,
        sku: row.cataloguePartNumber,
        pricePaise: 0,
        mrpPaise: rupeesToPaise(row.mrp),
        status: "active" as const,
      });
      inventoryRows.push({
        id: inventoryId,
        dealerListingId: listingId,
        quantity: 0,
        reservedQuantity: 0,
        warehouseCode: "MAIN",
      });
      typesenseDocs.push({
        id: partId,
        part_number: row.cataloguePartNumber,
        name,
        description,
        brand: BRAND,
        category: CATEGORY_NAME,
        vehicle_ids: [],
      });
    }
    try {
      await db.transaction(async (tx) => {
        await tx.insert(part).values(partRows);
        await tx.insert(dealerListing).values(listingRows);
        await tx.insert(inventory).values(inventoryRows);
      });
      insertedParts += partRows.length;
      insertedListings += listingRows.length;
      insertedInventory += inventoryRows.length;
    } catch (error) {
      rowErrors.push({
        partNumber: group.map((row) => row.cataloguePartNumber).join(" | "),
        error: error instanceof Error ? error.message : "insert failed",
      });
    }
    process.stdout.write(`imported ${insertedParts}/${ready.length}\n`);
  }

  if (!typesenseDocs.length) {
    const existingMenon = await db
      .select({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        description: part.description,
        brand: part.brand,
        categoryId: part.categoryId,
      })
      .from(part)
      .where(sql`lower(${part.brand}) like '%menon%'`);
    const cats = await db.select({ id: partCategory.id, name: partCategory.name }).from(partCategory);
    const catName = new Map(cats.map((row) => [row.id, row.name]));
    for (const row of existingMenon) {
      typesenseDocs.push({
        id: row.id,
        part_number: row.partNumber,
        name: row.name,
        description: row.description || "",
        brand: row.brand || BRAND,
        category: (row.categoryId && catName.get(row.categoryId)) || CATEGORY_NAME,
        vehicle_ids: [],
      });
    }
  }

  let typesenseIndexed = 0;
  let typesenseError: string | null = null;
  let typesenseBefore: number | null = null;
  let typesenseAfter: number | null = null;
  let typesenseMenon = 0;
  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY) {
    typesenseError = "Typesense env not configured.";
  } else {
    const Typesense = (await import("typesense")).default;
    const client = new Typesense.Client({
      nodes: [
        {
          host: process.env.TYPESENSE_HOST,
          port: Number(process.env.TYPESENSE_PORT ?? 443),
          protocol: process.env.TYPESENSE_PROTOCOL ?? "https",
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY,
      connectionTimeoutSeconds: 60,
    });
    try {
      const before = await client.collections("parts").retrieve();
      typesenseBefore = Number(before.num_documents ?? 0);
      for (const group of chunk(typesenseDocs, 80)) {
        await client.collections("parts").documents().import(group, { action: "upsert" });
        typesenseIndexed += group.length;
      }
      const after = await client.collections("parts").retrieve();
      typesenseAfter = Number(after.num_documents ?? 0);
      const menon = await client.collections("parts").documents().search({
        q: "Menon",
        query_by: "brand,name,part_number,description",
        per_page: 1,
      });
      typesenseMenon = Number(menon.found || 0);
    } catch (error) {
      typesenseError = error instanceof Error ? error.message : "Typesense error";
    }
  }

  const menonParts = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
    })
    .from(part)
    .where(sql`lower(${part.brand}) like '%menon%'`);
  const menonPartIds = menonParts.map((row) => row.id);
  const menonListings = menonPartIds.length
    ? await db
        .select({
          id: dealerListing.id,
          partId: dealerListing.partId,
          firmId: dealerListing.firmId,
          pricePaise: dealerListing.pricePaise,
          mrpPaise: dealerListing.mrpPaise,
        })
        .from(dealerListing)
        .where(inArray(dealerListing.partId, menonPartIds))
    : [];
  const listingIds = menonListings.map((row) => row.id);
  const stockRows = listingIds.length
    ? await db
        .select({
          dealerListingId: inventory.dealerListingId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(inArray(inventory.dealerListingId, listingIds))
    : [];
  const [partsTotalAfter] = await db.select({ n: count() }).from(part);
  const [listingsTotalAfter] = await db.select({ n: count() }).from(dealerListing);
  const [inventoryTotalAfter] = await db.select({ n: count() }).from(inventory);
  const numberCounts = new Map<string, number>();
  for (const row of menonParts) {
    numberCounts.set(row.partNumber, (numberCounts.get(row.partNumber) || 0) + 1);
  }

  const report = {
    productionChanged: false,
    deployed: false,
    migrations: false,
    xlsxRevalidation: validation,
    firm: hind,
    dealerUsed: { id: dealerRow.id, businessName: dealerRow.businessName },
    rowsAudited: products.length,
    READY: ready.length,
    DUPLICATE: duplicates.length,
    CONFLICT: conflicts.length,
    REVIEW: reviews.length,
    insertedParts,
    insertedListings,
    insertedInventory,
    rowErrors,
    sellingPriceInvented: 0,
    distributorPriceUsedAsSelling: false,
    stockInvented: 0,
    imagesInvented: 0,
    before: {
      parts: Number(partsTotalBefore.n),
      listings: Number(listingsTotalBefore.n),
      inventory: Number(inventoryTotalBefore.n),
    },
    after: {
      parts: Number(partsTotalAfter.n),
      listings: Number(listingsTotalAfter.n),
      inventory: Number(inventoryTotalAfter.n),
    },
    menonParts: menonParts.length,
    menonListings: menonListings.length,
    hindMotorsMenonListings: menonListings.filter((row) => row.firmId === hind.id).length,
    duplicatePartNumbers: [...numberCounts.values()].filter((n) => n > 1).length,
    menonStockPositive: stockRows.filter((row) => row.quantity > 0).length,
    menonPriced: menonListings.filter((row) => row.pricePaise > 0).length,
    menonUnpriced: menonListings.filter((row) => row.pricePaise <= 0).length,
    menonWithMrp: menonListings.filter((row) => row.mrpPaise != null && row.mrpPaise > 0).length,
    typesenseIndexed,
    typesenseBefore,
    typesenseAfter,
    typesenseMenon,
    typesenseError,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
