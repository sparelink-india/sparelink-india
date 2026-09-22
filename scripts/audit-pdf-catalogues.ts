import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { count, ilike, inArray, or, sql } from "drizzle-orm";

import {
  dealerListing,
  firm,
  inventory,
  part,
} from "../drizzle/schema";

function brandFilter(term: string) {
  return or(
    ilike(part.brand, `%${term}%`),
    ilike(part.name, `%${term}%`),
    ilike(part.partNumber, `%${term}%`),
  );
}

async function main() {
  const { getDb } = await import("../lib/db");
  const neonBranch = process.env.NEON_BRANCH || "";
  const db = getDb();

  async function brandAudit(term: string) {
    const parts = await db
      .select({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        brand: part.brand,
      })
      .from(part)
      .where(brandFilter(term));

    const partIds = parts.map((row) => row.id);
    const listings =
      partIds.length === 0
        ? []
        : await db
            .select({
              id: dealerListing.id,
              partId: dealerListing.partId,
              firmId: dealerListing.firmId,
              pricePaise: dealerListing.pricePaise,
              mrpPaise: dealerListing.mrpPaise,
            })
            .from(dealerListing)
            .where(inArray(dealerListing.partId, partIds));

    const listingIds = listings.map((row) => row.id);
    const stockRows =
      listingIds.length === 0
        ? []
        : await db
            .select({
              dealerListingId: inventory.dealerListingId,
              quantity: inventory.quantity,
            })
            .from(inventory)
            .where(inArray(inventory.dealerListingId, listingIds));

    const stockByListing = new Map(stockRows.map((row) => [row.dealerListingId, row.quantity]));
    return {
      parts: parts.length,
      listings: listings.length,
      pricedListings: listings.filter((row) => row.pricePaise > 0).length,
      zeroPriceListings: listings.filter((row) => row.pricePaise <= 0).length,
      listingsWithMrp: listings.filter((row) => row.mrpPaise != null && row.mrpPaise > 0).length,
      stockPositive: listings.filter((row) => (stockByListing.get(row.id) ?? 0) > 0).length,
      sample: parts.slice(0, 8),
    };
  }

  const [partsTotal] = await db.select({ n: count() }).from(part);
  const [listingsTotal] = await db.select({ n: count() }).from(dealerListing);
  const [inventoryTotal] = await db.select({ n: count() }).from(inventory);

  const brands = await db
    .select({
      brand: part.brand,
      n: count(),
    })
    .from(part)
    .groupBy(part.brand)
    .orderBy(sql`count(*) desc`);

  const firms = await db.select({ id: firm.id, name: firm.name, code: firm.code }).from(firm);

  const duplicatePartNumbers = await db
    .select({ partNumber: part.partNumber, n: count() })
    .from(part)
    .groupBy(part.partNumber)
    .having(sql`count(*) > 1`);

  const listingsByFirm = await db
    .select({
      firmId: dealerListing.firmId,
      n: count(),
      priced: sql<number>`sum(case when ${dealerListing.pricePaise} > 0 then 1 else 0 end)`,
      mrp: sql<number>`sum(case when ${dealerListing.mrpPaise} is not null then 1 else 0 end)`,
    })
    .from(dealerListing)
    .groupBy(dealerListing.firmId);

  const [stockPositive] = await db
    .select({ n: count() })
    .from(inventory)
    .where(sql`${inventory.quantity} > 0`);

  let typesenseNumDocuments: number | null = null;
  let typesenseError: string | null = null;
  let typesenseMeko = 0;
  let typesenseMenon = 0;
  if (process.env.TYPESENSE_HOST && process.env.TYPESENSE_API_KEY) {
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
      connectionTimeoutSeconds: 8,
    });
    try {
      const collection = await client.collections("parts").retrieve();
      typesenseNumDocuments = collection.num_documents ?? null;
      const meko = await client.collections("parts").documents().search({
        q: "MEKO",
        query_by: "brand,name,part_number",
        per_page: 1,
      });
      const menon = await client.collections("parts").documents().search({
        q: "Menon",
        query_by: "brand,name,part_number",
        per_page: 1,
      });
      typesenseMeko = Number(meko.found || 0);
      typesenseMenon = Number(menon.found || 0);
    } catch (error) {
      typesenseError = error instanceof Error ? error.message : "typesense error";
    }
  }

  const report = {
    neonBranch,
    writes: false,
    totals: {
      parts: Number(partsTotal.n),
      listings: Number(listingsTotal.n),
      inventory: Number(inventoryTotal.n),
      stockPositive: Number(stockPositive.n),
    },
    firms,
    listingsByFirm,
    brands,
    duplicatePartNumbers,
    meko: await brandAudit("MEKO"),
    menon: await brandAudit("Menon"),
    waterPump: await brandAudit("water pump"),
    typesense: {
      numDocuments: typesenseNumDocuments,
      error: typesenseError,
      mekoHits: typesenseMeko,
      menonHits: typesenseMenon,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
