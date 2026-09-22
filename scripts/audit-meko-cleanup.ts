import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ORIGINAL_JSON = path.join("catalogue-source", "MEKO", "extracted.json");
const AUDIT_DIR = path.join("data", "meko-catalogue-archive");
const SAFETY_DIR = path.join("sparelink-safety-backups", `meko-cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const INDEX_PATH = path.join("data", "catalogue-image-index.json");
const IMAGE_DIRS = [
  path.join("data", "source-catalogue", "images"),
  path.join("data", "catalogue-image-store"),
  path.join("data", "meko-catalogue", "product-images"),
  path.join("data", "meko-catalogue", "website-images"),
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

function dbHostHint(url: string | undefined): string {
  const value = String(url || "");
  if (!value) return "missing";
  if (value.includes("localhost") || value.includes("127.0.0.1")) return "local-like";
  return "remote-url-present";
}

async function typesenseClient() {
  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY) return null;
  const Typesense = (await import("typesense")).default;
  return new Typesense.Client({
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
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing MEKO cleanup against production DB target.");
  }
  if (!existsSync(ORIGINAL_JSON)) {
    throw new Error("Original MEKO extracted.json missing; cannot distinguish the first 89 rows.");
  }
  const original = JSON.parse(readFileSync(ORIGINAL_JSON, "utf8")) as {
    products: Array<{ cataloguePartNumber: string; sourcePage?: number }>;
  };
  const originalPns = [...new Set((original.products || []).map((row) => String(row.cataloguePartNumber || "").trim()))].filter(
    Boolean,
  );
  if (originalPns.length !== 89) {
    throw new Error(`Expected 89 original MEKO identities, found ${originalPns.length}. Stopping.`);
  }
  const originalSet = new Set(originalPns.map((value) => value.toLowerCase()));

  const { getDb } = await import("../lib/db");
  const {
    part,
    dealerListing,
    inventory,
    partVehicleCompatibility,
    enquiry,
    cartItem,
    wishlist,
    orderItem,
    partCategory,
    firm,
    warrantyClaim,
  } = await import("../drizzle/schema");
  const { inArray, sql, and } = await import("drizzle-orm");
  const db = getDb();

  const mekoParts = await db
    .select()
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);
  const preserve = mekoParts.filter((row) => originalSet.has(row.partNumber.toLowerCase()));
  const remove = mekoParts.filter((row) => !originalSet.has(row.partNumber.toLowerCase()));
  const missingOriginal = originalPns.filter(
    (pn) => !mekoParts.some((row) => row.partNumber.toLowerCase() === pn.toLowerCase()),
  );

  const byCreated = new Map<string, number>();
  for (const row of mekoParts) {
    const stamp = row.createdAt instanceof Date ? row.createdAt.toISOString().slice(0, 16) : String(row.createdAt).slice(0, 16);
    byCreated.set(stamp, (byCreated.get(stamp) || 0) + 1);
  }
  const earliest = [...mekoParts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const earliest89 = earliest.slice(0, 89);
  const earliest89Ids = new Set(earliest89.map((row) => row.id));
  const preserveIds = new Set(preserve.map((row) => row.id));
  const earliestMismatch = earliest89.filter((row) => !preserveIds.has(row.id)).map((row) => row.partNumber);
  const preserveNotEarliest = preserve.filter((row) => !earliest89Ids.has(row.id)).map((row) => row.partNumber);

  const removeIds = remove.map((row) => row.id);

  const allListings = mekoParts.length
    ? await db
        .select()
        .from(dealerListing)
        .where(
          inArray(
            dealerListing.partId,
            mekoParts.map((row) => row.id),
          ),
        )
    : [];
  const firms = await db.select({ id: firm.id, name: firm.name }).from(firm);
  const indiaSales = firms.find((row) => row.name === "India Sales");
  const preserveListings = allListings.filter((row) => preserveIds.has(row.partId));
  const removeListings = allListings.filter((row) => removeIds.includes(row.partId));
  const listingIdsRemove = removeListings.map((row) => row.id);
  const listingIdsAll = allListings.map((row) => row.id);

  const invAll = listingIdsAll.length
    ? await db.select().from(inventory).where(inArray(inventory.dealerListingId, listingIdsAll))
    : [];
  const invRemove = invAll.filter((row) => listingIdsRemove.includes(row.dealerListingId));
  const compatAll = mekoParts.length
    ? await db.select().from(partVehicleCompatibility).where(
        inArray(
          partVehicleCompatibility.partId,
          mekoParts.map((row) => row.id),
        ),
      )
    : [];
  const compatRemove = compatAll.filter((row) => removeIds.includes(row.partId));
  const enquiryAll = mekoParts.length
    ? await db.select().from(enquiry).where(
        inArray(
          enquiry.partId,
          mekoParts.map((row) => row.id),
        ),
      )
    : [];
  const enquiryRemove = enquiryAll.filter((row) => removeIds.includes(row.partId));
  const wishlistAll = mekoParts.length
    ? await db.select().from(wishlist).where(
        inArray(
          wishlist.partId,
          mekoParts.map((row) => row.id),
        ),
      )
    : [];
  const wishlistRemove = wishlistAll.filter((row) => removeIds.includes(row.partId));
  const cartAll = listingIdsAll.length
    ? await db.select().from(cartItem).where(inArray(cartItem.dealerListingId, listingIdsAll))
    : [];
  const cartRemove = cartAll.filter((row) => listingIdsRemove.includes(row.dealerListingId));
  const orderAll = mekoParts.length
    ? await db.select().from(orderItem).where(
        inArray(
          orderItem.partId,
          mekoParts.map((row) => row.id),
        ),
      )
    : [];
  const orderRemove = orderAll.filter((row) => removeIds.includes(row.partId));
  const warrantyAll = mekoParts.length
    ? await db.select().from(warrantyClaim).where(
        inArray(
          warrantyClaim.partId,
          mekoParts.map((row) => row.id),
        ),
      )
    : [];
  const warrantyRemove = warrantyAll.filter((row) => row.partId && removeIds.includes(row.partId));

  const categories = await db.select().from(partCategory);
  const mekoCategories = categories.filter(
    (row) =>
      row.id.startsWith("cat-meko-") ||
      /from the (official )?MEKO/i.test(row.description || "") ||
      /MEKO Genuine Spares/i.test(row.description || ""),
  );
  const preserveCategoryIds = new Set(preserve.map((row) => row.categoryId).filter(Boolean));
  const removeOnlyCategories = mekoCategories.filter((row) => {
    const usedByPreserve = preserveCategoryIds.has(row.id);
    const usedByOther = mekoParts.some((partRow) => partRow.categoryId === row.id && !removeIds.includes(partRow.id) && !preserveIds.has(partRow.id));
    const usedByNonMeko = false;
    return !usedByPreserve && !usedByOther && !usedByNonMeko;
  });

  const mekoCategoryIds = mekoCategories.map((row) => row.id);
  const nonMekoUsingMekoCat = mekoCategoryIds.length
    ? await db
        .select({ id: part.id, brand: part.brand, categoryId: part.categoryId })
        .from(part)
        .where(and(inArray(part.categoryId, mekoCategoryIds), sql`lower(${part.brand}) <> 'meko'`))
    : [];

  let typesense: Record<string, unknown> = { configured: false };
  const client = await typesenseClient();
  if (client) {
    const coll = await client.collections("parts").retrieve();
    const meko = await client.collections("parts").documents().search({
      q: "*",
      query_by: "brand,name,part_number",
      filter_by: "brand:=MEKO",
      per_page: 0,
    });
    typesense = {
      configured: true,
      totalDocs: Number(coll.num_documents ?? 0),
      mekoDocs: Number(meko.found ?? 0),
    };
  }

  const imageIndex = existsSync(INDEX_PATH)
    ? (JSON.parse(readFileSync(INDEX_PATH, "utf8")) as Record<string, string>)
    : {};
  const preserveKeys = new Set(preserve.map((row) => skuKey(row.partNumber)));
  const removeKeys = new Set(remove.map((row) => skuKey(row.partNumber)));
  const indexKeys = Object.keys(imageIndex);
  const removeIndexKeys = indexKeys.filter((key) => removeKeys.has(key));
  const preserveIndexKeys = indexKeys.filter((key) => preserveKeys.has(key));
  const sharedIndexKeys = removeIndexKeys.filter((key) => preserveKeys.has(key));
  const unmappedKeys = indexKeys.filter((key) => /^unmapped-p\d+/i.test(key));

  const imageFiles: Array<{ dir: string; file: string; key: string }> = [];
  for (const dir of IMAGE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const key = path.basename(file, path.extname(file));
      imageFiles.push({ dir, file, key });
    }
  }
  const removableImageFiles = imageFiles.filter(
    (row) =>
      removeKeys.has(row.key) ||
      /^unmapped-p\d+/i.test(row.key) ||
      dirIsGeneratedMeko(row.dir),
  );
  const sharedImageFiles = removableImageFiles.filter((row) => preserveKeys.has(row.key) && !dirIsGeneratedMeko(row.dir));

  const generatedSource = [
    path.join("data", "meko-catalogue"),
    path.join("scripts", "meko-tools"),
  ].filter((dir) => existsSync(dir));

  const preserveSpecs = preserve.map((row) => parseSpec(row.specifications));
  const removeSpecs = remove.map((row) => parseSpec(row.specifications));

  const ambiguity: string[] = [];
  if (missingOriginal.length) {
    ambiguity.push(`Original extract identities missing in DB: ${missingOriginal.join(", ")}`);
  }
  if (preserve.length !== 89) {
    ambiguity.push(`Preserve set is ${preserve.length}, expected 89.`);
  }
  if (earliestMismatch.length) {
    ambiguity.push(
      `Earliest 89 created_at rows are not an exact match to original extract identities (${earliestMismatch.length} mismatches).`,
    );
  }
  if (preserveNotEarliest.length) {
    ambiguity.push(
      `${preserveNotEarliest.length} original extract identities are not in the earliest 89 created_at rows.`,
    );
  }
  const indiaSalesOnlyRemove = removeListings.filter((row) => row.firmId !== indiaSales?.id);
  if (indiaSalesOnlyRemove.length) {
    ambiguity.push(`${indiaSalesOnlyRemove.length} removable listings are not India Sales.`);
  }
  if (orderRemove.length) {
    ambiguity.push(`${orderRemove.length} order_item rows reference removable MEKO parts (FK restrict).`);
  }
  if (Array.isArray(nonMekoUsingMekoCat) && nonMekoUsingMekoCat.length) {
    ambiguity.push(`${nonMekoUsingMekoCat.length} non-MEKO parts use MEKO-created categories.`);
  }
  if (sharedIndexKeys.length || sharedImageFiles.length) {
    ambiguity.push("Some removable image keys are also used by preserved original MEKO parts.");
  }

  mkdirSync(AUDIT_DIR, { recursive: true });
  mkdirSync(SAFETY_DIR, { recursive: true });
  const backup = {
    backedUpAt: new Date().toISOString(),
    dbHostHint: dbHostHint(process.env.DATABASE_URL),
    originalIdentities: originalPns,
    mekoParts,
    preserveParts: preserve,
    removeParts: remove,
    listings: allListings,
    inventory: invAll,
    compatibility: compatAll,
    enquiry: enquiryAll,
    wishlist: wishlistAll,
    cartItems: cartAll,
    orderItems: orderAll,
    warrantyClaims: warrantyAll,
    mekoCategories,
  };
  const backupName = "meko-db-backup.json";
  writeFileSync(path.join(AUDIT_DIR, backupName), `${JSON.stringify(backup)}\n`);
  writeFileSync(path.join(SAFETY_DIR, backupName), `${JSON.stringify(backup)}\n`);
  writeFileSync(path.join(SAFETY_DIR, "original-89-part-numbers.json"), `${JSON.stringify(originalPns, null, 2)}\n`);
  writeFileSync(path.join(SAFETY_DIR, "remove-part-numbers.json"), `${JSON.stringify(remove.map((row) => row.partNumber), null, 2)}\n`);

  const audit = {
    productionTarget: process.env.SPARELINK_DB_TARGET || null,
    dbHostHint: dbHostHint(process.env.DATABASE_URL),
    backupDir: SAFETY_DIR,
    originalExtractCount: originalPns.length,
    mekoParts: mekoParts.length,
    preserveParts: preserve.length,
    removeParts: remove.length,
    missingOriginal,
    createdAtMinuteBuckets: Object.fromEntries([...byCreated.entries()].sort()),
    earliestMismatchCount: earliestMismatch.length,
    preserveNotEarliestCount: preserveNotEarliest.length,
    preserveListings: preserveListings.length,
    removeListings: removeListings.length,
    mekoInventory: invAll.length,
    removeInventory: invRemove.length,
    mekoCompatibility: compatAll.length,
    removeCompatibility: compatRemove.length,
    removeEnquiry: enquiryRemove.length,
    removeWishlist: wishlistRemove.length,
    removeCartItems: cartRemove.length,
    removeOrderItems: orderRemove.length,
    removeWarranty: warrantyRemove.length,
    mekoCategories: mekoCategories.length,
    removeOnlyCategories: removeOnlyCategories.map((row) => row.id),
    preserveWithTax: preserveSpecs.filter((spec) => spec.gst != null || spec.hsn).length,
    removeWithTax: removeSpecs.filter((spec) => spec.gst != null || spec.hsn).length,
    typesense,
    imageIndexTotal: indexKeys.length,
    preserveImageIndexKeys: preserveIndexKeys.length,
    removeImageIndexKeys: removeIndexKeys.length,
    unmappedImageIndexKeys: unmappedKeys.length,
    removableImageFiles: removableImageFiles.length,
    sharedImageFiles: sharedImageFiles.length,
    generatedSourceDirs: generatedSource,
    indiaSalesFirm: indiaSales || null,
    removablePartNumbers: remove.map((row) => row.partNumber),
    preservedPartNumbers: preserve.map((row) => row.partNumber),
    ambiguity,
    safeToDelete: ambiguity.length === 0 && remove.length > 0,
  };
  writeFileSync(path.join(AUDIT_DIR, "cleanup-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
  writeFileSync(path.join(SAFETY_DIR, "cleanup-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify(audit, null, 2));
}

function dirIsGeneratedMeko(dir: string): boolean {
  return dir.replace(/\\/g, "/").includes("data/meko-catalogue/");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
