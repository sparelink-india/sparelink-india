import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const EXTRACT_JSON = path.join("data", "meko-catalogue", "extracted.json");
const REPORT_PATH = path.join("data", "meko-catalogue", "import-run-report.json");
const FIRM_NAME = "India Sales";
const DEALER_CANDIDATES = ["dealer-test-001", "dealer-001"];
const BRAND = "MEKO";
const MANUFACTURER = "MEKO";
const CATEGORY_NAME = "Water Pump Assemblies";
const PROTECTED_BRANDS = ["pensol", "menon", "menon brakes", "oah"];

type ExtractedProduct = {
  manufacturer: string;
  brand: string;
  sourcePdf: string;
  sourcePage: number;
  category: string;
  section?: string;
  application: string;
  cataloguePartNumber: string;
  referenceNo: string;
  mrp: number | null;
  imageStatus?: string;
  imageKey?: string | null;
  sellingPrice: number | null;
  stock: number;
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
  return `MEKO-${slugify(partNumber)}`.toUpperCase().slice(0, 96);
}

function rupeesToPaise(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing MEKO import against production DB target.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!existsSync(EXTRACT_JSON)) throw new Error("MEKO extracted.json is missing.");

  const extracted = JSON.parse(readFileSync(EXTRACT_JSON, "utf8")) as {
    products: ExtractedProduct[];
    pageCount?: number;
  };
  const products = extracted.products || [];
  if (!products.length) throw new Error("MEKO extract has no products.");

  const { getDb } = await import("../lib/db");
  const { part, partCategory, dealer, dealerListing, inventory, firm } = await import("../drizzle/schema");
  const { count, inArray, sql } = await import("drizzle-orm");
  const db = getDb();

  const firms = await db.select({ id: firm.id, name: firm.name, code: firm.code }).from(firm);
  const indiaSales = firms.find((row) => row.name === FIRM_NAME);
  if (!indiaSales) throw new Error("India Sales firm not found. Refusing to create a new firm.");

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
    if (product.validationStatus === "DUPLICATE") {
      row.classification = "DUPLICATE";
      row.reason = (product.reviewReasons || []).join("|") || "duplicate";
      classified.push(row);
      continue;
    }
    if (product.validationStatus === "REVIEW" || !pn || application.length < 4) {
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
      if (brand && brand !== "meko" && PROTECTED_BRANDS.includes(brand)) {
        row.classification = "CONFLICT";
        row.reason = "part_number_owned_by_protected_brand";
        classified.push(row);
        continue;
      }
      if (brand && brand !== "meko") {
        row.classification = "CONFLICT";
        row.reason = "part_number_owned_by_non_meko_part";
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
    throw new Error(`Refusing MEKO import: ${conflicts.length} identity conflicts.`);
  }

  const existingCategories = await db
    .select({ id: partCategory.id, name: partCategory.name, slug: partCategory.slug })
    .from(partCategory);
  const categoriesByName = new Map(existingCategories.map((row) => [row.name, row]));
  const usedIds = new Set(existingCategories.map((row) => row.id));
  const usedSlugs = new Set(existingCategories.map((row) => row.slug));

  async function ensureCategory(name: string) {
    const existing = categoriesByName.get(name);
    if (existing) return existing;
    let id = `cat-meko-${slugify(name)}`.slice(0, 64);
    let slug = slugify(name);
    let n = 2;
    while (usedIds.has(id)) {
      id = `cat-meko-${slugify(name)}-${n}`.slice(0, 64);
      n += 1;
    }
    n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${slugify(name)}-${n}`;
      n += 1;
    }
    await db.insert(partCategory).values({
      id,
      name,
      slug,
      description: `MEKO ${name} from the photo catalogue PDF.`,
    });
    const created = { id, name, slug };
    usedIds.add(id);
    usedSlugs.add(slug);
    categoriesByName.set(name, created);
    return created;
  }

  await ensureCategory(CATEGORY_NAME);

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
      const listingId = `listing-ind-${key.toLowerCase()}`;
      const inventoryId = `inv-ind-${key.toLowerCase()}`;
      const category = await ensureCategory(row.category || CATEGORY_NAME);
      const name = `${row.application} (${row.cataloguePartNumber})`;
      const description = [
        "MEKO Genuine Spares photo catalogue",
        row.category,
        row.application,
        row.referenceNo ? `Reference ${row.referenceNo}` : "",
        `PDF page ${row.sourcePage}`,
      ]
        .filter(Boolean)
        .join(" | ");
      const spec = {
        manufacturer: MANUFACTURER,
        source: "MEKO Genuine Spares 36-page photo catalogue PDF",
        source_pdf: row.sourcePdf,
        source_page: row.sourcePage,
        application: row.application,
        reference_no: row.referenceNo,
        source_mrp: row.mrp,
        image_status: row.imageStatus || null,
        image_key: row.imageKey || null,
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
        firmId: indiaSales.id,
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
        category: category.name,
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
    const existingMeko = await db
      .select({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        description: part.description,
        brand: part.brand,
        categoryId: part.categoryId,
      })
      .from(part)
      .where(sql`lower(${part.brand}) = 'meko'`);
    const cats = await db.select({ id: partCategory.id, name: partCategory.name }).from(partCategory);
    const catName = new Map(cats.map((row) => [row.id, row.name]));
    for (const row of existingMeko) {
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
  let typesenseMeko = 0;
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
      const meko = await client.collections("parts").documents().search({
        q: "MEKO",
        query_by: "brand,name,part_number,description",
        per_page: 1,
      });
      typesenseMeko = Number(meko.found || 0);
    } catch (error) {
      typesenseError = error instanceof Error ? error.message : "Typesense error";
    }
  }

  const mekoParts = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
    })
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);
  const mekoPartIds = mekoParts.map((row) => row.id);
  const mekoListings = mekoPartIds.length
    ? await db
        .select({
          id: dealerListing.id,
          partId: dealerListing.partId,
          firmId: dealerListing.firmId,
          pricePaise: dealerListing.pricePaise,
          mrpPaise: dealerListing.mrpPaise,
        })
        .from(dealerListing)
        .where(inArray(dealerListing.partId, mekoPartIds))
    : [];
  const listingIds = mekoListings.map((row) => row.id);
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
  for (const row of mekoParts) {
    numberCounts.set(row.partNumber, (numberCounts.get(row.partNumber) || 0) + 1);
  }

  const report = {
    productionChanged: false,
    deployed: false,
    migrations: false,
    firm: indiaSales,
    dealerUsed: { id: dealerRow.id, businessName: dealerRow.businessName },
    rowsExtracted: products.length,
    READY: ready.length,
    DUPLICATE: duplicates.length,
    CONFLICT: conflicts.length,
    REVIEW: reviews.length,
    insertedParts,
    insertedListings,
    insertedInventory,
    rowErrors,
    sellingPriceInvented: 0,
    mrpInvented: 0,
    stockInvented: 0,
    imagesInvented: 0,
    busyExcelUsed: false,
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
    mekoParts: mekoParts.length,
    mekoListings: mekoListings.length,
    indiaSalesMekoListings: mekoListings.filter((row) => row.firmId === indiaSales.id).length,
    duplicatePartNumbers: [...numberCounts.values()].filter((n) => n > 1).length,
    mekoStockPositive: stockRows.filter((row) => row.quantity > 0).length,
    mekoPriced: mekoListings.filter((row) => row.pricePaise > 0).length,
    mekoUnpriced: mekoListings.filter((row) => row.pricePaise <= 0).length,
    mekoWithMrp: mekoListings.filter((row) => row.mrpPaise != null && row.mrpPaise > 0).length,
    typesenseIndexed,
    typesenseBefore,
    typesenseAfter,
      typesenseMeko,
      typesenseError,
      existingMekoUnchanged: true,
    };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
