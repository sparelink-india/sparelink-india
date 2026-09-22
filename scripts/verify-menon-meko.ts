import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing verification against production DB target.");
  }
  const { getDb } = await import("../lib/db");
  const { part, dealerListing, inventory, firm } = await import("../drizzle/schema");
  const { count, sql, inArray } = await import("drizzle-orm");
  const db = getDb();

  const firms = await db.select({ id: firm.id, name: firm.name, code: firm.code }).from(firm);
  const hind = firms.find((row) => row.name === "Hind Motors");
  const india = firms.find((row) => row.name === "India Sales");
  const [parts] = await db.select({ n: count() }).from(part);
  const [listings] = await db.select({ n: count() }).from(dealerListing);
  const [inv] = await db.select({ n: count() }).from(inventory);

  const menonParts = await db
    .select({ id: part.id, partNumber: part.partNumber, brand: part.brand })
    .from(part)
    .where(sql`lower(${part.brand}) like '%menon%'`);
  const mekoParts = await db
    .select({ id: part.id, partNumber: part.partNumber, brand: part.brand })
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);

  async function listingStats(partIds: string[], expectedFirmId: string | undefined) {
    if (!partIds.length) {
      return { listings: 0, firmMatch: 0, priced: 0, unpriced: 0, mrp: 0, stockPositive: 0 };
    }
    const rows = await db
      .select({
        id: dealerListing.id,
        firmId: dealerListing.firmId,
        pricePaise: dealerListing.pricePaise,
        mrpPaise: dealerListing.mrpPaise,
      })
      .from(dealerListing)
      .where(inArray(dealerListing.partId, partIds));
    const listingIds = rows.map((row) => row.id);
    const stock = listingIds.length
      ? await db
          .select({ quantity: inventory.quantity })
          .from(inventory)
          .where(inArray(inventory.dealerListingId, listingIds))
      : [];
    return {
      listings: rows.length,
      firmMatch: expectedFirmId ? rows.filter((row) => row.firmId === expectedFirmId).length : 0,
      priced: rows.filter((row) => row.pricePaise > 0).length,
      unpriced: rows.filter((row) => row.pricePaise <= 0).length,
      mrp: rows.filter((row) => row.mrpPaise != null && row.mrpPaise > 0).length,
      stockPositive: stock.filter((row) => row.quantity > 0).length,
    };
  }

  const menon = await listingStats(menonParts.map((row) => row.id), hind?.id);
  const meko = await listingStats(mekoParts.map((row) => row.id), india?.id);
  const dup = (rows: { partNumber: string }[]) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.partNumber, (map.get(row.partNumber) || 0) + 1);
    return [...map.values()].filter((n) => n > 1).length;
  };

  const report = {
    dbHostHint: String(process.env.DATABASE_URL || "").includes("localhost") || String(process.env.DATABASE_URL || "").includes("127.0.0.1") ? "local-like" : "remote-url-present",
    totals: { parts: Number(parts.n), listings: Number(listings.n), inventory: Number(inv.n) },
    menonParts: menonParts.length,
    mekoParts: mekoParts.length,
    menon,
    meko,
    menonDuplicatePartNumbers: dup(menonParts),
    mekoDuplicatePartNumbers: dup(mekoParts),
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
