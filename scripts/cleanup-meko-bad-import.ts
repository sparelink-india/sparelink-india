import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const AUDIT_PATH = path.join("data", "meko-catalogue-archive", "cleanup-audit.json");
const REPORT_PATH = path.join("data", "meko-catalogue-archive", "cleanup-run-report.json");
const INDEX_PATH = path.join("data", "catalogue-image-index.json");
const IMAGE_DIRS = [
  path.join("data", "source-catalogue", "images"),
  path.join("public", "catalogue-images"),
];
const GENERATED_DIRS = [
  path.join("data", "meko-catalogue"),
  path.join("CATALOGUE SOURCE", "MEKO", "extracted-text.txt"),
  path.join("CATALOGUE SOURCE", "MEKO", "extracted.csv"),
  path.join("CATALOGUE SOURCE", "MEKO", "extracted.json"),
  path.join("CATALOGUE SOURCE", "MEKO", "extraction-summary.json"),
  path.join("CATALOGUE SOURCE", "MEKO", "import-run-report.json"),
];
const PRESERVE_PDF = path.join("catalogue-source", "MEKO", "MEKO Genuine Spares 36-page.pdf");

function sanitizeCatalogueImageKey(sku: string): string {
  return sku.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function typesenseMeko(client: NonNullable<typeof import("../lib/typesense").typesense>) {
  const ids: string[] = [];
  let page = 1;
  for (;;) {
    const result = await client.collections("parts").documents().search({
      q: "*",
      query_by: "name",
      filter_by: "brand:=MEKO",
      per_page: 250,
      page,
    });
    const hits = result.hits || [];
    for (const hit of hits) {
      const doc = hit.document as { id?: string };
      if (doc.id) ids.push(doc.id);
    }
    if (hits.length < 250) break;
    page += 1;
  }
  return ids;
}

function archivePath(src: string) {
  return path.join("data", "meko-catalogue-archive", "generated", src.replace(/[\\/]/g, "__"));
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing MEKO cleanup against production DB target.");
  }
  if (!existsSync(AUDIT_PATH)) {
    throw new Error("Audit file missing. Run scripts/audit-meko-cleanup.ts first.");
  }
  if (!existsSync(PRESERVE_PDF)) {
    throw new Error("Original MEKO PDF missing; aborting so it cannot be lost.");
  }
  const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8")) as {
    safeToDelete: boolean;
    ambiguity: string[];
    removeParts: number;
    preserveParts: number;
    removablePartNumbers: string[];
    preservedPartNumbers: string[];
  };
  if (!audit.safeToDelete || (audit.ambiguity || []).length) {
    throw new Error(`Audit is not safe to delete: ${JSON.stringify(audit.ambiguity)}`);
  }

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
  } = await import("../drizzle/schema");
  const { inArray, sql, eq } = await import("drizzle-orm");
  const { typesense } = await import("../lib/typesense");
  const db = getDb();

  const originalSet = new Set(audit.preservedPartNumbers.map((value) => value.toLowerCase()));
  const mekoParts = await db
    .select({ id: part.id, partNumber: part.partNumber, categoryId: part.categoryId })
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);
  const preserve = mekoParts.filter((row) => originalSet.has(row.partNumber.toLowerCase()));
  const remove = mekoParts.filter((row) => !originalSet.has(row.partNumber.toLowerCase()));
  if (preserve.length !== 89 || remove.length !== audit.removeParts) {
    throw new Error(
      `Live DB no longer matches audit (preserve ${preserve.length}/89, remove ${remove.length}/${audit.removeParts}). Stopping.`,
    );
  }
  const removeIds = remove.map((row) => row.id);
  const removePnSet = new Set(remove.map((row) => row.partNumber));
  const preserveKeys = new Set(preserve.map((row) => sanitizeCatalogueImageKey(row.partNumber)));

  const listings = await db
    .select({ id: dealerListing.id, partId: dealerListing.partId })
    .from(dealerListing)
    .where(inArray(dealerListing.partId, removeIds));
  const listingIds = listings.map((row) => row.id);
  const orderHits = await db.select({ id: orderItem.id }).from(orderItem).where(inArray(orderItem.partId, removeIds));
  if (orderHits.length) {
    throw new Error(`Order items reference removable MEKO parts (${orderHits.length}). Stopping.`);
  }

  const typesenseBefore = typesense ? await typesenseMeko(typesense) : [];
  const typesenseRemove = typesenseBefore.filter((id) => removeIds.includes(id));
  const typesensePreserve = typesenseBefore.filter((id) => !removeIds.includes(id));

  for (const group of chunk(listingIds, 200)) {
    await db.delete(inventory).where(inArray(inventory.dealerListingId, group));
    await db.delete(cartItem).where(inArray(cartItem.dealerListingId, group));
    await db.delete(dealerListing).where(inArray(dealerListing.id, group));
  }
  for (const group of chunk(removeIds, 200)) {
    await db.delete(wishlist).where(inArray(wishlist.partId, group));
    await db.delete(enquiry).where(inArray(enquiry.partId, group));
    await db.delete(partVehicleCompatibility).where(inArray(partVehicleCompatibility.partId, group));
    await db.delete(part).where(inArray(part.id, group));
  }

  const leftoverCats = await db
    .select({ id: partCategory.id, name: partCategory.name })
    .from(partCategory)
    .where(sql`${partCategory.id} like 'cat-meko-%'`);
  const remainingMeko = await db
    .select({ categoryId: part.categoryId })
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);
  const usedCat = new Set(remainingMeko.map((row) => row.categoryId).filter(Boolean));
  const unusedMekoCats = leftoverCats.filter((row) => !usedCat.has(row.id));
  if (unusedMekoCats.length) {
    await db.delete(partCategory).where(
      inArray(
        partCategory.id,
        unusedMekoCats.map((row) => row.id),
      ),
    );
  }

  let typesenseDeleted = 0;
  if (typesense) {
    for (const group of chunk(typesenseRemove, 50)) {
      await Promise.all(group.map((id) => typesense.collections("parts").documents(id).delete().catch(() => null)));
      typesenseDeleted += group.length;
    }
  }
  const typesenseAfter = typesense ? await typesenseMeko(typesense) : [];

  const index = existsSync(INDEX_PATH)
    ? (JSON.parse(readFileSync(INDEX_PATH, "utf8")) as Record<string, string>)
    : {};
  const remainingParts = await db.select({ partNumber: part.partNumber }).from(part);
  const remainingKeys = new Set(remainingParts.map((row) => sanitizeCatalogueImageKey(row.partNumber)));
  const removedIndexKeys: string[] = [];
  for (const key of Object.keys(index)) {
    const fromRemovedPn = [...removePnSet].some((pn) => sanitizeCatalogueImageKey(pn) === key);
    const unmapped = /^unmapped-p\d+/i.test(key);
    if ((fromRemovedPn || unmapped) && !remainingKeys.has(key) && !preserveKeys.has(key)) {
      removedIndexKeys.push(key);
      delete index[key];
    }
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(index)}\n`);

  const deletedImageFiles: string[] = [];
  for (const dir of IMAGE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const key of removedIndexKeys) {
      for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
        const file = path.join(dir, `${key}${ext}`);
        if (!existsSync(file)) continue;
        const destDir = path.join("data", "meko-catalogue-archive", "images");
        mkdirSync(destDir, { recursive: true });
        copyFileSync(file, path.join(destDir, path.basename(file)));
        rmSync(file);
        deletedImageFiles.push(file);
      }
    }
  }

  mkdirSync(path.join("data", "meko-catalogue-archive", "generated"), { recursive: true });
  const archivedGenerated: string[] = [];
  for (const src of GENERATED_DIRS) {
    if (!existsSync(src)) continue;
    const dest = archivePath(src);
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    renameSync(src, dest);
    archivedGenerated.push(src);
  }
  const logoSrc = path.join("public", "images", "brands", "meko.jpg");
  if (existsSync(logoSrc)) {
    mkdirSync(path.join("data", "meko-catalogue-archive", "brand"), { recursive: true });
    renameSync(logoSrc, path.join("data", "meko-catalogue-archive", "brand", "meko.jpg"));
  }

  const afterParts = await db
    .select({ id: part.id })
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);
  const afterListings = afterParts.length
    ? await db
        .select({ id: dealerListing.id })
        .from(dealerListing)
        .where(
          inArray(
            dealerListing.partId,
            afterParts.map((row) => row.id),
          ),
        )
    : [];
  const afterInv = afterListings.length
    ? await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(
          inArray(
            inventory.dealerListingId,
            afterListings.map((row) => row.id),
          ),
        )
    : [];
  const indiaSales = await db.select({ id: firm.id, name: firm.name }).from(firm).where(eq(firm.id, "firm-india-sales"));

  const report = {
    deletedParts: remove.length,
    deletedListings: listingIds.length,
    deletedCategories: unusedMekoCats.map((row) => row.id),
    typesenseBefore: typesenseBefore.length,
    typesenseDeleted,
    typesenseAfter: typesenseAfter.length,
    typesensePreserved: typesensePreserve.length,
    removedIndexKeys: removedIndexKeys.length,
    deletedImageFiles: deletedImageFiles.length,
    archivedGenerated,
    afterMekoParts: afterParts.length,
    afterMekoListings: afterListings.length,
    afterMekoInventory: afterInv.length,
    indiaSalesStillExists: indiaSales.length === 1,
    pdfPreserved: existsSync(PRESERVE_PDF),
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
