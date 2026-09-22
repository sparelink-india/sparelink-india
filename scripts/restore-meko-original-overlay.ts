import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ORIGINAL_JSON = path.join("catalogue-source", "MEKO", "extracted.json");
const REPORT_PATH = path.join("data", "meko-catalogue-archive", "overlay-restore-report.json");
const INDEX_PATH = path.join("data", "catalogue-image-index.json");
const IMAGE_DIRS = [
  path.join("data", "source-catalogue", "images"),
  path.join("data", "catalogue-image-store"),
];

function parseSpec(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function skuKey(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function importKey(partNumber: string): string {
  const slug =
    partNumber
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "item";
  return `MEKO-${slug}`.toUpperCase().slice(0, 96);
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing MEKO overlay restore against production DB target.");
  }
  const original = JSON.parse(readFileSync(ORIGINAL_JSON, "utf8")) as {
    products: Array<{
      cataloguePartNumber: string;
      application: string;
      category: string;
      referenceNo: string;
      sourcePdf: string;
      sourcePage: number;
      mrp: number | null;
    }>;
  };
  const byPn = new Map(original.products.map((row) => [row.cataloguePartNumber.toLowerCase(), row]));
  if (byPn.size !== 89) throw new Error(`Expected 89 original identities, found ${byPn.size}`);

  const { getDb } = await import("../lib/db");
  const { part, partCategory } = await import("../drizzle/schema");
  const { sql, eq } = await import("drizzle-orm");
  const { typesense } = await import("../lib/typesense");
  const db = getDb();

  const rows = await db.select().from(part).where(sql`lower(${part.brand}) = 'meko'`);
  if (rows.length !== 89) throw new Error(`Expected 89 live MEKO parts, found ${rows.length}`);
  const cats = await db.select({ id: partCategory.id, name: partCategory.name }).from(partCategory);
  const catName = new Map(cats.map((row) => [row.id, row.name]));

  let restored = 0;
  const typesenseDocs: Array<{
    id: string;
    part_number: string;
    name: string;
    description: string;
    brand: string;
    category: string;
    vehicle_ids: string[];
  }> = [];
  const overlayKeys = [
    "source_url",
    "official_image_url",
    "catalogue_image",
    "subcategory",
    "vehicle_groups",
    "gst",
    "hsn",
    "tax_mapping_status",
    "tax_mapping_reason",
    "tax_master_categories",
    "tax_mapping_source",
  ];

  for (const row of rows) {
    const source = byPn.get(row.partNumber.toLowerCase());
    if (!source) throw new Error(`Live MEKO part ${row.partNumber} is not in the original 89 extract.`);
    const previous = parseSpec(row.specifications);
    const description = [
      "MEKO Genuine Spares photo catalogue",
      source.category,
      source.application,
      source.referenceNo ? `Reference ${source.referenceNo}` : "",
      `PDF page ${source.sourcePage}`,
    ]
      .filter(Boolean)
      .join(" | ");
    const spec: Record<string, unknown> = {
      manufacturer: "MEKO",
      source: "MEKO Genuine Spares 36-page photo catalogue PDF",
      source_pdf: source.sourcePdf,
      source_page: source.sourcePage,
      application: source.application,
      reference_no: source.referenceNo || previous.reference_no || null,
      source_mrp: source.mrp,
      fulfilled_by: "India Sales",
      internal_import_key: previous.internal_import_key || importKey(row.partNumber),
      selling_price: null,
    };
    for (const key of overlayKeys) delete spec[key];
    const name = `${source.application} (${source.cataloguePartNumber})`;
    await db
      .update(part)
      .set({
        name,
        description,
        oemNumber: source.referenceNo || null,
        specifications: JSON.stringify(spec),
      })
      .where(eq(part.id, row.id));
    restored += 1;
    typesenseDocs.push({
      id: row.id,
      part_number: row.partNumber,
      name,
      description,
      brand: "MEKO",
      category: (row.categoryId && catName.get(row.categoryId)) || source.category,
      vehicle_ids: [],
    });
  }

  let typesenseUpserted = 0;
  if (typesense) {
    for (let i = 0; i < typesenseDocs.length; i += 40) {
      const group = typesenseDocs.slice(i, i + 40);
      await typesense.collections("parts").documents().import(group, { action: "upsert" });
      typesenseUpserted += group.length;
    }
  }

  const remainingParts = await db.select({ partNumber: part.partNumber, brand: part.brand }).from(part);
  const remainingKeys = new Set(
    remainingParts
      .filter((row) => (row.brand || "").toLowerCase() !== "meko")
      .map((row) => skuKey(row.partNumber)),
  );
  const mekoKeys = new Set(rows.map((row) => skuKey(row.partNumber)));
  const index = existsSync(INDEX_PATH)
    ? (JSON.parse(readFileSync(INDEX_PATH, "utf8")) as Record<string, string>)
    : {};
  const removedIndexKeys: string[] = [];
  const archivedImages: string[] = [];
  const skippedShared: string[] = [];
  mkdirSync(path.join("data", "meko-catalogue-archive", "images"), { recursive: true });
  for (const key of Object.keys(index)) {
    if (!mekoKeys.has(key) && !/^unmapped-p\d+/i.test(key)) continue;
    if (remainingKeys.has(key)) {
      skippedShared.push(key);
      continue;
    }
    const ext = index[key];
    removedIndexKeys.push(key);
    delete index[key];
    for (const dir of IMAGE_DIRS) {
      const file = path.join(dir, `${key}${ext}`);
      if (!existsSync(file)) continue;
      copyFileSync(file, path.join("data", "meko-catalogue-archive", "images", path.basename(file)));
      rmSync(file);
      archivedImages.push(file);
    }
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(index)}\n`);

  const after = await db.select({ specifications: part.specifications, description: part.description }).from(part).where(sql`lower(${part.brand}) = 'meko'`);
  const websiteLeft = after.filter((row) => /mekoautoindia/i.test(row.specifications || "") || /GST:/i.test(row.description || "")).length;
  const gstLeft = after.filter((row) => parseSpec(row.specifications).gst != null).length;

  const report = {
    restoredParts: restored,
    typesenseUpserted,
    removedIndexKeys: removedIndexKeys.length,
    archivedImages: archivedImages.length,
    skippedSharedImages: skippedShared,
    websiteOrGstOverlayRemaining: websiteLeft,
    gstSpecRemaining: gstLeft,
    pdfPreserved: existsSync(path.join("catalogue-source", "MEKO", "MEKO Genuine Spares 36-page.pdf")),
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
