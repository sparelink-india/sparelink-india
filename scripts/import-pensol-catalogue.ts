import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const CSV_PATH = path.join("data", "pensol-catalogue", "import-ready.csv");
const JSON_PATH = path.join("data", "pensol-catalogue", "full-catalogue.json");
const MANIFEST_PATH = path.join("data", "pensol-catalogue", "image-manifest.json");
const VALIDATION_PATH = path.join("data", "pensol-catalogue", "validation-report.json");
const PREFLIGHT_PATH = path.join("data", "pensol-catalogue", "import-preflight.json");
const REPORT_PATH = path.join("data", "pensol-catalogue", "import-run-report.json");
const CLASSIFY_PATH = path.join("data", "pensol-catalogue", "duplicate-check.json");
const IMAGE_DEST_DIR = path.join("data", "source-catalogue", "images");
const FIRM_NAME = "Hind Motors";
const DEALER_CANDIDATES = ["dealer-test-001", "dealer-001"];
const BRAND = "Pensol";
const MANUFACTURER = "PENSOL INDUSTRIES LIMITED";
const EXPECTED_COLUMNS = [
  "product_name",
  "brand",
  "manufacturer",
  "fulfilled_by",
  "category",
  "subcategory",
  "product_code",
  "pack_quantity",
  "pack_uom",
  "pack_size",
  "mrp",
  "dlp_price_inclusive_tax",
  "specifications",
  "application",
  "description",
  "source_product_url",
  "source_image_url",
] as const;

type CsvRow = Record<string, string>;

type JsonRow = {
  record_id?: string;
  product_name: string;
  brand?: string;
  manufacturer?: string;
  fulfilled_by?: string;
  category: string;
  subcategory?: string;
  segment?: string;
  product_code?: string;
  pack_quantity?: string;
  pack_uom?: string;
  pack_size?: string;
  specifications?: string;
  application?: string;
  description?: string;
  source_product_url: string;
  source_image_url?: string;
  local_image_path?: string;
  image_status?: string;
  validation_status?: string;
  review_reasons?: string;
};

type WorkRow = JsonRow & {
  importKey: string;
  identityKey: string;
  classification: "READY" | "DUPLICATE" | "CONFLICT" | "REVIEW";
  reason: string;
  existingPartId?: string;
};

function csvCells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      out.push(cur);
      cur = "";
    } else cur += char;
  }
  out.push(cur);
  return out;
}

function parseCsv(file: string): { header: string[]; rows: CsvRow[] } {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((line) => line.length > 0);
  const header = csvCells(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = csvCells(line);
    const row: CsvRow = {};
    header.forEach((key, i) => {
      row[key] = values[i] ?? "";
    });
    return row;
  });
  return { header, rows };
}

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

function parseSpec(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function identityKey(url: string, pack: string): string {
  return `${url.trim().toLowerCase()}|${pack.trim().toLowerCase()}`;
}

function importKey(url: string, pack: string, recordId: string): string {
  const page = slugify(url.replace(/^https?:\/\/pensol\.com\//i, "").replace(/\.html$/i, ""));
  const packSlug = slugify(pack || recordId || "std");
  return `PENSOL-${page}-${packSlug}`.toUpperCase().slice(0, 96);
}

function imageExt(localPath: string, sourceUrl: string): string {
  const fromLocal = path.extname(localPath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromLocal)) return fromLocal;
  try {
    const fromUrl = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromUrl)) return fromUrl;
  } catch {
    /* ignore */
  }
  return ".jpg";
}

function stop(preflight: Record<string, unknown>, message: string): never {
  writeFileSync(PREFLIGHT_PATH, `${JSON.stringify({ ok: false, message, ...preflight }, null, 2)}\n`);
  throw new Error(message);
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing Pensol import against production DB target.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!existsSync(CSV_PATH)) stop({}, "import-ready.csv is missing.");
  if (!existsSync(JSON_PATH)) stop({}, "full-catalogue.json is missing.");
  if (!existsSync(MANIFEST_PATH)) stop({}, "image-manifest.json is missing.");
  if (!existsSync(VALIDATION_PATH)) stop({}, "validation-report.json is missing.");

  const csv = parseCsv(CSV_PATH);
  const jsonRows = JSON.parse(readFileSync(JSON_PATH, "utf8")) as JsonRow[];
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Array<{
    sourceUrl?: string;
    localPath?: string;
    imageStatus?: string;
  }>;
  const validation = JSON.parse(readFileSync(VALIDATION_PATH, "utf8")) as {
    totals?: { totalProductRecords?: number; READY?: number; REVIEW?: number; DUPLICATE?: number; CONFLICT?: number };
  };
  const missingColumns = EXPECTED_COLUMNS.filter((col) => !csv.header.includes(col));
  const csvMrp = csv.rows.filter((row) => String(row.mrp || "").trim()).length;
  const csvDlp = csv.rows.filter((row) => String(row.dlp_price_inclusive_tax || "").trim()).length;
  const csvCodes = csv.rows.filter((row) => String(row.product_code || "").trim()).length;
  const csvBlankPack = csv.rows.filter((row) => !String(row.pack_size || "").trim()).length;
  const jsonByIdentity = new Map(
    jsonRows.map((row) => [identityKey(row.source_product_url, row.pack_size || ""), row]),
  );
  const preflight = {
    csvRows: csv.rows.length,
    jsonRows: jsonRows.length,
    csvHeader: csv.header,
    missingColumns,
    csvMrp,
    csvDlp,
    csvCodes,
    csvBlankPack,
    validationTotals: validation.totals || null,
    uniqueCsvUrls: new Set(csv.rows.map((row) => row.source_product_url)).size,
    uniqueJsonUrls: new Set(jsonRows.map((row) => row.source_product_url)).size,
    manifestEntries: manifest.length,
  };

  if (missingColumns.length) stop(preflight, `import-ready.csv missing columns: ${missingColumns.join(", ")}`);
  if (csv.rows.length !== 286 || jsonRows.length !== 286) {
    stop(preflight, `Row-count discrepancy: csv=${csv.rows.length} json=${jsonRows.length} expected=286`);
  }
  if ((validation.totals?.totalProductRecords ?? 0) !== 286) {
    stop(preflight, `validation-report total ${validation.totals?.totalProductRecords} !== 286`);
  }
  if (csvMrp !== 0 || csvDlp !== 0 || csvCodes !== 0) {
    stop(preflight, "CSV contains MRP/DLP/product_code values; refusing to import invented or unexpected commercial identity.");
  }
  if (csvBlankPack !== 33) {
    stop(preflight, `Blank pack-size count ${csvBlankPack} !== 33 from extraction report.`);
  }
  writeFileSync(PREFLIGHT_PATH, `${JSON.stringify({ ok: true, ...preflight }, null, 2)}\n`);

  const { getDb } = await import("../lib/db");
  const { part, partCategory, dealer, dealerListing, inventory, firm } = await import("../drizzle/schema");
  const { eq, sql } = await import("drizzle-orm");
  const { sanitizeCatalogueImageKey } = await import("../lib/source-catalogue");

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
  const existingListings = await db
    .select({
      id: dealerListing.id,
      partId: dealerListing.partId,
      firmId: dealerListing.firmId,
    })
    .from(dealerListing);
  const existingByNumber = new Map(existingParts.map((row) => [row.partNumber, row]));
  const existingByIdentity = new Map<string, (typeof existingParts)[number]>();
  for (const row of existingParts) {
    const spec = parseSpec(row.specifications);
    const sourceUrl = String(spec.source_url || spec.source_product_url || "").trim();
    const pack = String(spec.pack_size || "").trim();
    if (sourceUrl) existingByIdentity.set(identityKey(sourceUrl, pack), row);
  }

  const beforeParts = existingParts.length;
  const beforeListings = existingListings.length;
  const beforePensol = existingParts.filter((row) => (row.brand || "").toLowerCase() === "pensol").length;
  const beforeHind = existingListings.filter((row) => row.firmId === hind.id).length;
  const beforeImages = existsSync(IMAGE_DEST_DIR)
    ? (await import("fs")).readdirSync(IMAGE_DEST_DIR).filter((name) => name.toLowerCase().startsWith("pensol-")).length
    : 0;

  const classified: WorkRow[] = [];
  const seenIdentity = new Set<string>();
  for (const csvRow of csv.rows) {
    const json = jsonByIdentity.get(identityKey(csvRow.source_product_url, csvRow.pack_size || ""));
    const pack = csvRow.pack_size || "";
    const url = csvRow.source_product_url || "";
    const key = importKey(url, pack, json?.record_id || "");
    const ident = identityKey(url, pack);
    const row: WorkRow = {
      record_id: json?.record_id || "",
      product_name: csvRow.product_name,
      brand: csvRow.brand,
      manufacturer: csvRow.manufacturer,
      fulfilled_by: csvRow.fulfilled_by,
      category: csvRow.category,
      subcategory: csvRow.subcategory,
      segment: json?.segment || "",
      product_code: "",
      pack_quantity: csvRow.pack_quantity,
      pack_uom: csvRow.pack_uom,
      pack_size: pack,
      specifications: csvRow.specifications,
      application: csvRow.application,
      description: csvRow.description,
      source_product_url: url,
      source_image_url: csvRow.source_image_url,
      local_image_path: json?.local_image_path || "",
      image_status: json?.image_status || "",
      validation_status: json?.validation_status || "READY",
      review_reasons: json?.review_reasons || "",
      importKey: key,
      identityKey: ident,
      classification: "READY",
      reason: "new_official_product",
    };
    if (!row.product_name?.trim() || !row.source_product_url?.trim()) {
      row.classification = "REVIEW";
      row.reason = "missing_identity";
      classified.push(row);
      continue;
    }
    if (seenIdentity.has(ident)) {
      row.classification = "DUPLICATE";
      row.reason = "duplicate_identity_in_csv";
      classified.push(row);
      continue;
    }
    seenIdentity.add(ident);
    const existing = existingByIdentity.get(ident) || existingByNumber.get(key);
    if (existing) {
      row.existingPartId = existing.id;
      if (existing.brand && existing.brand.toLowerCase() !== "pensol") {
        row.classification = "CONFLICT";
        row.reason = "identity_owned_by_non_pensol_part";
        classified.push(row);
        continue;
      }
      row.classification = "DUPLICATE";
      row.reason = "existing_source_url_and_pack";
      classified.push(row);
      continue;
    }
    if (row.validation_status === "REVIEW") {
      row.reason = json?.review_reasons || "pack_size_not_stated";
    }
    classified.push(row);
  }

  writeFileSync(CLASSIFY_PATH, `${JSON.stringify(classified, null, 2)}\n`);
  const ready = classified.filter((row) => row.classification === "READY");
  const duplicates = classified.filter((row) => row.classification === "DUPLICATE");
  const conflicts = classified.filter((row) => row.classification === "CONFLICT");
  const reviews = classified.filter((row) => row.classification === "REVIEW");

  const existingCategories = await db
    .select({ id: partCategory.id, name: partCategory.name, slug: partCategory.slug })
    .from(partCategory);
  const categoryByName = new Map(existingCategories.map((row) => [row.name, row]));
  const usedIds = new Set(existingCategories.map((row) => row.id));
  const usedSlugs = new Set(existingCategories.map((row) => row.slug));
  const categoriesToInsert: Array<{ id: string; name: string; slug: string; description: string | null }> = [];
  for (const row of ready) {
    const name = row.category.trim();
    if (!name || categoryByName.has(name) || categoriesToInsert.some((item) => item.name === name)) continue;
    let id = `cat-pensol-${slugify(name)}`;
    let n = 2;
    while (usedIds.has(id)) {
      id = `cat-pensol-${slugify(name)}-${n}`;
      n += 1;
    }
    let slug = slugify(name);
    n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${slugify(name)}-${n}`;
      n += 1;
    }
    usedIds.add(id);
    usedSlugs.add(slug);
    const created = { id, name, slug, description: row.segment || null };
    categoriesToInsert.push(created);
    categoryByName.set(name, created);
  }
  if (categoriesToInsert.length) {
    for (const group of chunk(categoriesToInsert, 40)) {
      await db.insert(partCategory).values(group);
    }
  }
  const latestCats = await db.select({ id: partCategory.id, name: partCategory.name }).from(partCategory);
  const categoryNameToId = new Map(latestCats.map((row) => [row.name, row.id]));

  let insertedParts = 0;
  let insertedListings = 0;
  let insertedInventory = 0;
  let updatedOfficialFields = 0;
  let imagesCopied = 0;
  let imagesSkippedExisting = 0;
  const rowErrors: Array<{ identityKey: string; error: string }> = [];
  const typesenseDocs: Array<{
    id: string;
    part_number: string;
    name: string;
    description: string;
    brand: string;
    category: string;
    vehicle_ids: string[];
  }> = [];

  function officialSpec(row: WorkRow) {
    return {
      manufacturer: MANUFACTURER,
      source: "Pensol Industries Limited / official website",
      source_url: row.source_product_url,
      source_image_url: row.source_image_url || null,
      pack_size: row.pack_size || null,
      pack_quantity: row.pack_quantity || null,
      uom: row.pack_uom || null,
      application: row.application || null,
      segment: row.segment || null,
      subcategory: row.subcategory || null,
      fulfilled_by: FIRM_NAME,
      official_specifications: row.specifications || null,
      official_product_code: null,
      internal_import_key: row.importKey,
    };
  }

  function copyImage(row: WorkRow, destKey: string) {
    if (!row.local_image_path || !existsSync(row.local_image_path)) return;
    const ext = imageExt(row.local_image_path, row.source_image_url || "");
    const dest = path.join(IMAGE_DEST_DIR, `${sanitizeCatalogueImageKey(destKey)}${ext}`);
    if (existsSync(dest)) {
      imagesSkippedExisting += 1;
      return;
    }
    copyFileSync(row.local_image_path, dest);
    imagesCopied += 1;
  }

  for (const row of duplicates) {
    if (!row.existingPartId) continue;
    const existing = existingByNumber.get(row.importKey) || existingParts.find((item) => item.id === row.existingPartId);
    if (!existing) continue;
    const previous = parseSpec(existing.specifications);
    const next = {
      ...previous,
      ...officialSpec(row),
    };
    await db
      .update(part)
      .set({
        name: row.product_name,
        description: row.description || row.product_name,
        brand: BRAND,
        categoryId: categoryNameToId.get(row.category) || null,
        oemNumber: null,
        specifications: JSON.stringify(next),
      })
      .where(eq(part.id, existing.id));
    updatedOfficialFields += 1;
    copyImage(row, existing.partNumber);
  }

  for (const group of chunk(ready, 10)) {
    const partRows: Array<{
      id: string;
      partNumber: string;
      name: string;
      description: string;
      brand: string;
      categoryId: string | null;
      oemNumber: string | null;
      barcode: string | null;
      specifications: string;
      slug: string;
      isPublished: boolean;
    }> = [];
    const listingRows: Array<{
      id: string;
      dealerId: string;
      firmId: string;
      partId: string;
      sku: string | null;
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
      const internalId = row.importKey;
      const partId = `part-${internalId.toLowerCase()}`;
      const listingId = `listing-hin-${internalId.toLowerCase()}`;
      const inventoryId = `inv-hin-${internalId.toLowerCase()}`;
      partRows.push({
        id: partId,
        partNumber: internalId,
        name: row.product_name,
        description: row.description || row.product_name,
        brand: BRAND,
        categoryId: categoryNameToId.get(row.category) || null,
        oemNumber: null,
        barcode: null,
        specifications: JSON.stringify(officialSpec(row)),
        slug: internalId.toLowerCase(),
        isPublished: true,
      });
      listingRows.push({
        id: listingId,
        dealerId: dealerRow.id,
        firmId: hind.id,
        partId,
        sku: null,
        pricePaise: 0,
        mrpPaise: null,
        status: "active",
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
        part_number: internalId,
        name: row.product_name,
        description: [row.description, row.specifications, row.application, row.pack_size, row.segment]
          .filter(Boolean)
          .join(" "),
        brand: BRAND,
        category: row.category || "",
        vehicle_ids: [],
      });
      copyImage(row, internalId);
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
        identityKey: group.map((row) => row.identityKey).join(" | "),
        error: error instanceof Error ? error.message : "insert failed",
      });
    }
    process.stdout.write(`imported ${insertedParts}/${ready.length}\n`);
  }

  let typesenseIndexed = 0;
  let typesenseError: string | null = null;
  let typesenseBefore: number | null = null;
  let typesenseAfter: number | null = null;
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
      const existingPensol = await db
        .select({
          id: part.id,
          partNumber: part.partNumber,
          name: part.name,
          description: part.description,
          brand: part.brand,
          specifications: part.specifications,
          category: partCategory.name,
        })
        .from(part)
        .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
        .where(eq(part.brand, BRAND));
      const seenDocIds = new Set(typesenseDocs.map((doc) => doc.id));
      for (const row of existingPensol) {
        if (seenDocIds.has(row.id)) continue;
        const spec = parseSpec(row.specifications);
        typesenseDocs.push({
          id: row.id,
          part_number: row.partNumber,
          name: row.name,
          description: [row.description, spec.official_specifications, spec.application, spec.pack_size, spec.segment]
            .filter(Boolean)
            .map(String)
            .join(" "),
          brand: row.brand ?? BRAND,
          category: row.category ?? "",
          vehicle_ids: [],
        });
        seenDocIds.add(row.id);
      }
      for (const group of chunk(typesenseDocs, 80)) {
        const result = await client.collections("parts").documents().import(group, { action: "upsert" });
        const failed = Array.isArray(result) ? result.filter((item) => item.success === false) : [];
        if (failed.length) throw new Error(`Typesense upsert failed for ${failed.length} documents.`);
        typesenseIndexed += group.length;
      }
      const after = await client.collections("parts").retrieve();
      typesenseAfter = Number(after.num_documents ?? 0);
    } catch (error) {
      typesenseError = error instanceof Error ? error.message : "Typesense error";
    }
  }

  const afterParts = Number((await db.select({ n: sql<number>`count(*)::int` }).from(part))[0]?.n ?? 0);
  const afterListings = Number((await db.select({ n: sql<number>`count(*)::int` }).from(dealerListing))[0]?.n ?? 0);
  const afterPensol = Number(
    (await db.select({ n: sql<number>`count(*)::int` }).from(part).where(eq(part.brand, BRAND)))[0]?.n ?? 0,
  );
  const afterHind = Number(
    (await db.select({ n: sql<number>`count(*)::int` }).from(dealerListing).where(eq(dealerListing.firmId, hind.id)))[0]
      ?.n ?? 0,
  );
  const [pricedPensol] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dealerListing)
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .where(sql`${part.brand} = 'Pensol' AND ${dealerListing.pricePaise} > 0`);
  const [mrpPensol] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dealerListing)
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .where(sql`${part.brand} = 'Pensol' AND ${dealerListing.mrpPaise} IS NOT NULL`);
  const [oemPensol] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(part)
    .where(sql`${part.brand} = 'Pensol' AND ${part.oemNumber} IS NOT NULL AND ${part.oemNumber} <> ''`);
  const [stockPensol] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inventory)
    .innerJoin(dealerListing, eq(inventory.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .where(sql`${part.brand} = 'Pensol' AND ${inventory.quantity} > 0`);
  const afterImages = existsSync(IMAGE_DEST_DIR)
    ? (await import("fs")).readdirSync(IMAGE_DEST_DIR).filter((name) => name.toLowerCase().startsWith("pensol-")).length
    : 0;

  const report = {
    source: "data/pensol-catalogue/import-ready.csv",
    environment: process.env.SPARELINK_DB_TARGET || "local .env.local catalogue DB",
    productionChanged: false,
    deployed: false,
    firm: { id: hind.id, name: hind.name, code: hind.code },
    dealerUsed: { id: dealerRow.id, businessName: dealerRow.businessName },
    csvRows: csv.rows.length,
    READY: ready.length,
    DUPLICATE: duplicates.length,
    CONFLICT: conflicts.length,
    REVIEW: reviews.length,
    insertedParts,
    insertedListings,
    insertedInventory,
    updatedOfficialFields,
    imagesCopied,
    imagesSkippedExisting,
    rowErrors,
    inventedMrp: 0,
    inventedDlp: 0,
    inventedStock: 0,
    inventedManufacturerSku: 0,
    percentageDiscountAssigned: 0,
    beforeParts,
    afterParts,
    beforeListings,
    afterListings,
    beforePensol,
    afterPensol,
    newPensolProducts: afterPensol - beforePensol,
    beforeHind,
    afterHind,
    pensolPricePositive: Number(pricedPensol.n ?? 0),
    pensolMrpPresent: Number(mrpPensol.n ?? 0),
    pensolOemPresent: Number(oemPensol.n ?? 0),
    pensolStockPositive: Number(stockPensol.n ?? 0),
    beforePensolImages: beforeImages,
    afterPensolImages: afterImages,
    typesenseIndexed,
    typesenseBefore,
    typesenseAfter,
    typesenseError,
    existingRecordsPreserved: afterParts >= beforeParts && afterListings >= beforeListings,
    migrations: false,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
