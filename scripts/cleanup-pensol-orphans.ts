import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const CSV_PATH = path.join("data", "pensol-catalogue", "import-ready.csv");
const JSON_PATH = path.join("data", "pensol-catalogue", "full-catalogue.json");
const REPORT_PATH = path.join("data", "pensol-catalogue", "orphan-cleanup-report.json");
const IMAGE_DIR = path.join("data", "source-catalogue", "images");
const BRAND = "Pensol";

type SourceRow = {
  product_name: string;
  pack_size?: string;
  source_product_url: string;
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

function parseCsv(file: string): SourceRow[] {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((line) => line.length > 0);
  const header = csvCells(lines[0]);
  return lines.slice(1).map((line) => {
    const values = csvCells(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = values[i] ?? "";
    });
    return {
      product_name: row.product_name,
      pack_size: row.pack_size,
      source_product_url: row.source_product_url,
    };
  });
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

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "item"
  );
}

function expectedImportKey(url: string, pack: string, recordId: string): string {
  const page = slugify(url.replace(/^https?:\/\/pensol\.com\//i, "").replace(/\.html$/i, ""));
  const packSlug = slugify(pack || recordId || "std");
  return `PENSOL-${page}-${packSlug}`.toUpperCase().slice(0, 96);
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing orphan cleanup against production DB target.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  const csvRows = parseCsv(CSV_PATH);
  const jsonRows = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Array<
    SourceRow & { record_id?: string }
  >;
  if (csvRows.length !== 286 || jsonRows.length !== 286) {
    throw new Error(`Source row count unexpected: csv=${csvRows.length} json=${jsonRows.length}`);
  }

  const sourceByIdentity = new Map<string, SourceRow>();
  const expectedKeys = new Set<string>();
  for (const row of jsonRows) {
    const ident = identityKey(row.source_product_url, row.pack_size || "");
    sourceByIdentity.set(ident, row);
    expectedKeys.add(expectedImportKey(row.source_product_url, row.pack_size || "", row.record_id || ""));
  }

  const { getDb } = await import("../lib/db");
  const {
    part,
    dealerListing,
    inventory,
    cartItem,
    wishlist,
    enquiry,
    orderItem,
    partVehicleCompatibility,
  } = await import("../drizzle/schema");
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { sanitizeCatalogueImageKey } = await import("../lib/source-catalogue");

  const db = getDb();
  const pensolParts = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      brand: part.brand,
      specifications: part.specifications,
      createdAt: part.createdAt,
    })
    .from(part)
    .where(eq(part.brand, BRAND));

  const claimed = new Set<string>();
  for (const source of jsonRows) {
    const ident = identityKey(source.source_product_url, source.pack_size || "");
    const key = expectedImportKey(source.source_product_url, source.pack_size || "", source.record_id || "");
    const byKey = pensolParts.find((row) => !claimed.has(row.id) && row.partNumber === key);
    if (byKey) {
      claimed.add(byKey.id);
      continue;
    }
    const byIdentity = pensolParts.find((row) => {
      if (claimed.has(row.id)) return false;
      const spec = parseSpec(row.specifications);
      return identityKey(String(spec.source_url || ""), String(spec.pack_size || "")) === ident;
    });
    if (byIdentity) claimed.add(byIdentity.id);
  }

  const extras = pensolParts.filter((row) => !claimed.has(row.id));
  const matchedCanonical = pensolParts.filter((row) => claimed.has(row.id));

  const canonicalByIdentity = new Map<string, typeof pensolParts>();
  for (const row of matchedCanonical) {
    const spec = parseSpec(row.specifications);
    const ident = identityKey(String(spec.source_url || ""), String(spec.pack_size || ""));
    const list = canonicalByIdentity.get(ident) || [];
    list.push(row);
    canonicalByIdentity.set(ident, list);
  }

  const classified = [];
  for (const row of extras) {
    const spec = parseSpec(row.specifications);
    const sourceUrl = String(spec.source_url || "");
    const pack = String(spec.pack_size || "");
    const ident = identityKey(sourceUrl, pack);
    const manufacturer = String(spec.manufacturer || "");
    const listings = await db.select().from(dealerListing).where(eq(dealerListing.partId, row.id));
    const listingIds = listings.map((item) => item.id);
    const inventoryRows = listingIds.length
      ? await db.select().from(inventory).where(inArray(inventory.dealerListingId, listingIds))
      : [];
    const carts = listingIds.length
      ? await db.select().from(cartItem).where(inArray(cartItem.dealerListingId, listingIds))
      : [];
    const wishes = await db.select().from(wishlist).where(eq(wishlist.partId, row.id));
    const enquiries = await db.select().from(enquiry).where(eq(enquiry.partId, row.id));
    const orderByPart = await db.select().from(orderItem).where(eq(orderItem.partId, row.id));
    const orderByListing = listingIds.length
      ? await db.select().from(orderItem).where(inArray(orderItem.dealerListingId, listingIds))
      : [];
    const orders = [...orderByPart, ...orderByListing];
    const compat = await db
      .select()
      .from(partVehicleCompatibility)
      .where(eq(partVehicleCompatibility.partId, row.id));
    const imageKey = sanitizeCatalogueImageKey(row.partNumber);
    const media = existsSync(IMAGE_DIR)
      ? readdirSync(IMAGE_DIR).filter((name) => name.toLowerCase().startsWith(imageKey.toLowerCase()))
      : [];
    const officialSameName = jsonRows.filter(
      (item) => item.product_name.trim().toLowerCase() === row.name.trim().toLowerCase(),
    );
    const duplicateOfCanonical = ident
      ? (canonicalByIdentity.get(ident) || []).filter((item) => item.id !== row.id)
      : [];
    const namePackMatches = jsonRows.filter(
      (item) =>
        item.product_name.trim().toLowerCase() === row.name.trim().toLowerCase() &&
        (item.pack_size || "").trim().toLowerCase() === pack.trim().toLowerCase(),
    );

    let classification: "PRESERVE" | "ORPHAN" = "ORPHAN";
    let reason = "no_match_to_286_official_identity";
    if (expectedKeys.has(row.partNumber) || sourceByIdentity.has(ident)) {
      classification = "ORPHAN";
      reason = "duplicate_of_already_claimed_official_row";
    } else if (namePackMatches.length && duplicateOfCanonical.length === 0 && !sourceUrl) {
      classification = "PRESERVE";
      reason = "ambiguous_name_pack_match_without_source_url";
    }

    const unsafe =
      orders.length > 0 ||
      enquiries.length > 0 ||
      carts.length > 0 ||
      wishes.length > 0 ||
      inventoryRows.some((item) => item.quantity > 0 || item.reservedQuantity > 0) ||
      listings.some((item) => item.pricePaise > 0 || item.mrpPaise != null);

    classified.push({
      id: row.id,
      partNumber: row.partNumber,
      name: row.name,
      brand: row.brand,
      manufacturer,
      sourceUrl,
      pack,
      identityKey: ident,
      listingIds,
      listingFirmIds: listings.map((item) => item.firmId),
      listingCount: listings.length,
      inventory: inventoryRows.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
      })),
      orderItems: orders.length,
      enquiries: enquiries.length,
      cartItems: carts.length,
      wishlist: wishes.length,
      compatibility: compat.length,
      media,
      officialSameNameCount: officialSameName.length,
      officialNamePackMatches: namePackMatches.length,
      duplicateCanonicalIds: duplicateOfCanonical.map((item) => item.id),
      unsafe,
      classification,
      reason,
    });
  }

  const orphans = classified.filter((row) => row.classification === "ORPHAN" && !row.unsafe);
  const preserved = classified.filter((row) => row.classification === "PRESERVE" || row.unsafe);
  const deleted: string[] = [];
  const skippedUnsafe = classified.filter((row) => row.classification === "ORPHAN" && row.unsafe);

  let typesenseDeleted = 0;
  let typesenseError: string | null = null;
  if (orphans.length) {
    const Typesense = process.env.TYPESENSE_HOST ? (await import("typesense")).default : null;
    const client = Typesense
      ? new Typesense.Client({
          nodes: [
            {
              host: process.env.TYPESENSE_HOST!,
              port: Number(process.env.TYPESENSE_PORT ?? 443),
              protocol: process.env.TYPESENSE_PROTOCOL ?? "https",
            },
          ],
          apiKey: process.env.TYPESENSE_API_KEY!,
          connectionTimeoutSeconds: 30,
        })
      : null;

    for (const orphan of orphans) {
      await db.transaction(async (tx) => {
        if (orphan.listingIds.length) {
          await tx.delete(inventory).where(inArray(inventory.dealerListingId, orphan.listingIds));
          await tx.delete(dealerListing).where(inArray(dealerListing.id, orphan.listingIds));
        }
        await tx.delete(partVehicleCompatibility).where(eq(partVehicleCompatibility.partId, orphan.id));
        await tx.delete(part).where(eq(part.id, orphan.id));
      });
      deleted.push(orphan.id);
      if (client) {
        try {
          await client.collections("parts").documents(orphan.id).delete();
          typesenseDeleted += 1;
        } catch (error) {
          typesenseError = error instanceof Error ? error.message : "Typesense delete error";
        }
      }
    }
  }

  const afterPensol = Number(
    (await db.select({ n: sql<number>`count(*)::int` }).from(part).where(eq(part.brand, BRAND)))[0]?.n ?? 0,
  );
  const afterListings = Number(
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(dealerListing)
        .innerJoin(part, eq(dealerListing.partId, part.id))
        .where(eq(part.brand, BRAND))
    )[0]?.n ?? 0,
  );

  const report = {
    sourceRows: 286,
    pensolBefore: pensolParts.length,
    extrasFound: extras.length,
    classified,
    deleted,
    preserved: preserved.map((row) => ({ id: row.id, partNumber: row.partNumber, reason: row.reason })),
    skippedUnsafe: skippedUnsafe.map((row) => ({ id: row.id, partNumber: row.partNumber, reason: "unsafe_references" })),
    typesenseDeleted,
    typesenseError,
    pensolAfter: afterPensol,
    pensolListingsAfter: afterListings,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
