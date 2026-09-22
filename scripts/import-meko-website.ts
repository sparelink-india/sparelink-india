import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const EXTRACT_JSON = path.join("data", "meko-catalogue", "website-products.json");
const REPORT_PATH = path.join("data", "meko-catalogue", "website-import-report.json");
const CLASSIFY_PATH = path.join("data", "meko-catalogue", "duplicate-check.json");
const FIRM_NAME = "India Sales";
const DEALER_CANDIDATES = ["dealer-test-001", "dealer-001"];
const BRAND = "MEKO";
const MANUFACTURER = "Meko Auto Components Inc.";
const PROTECTED_BRANDS = ["pensol", "menon", "menon brakes", "oah", "ci automotive llp"];

type WebsiteProduct = {
  brand: string;
  manufacturer: string;
  firm: string;
  partNumber: string;
  name: string;
  description: string;
  application: string;
  oem: string;
  category: string;
  subcategory: string;
  vehicleGroups: string[];
  sourceUrl: string;
  officialImageUrl: string;
  imageFile: string;
  mrp: number | null;
  sellingPrice: number | null;
  stock: number;
  status?: string;
  reviewReasons?: string[];
};

type Classified = WebsiteProduct & {
  importKey: string;
  classification: "READY" | "REVIEW" | "DUPLICATE" | "CONFLICT";
  reason: string;
  existingPartId?: string;
  existingPartNumber?: string;
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

function normPn(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9/]+/g, "")
    .trim();
}

function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing MEKO website import against production DB target.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!existsSync(EXTRACT_JSON)) throw new Error("website-products.json is missing. Run extract-meko-website.mjs first.");

  const extracted = JSON.parse(readFileSync(EXTRACT_JSON, "utf8")) as WebsiteProduct[];
  if (!Array.isArray(extracted) || !extracted.length) throw new Error("MEKO website extract is empty.");

  const { getDb } = await import("../lib/db");
  const { part, partCategory, dealer, dealerListing, inventory, firm } = await import("../drizzle/schema");
  const { count, eq, inArray, sql } = await import("drizzle-orm");
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
      description: part.description,
      oemNumber: part.oemNumber,
      alternatePartNumbers: part.alternatePartNumbers,
      categoryId: part.categoryId,
      specifications: part.specifications,
    })
    .from(part);
  const existingByNumber = new Map(existingParts.map((row) => [row.partNumber, row]));
  const existingByNorm = new Map(existingParts.map((row) => [normPn(row.partNumber), row]));
  const existingById = new Map(existingParts.map((row) => [row.id, row]));

  const mekoBefore = existingParts.filter((row) => (row.brand || "").toLowerCase() === "meko");
  const [partsTotalBefore] = await db.select({ n: count() }).from(part);
  const [listingsTotalBefore] = await db.select({ n: count() }).from(dealerListing);
  const [inventoryTotalBefore] = await db.select({ n: count() }).from(inventory);

  const classified: Classified[] = [];
  const seenPart = new Set<string>();
  for (const product of extracted) {
    const pn = String(product.partNumber || "").trim();
    const application = String(product.application || "").trim();
    const row: Classified = {
      ...product,
      partNumber: pn,
      importKey: importKey(pn),
      classification: "READY",
      reason: "valid_official_website_identity",
    };
    if (product.status === "REVIEW" || !pn || !product.sourceUrl || application.length < 3) {
      row.classification = "REVIEW";
      row.reason = product.reviewReasons?.join(",") || "incomplete_product_identity";
      classified.push(row);
      continue;
    }
    if (product.sellingPrice != null) {
      row.classification = "REVIEW";
      row.reason = "unexpected_selling_price_in_website_extract";
      classified.push(row);
      continue;
    }
    if (seenPart.has(normPn(pn))) {
      row.classification = "DUPLICATE";
      row.reason = "duplicate_part_number_in_website_extract";
      classified.push(row);
      continue;
    }
    seenPart.add(normPn(pn));
    const existing =
      existingByNumber.get(pn) ||
      existingByNorm.get(normPn(pn)) ||
      existingById.get(`part-${importKey(pn).toLowerCase()}`);
    if (existing) {
      const brand = (existing.brand || "").toLowerCase();
      if (brand && brand !== "meko" && PROTECTED_BRANDS.includes(brand)) {
        row.classification = "CONFLICT";
        row.reason = "part_number_owned_by_protected_brand";
        row.existingPartId = existing.id;
        row.existingPartNumber = existing.partNumber;
        classified.push(row);
        continue;
      }
      if (brand && brand !== "meko") {
        row.classification = "CONFLICT";
        row.reason = "part_number_owned_by_non_meko_part";
        row.existingPartId = existing.id;
        row.existingPartNumber = existing.partNumber;
        classified.push(row);
        continue;
      }
      row.classification = "DUPLICATE";
      row.reason = "existing_part_number";
      row.existingPartId = existing.id;
      row.existingPartNumber = existing.partNumber;
      classified.push(row);
      continue;
    }
    classified.push(row);
  }

  const ready = classified.filter((row) => row.classification === "READY");
  const duplicates = classified.filter((row) => row.classification === "DUPLICATE");
  const conflicts = classified.filter((row) => row.classification === "CONFLICT");
  const reviews = classified.filter((row) => row.classification === "REVIEW");
  writeFileSync(
    CLASSIFY_PATH,
    `${JSON.stringify(
      {
        READY: ready.length,
        DUPLICATE: duplicates.length,
        CONFLICT: conflicts.length,
        REVIEW: reviews.length,
        conflicts: conflicts.map((row) => ({
          partNumber: row.partNumber,
          existingPartNumber: row.existingPartNumber,
          reason: row.reason,
        })),
      },
      null,
      2,
    )}\n`,
  );
  if (conflicts.length) {
    throw new Error(`Refusing MEKO website import: ${conflicts.length} identity conflicts.`);
  }

  const existingCategories = await db
    .select({ id: partCategory.id, name: partCategory.name, slug: partCategory.slug })
    .from(partCategory);
  const categoryCache = new Map(existingCategories.map((row) => [row.name.toLowerCase(), row] as const));
  async function ensureCategory(name: string) {
    const label = String(name || "").trim();
    if (!label) return null;
    const hit = categoryCache.get(label.toLowerCase());
    if (hit) return hit;
    const slug = slugify(label);
    let id = `cat-meko-${slug}`.slice(0, 64);
    let n = 2;
    const usedIds = new Set(existingCategories.map((row) => row.id));
    const usedSlugs = new Set(existingCategories.map((row) => row.slug));
    let finalSlug = slug;
    while (usedIds.has(id)) {
      id = `cat-meko-${slug}-${n}`.slice(0, 64);
      n += 1;
    }
    n = 2;
    while (usedSlugs.has(finalSlug)) {
      finalSlug = `${slug}-${n}`;
      n += 1;
    }
    await db.insert(partCategory).values({
      id,
      name: label,
      slug: finalSlug,
      description: `${label} from the official MEKO website.`,
    });
    const created = { id, name: label, slug: finalSlug };
    existingCategories.push(created);
    categoryCache.set(label.toLowerCase(), created);
    return created;
  }

  function officialSpec(row: Classified, previous: Record<string, unknown> = {}) {
    return {
      ...previous,
      manufacturer: MANUFACTURER,
      source: "https://mekoautoindia.com/",
      source_url: row.sourceUrl,
      official_image_url: row.officialImageUrl || previous.official_image_url || null,
      catalogue_image: row.imageFile || previous.catalogue_image || null,
      application: row.application || previous.application || null,
      reference_no: row.oem || previous.reference_no || null,
      subcategory: row.subcategory || previous.subcategory || null,
      vehicle_groups: row.vehicleGroups || previous.vehicle_groups || [],
      fulfilled_by: FIRM_NAME,
      internal_import_key: previous.internal_import_key || row.importKey,
      selling_price: null,
    };
  }

  function descriptionFor(row: Classified) {
    return [
      "MEKO official website",
      row.category || null,
      row.application || null,
      row.oem ? `Ref. Nos. ${row.oem}` : null,
      row.sourceUrl,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  let updatedOfficialFields = 0;
  for (const row of duplicates) {
    if (!row.existingPartId) continue;
    const existing = existingParts.find((item) => item.id === row.existingPartId);
    if (!existing) continue;
    const previous = parseSpec(existing.specifications);
    const next = officialSpec(row, previous);
    const patch: {
      specifications: string;
      oemNumber?: string | null;
      alternatePartNumbers?: string | null;
      description?: string | null;
      name?: string;
      categoryId?: string | null;
    } = { specifications: JSON.stringify(next) };
    if (isBlank(existing.oemNumber) && row.oem) patch.oemNumber = row.oem;
    else if (row.oem && existing.oemNumber && existing.oemNumber !== row.oem && isBlank(existing.alternatePartNumbers)) {
      patch.alternatePartNumbers = row.oem;
    }
    if (isBlank(existing.description)) patch.description = descriptionFor(row);
    if (isBlank(existing.name) || existing.name === existing.partNumber) patch.name = row.name;
    if (!existing.categoryId && row.category) {
      const category = await ensureCategory(row.category);
      if (category) patch.categoryId = category.id;
    }
    await db.update(part).set(patch).where(eq(part.id, existing.id));
    updatedOfficialFields += 1;
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

  for (const group of chunk(ready, 1)) {
    const partRows: Array<{
      id: string;
      partNumber: string;
      name: string;
      description: string;
      brand: string;
      categoryId: string | null;
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
      const category = row.category ? await ensureCategory(row.category) : null;
      partRows.push({
        id: partId,
        partNumber: row.partNumber,
        name: row.name,
        description: descriptionFor(row),
        brand: BRAND,
        categoryId: category?.id || null,
        oemNumber: row.oem || null,
        barcode: null,
        specifications: JSON.stringify(officialSpec(row)),
        slug: key.toLowerCase(),
        isPublished: true,
      });
      listingRows.push({
        id: listingId,
        dealerId: dealerRow.id,
        firmId: indiaSales.id,
        partId,
        sku: row.partNumber,
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
        part_number: row.partNumber,
        name: row.name,
        description: descriptionFor(row),
        brand: BRAND,
        category: category?.name || "",
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
        partNumber: group.map((row) => row.partNumber).join(" | "),
        error: error instanceof Error ? error.message : "insert failed",
      });
    }
    process.stdout.write(`imported ${insertedParts}/${ready.length}\n`);
  }

  const updatedMeko = await db
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
  const typesenseAll = updatedMeko.map((row) => ({
    id: row.id,
    part_number: row.partNumber,
    name: row.name,
    description: row.description || "",
    brand: row.brand || BRAND,
    category: (row.categoryId && catName.get(row.categoryId)) || "",
    vehicle_ids: [] as string[],
  }));

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
      for (const group of chunk(typesenseAll, 80)) {
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
    .select({ id: part.id, partNumber: part.partNumber })
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

  const report = {
    productionChanged: false,
    deployed: false,
    migrations: false,
    firm: indiaSales,
    dealerUsed: { id: dealerRow.id, businessName: dealerRow.businessName },
    websiteRows: extracted.length,
    existingMekoBefore: mekoBefore.length,
    READY: ready.length,
    DUPLICATE: duplicates.length,
    CONFLICT: conflicts.length,
    REVIEW: reviews.length,
    insertedParts,
    insertedListings,
    insertedInventory,
    updatedOfficialFields,
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
    mekoStockPositive: stockRows.filter((row) => row.quantity > 0).length,
    mekoPriced: mekoListings.filter((row) => row.pricePaise > 0).length,
    mekoUnpriced: mekoListings.filter((row) => row.pricePaise <= 0).length,
    mekoWithMrp: mekoListings.filter((row) => row.mrpPaise != null && row.mrpPaise > 0).length,
    typesenseIndexed,
    typesenseBefore,
    typesenseAfter,
    typesenseMeko,
    typesenseError,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
