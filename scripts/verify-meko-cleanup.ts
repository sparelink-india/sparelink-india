import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

type SearchClient = NonNullable<typeof import("../lib/typesense").typesense>;

async function search(client: SearchClient, q: string) {
  const result = await client.collections("parts").documents().search({
    q,
    query_by: "part_number,name,description,brand,category",
    per_page: 5,
  });
  const hits = (result.hits || []).map((hit: { document: { part_number?: string; brand?: string; name?: string } }) => ({
    part_number: hit.document.part_number,
    brand: hit.document.brand,
    name: hit.document.name,
  }));
  return { found: result.found, first: hits[0] || null };
}

async function brandCount(client: SearchClient, brand: string) {
  const result = await client.collections("parts").documents().search({
    q: "*",
    query_by: "name",
    filter_by: `brand:=${brand}`,
    per_page: 1,
  });
  return result.found;
}

async function main() {
  const { getDb } = await import("../lib/db");
  const { part, dealerListing, firm } = await import("../drizzle/schema");
  const { eq, sql } = await import("drizzle-orm");
  const { typesense } = await import("../lib/typesense");
  if (!typesense) throw new Error("Typesense is not configured.");
  const db = getDb();
  const collection = await typesense.collections("parts").retrieve();
  const [meko] = await db.select({ n: sql<number>`count(*)::int` }).from(part).where(sql`lower(${part.brand}) = 'meko'`);
  const [menon] = await db.select({ n: sql<number>`count(*)::int` }).from(part).where(eq(part.brand, "Menon Brakes"));
  const [pensol] = await db.select({ n: sql<number>`count(*)::int` }).from(part).where(eq(part.brand, "Pensol"));
  const india = (await db.select().from(firm).where(eq(firm.id, "firm-india-sales")))[0];
  const [indiaListings] = india
    ? await db.select({ n: sql<number>`count(*)::int` }).from(dealerListing).where(eq(dealerListing.firmId, india.id))
    : [{ n: 0 }];
  const out = {
    db: {
      meko: meko.n,
      menon: menon.n,
      pensol: pensol.n,
      indiaSalesFirm: Boolean(india),
      indiaSalesListings: indiaListings.n,
    },
    typesense: {
      total: Number(collection.num_documents ?? 0),
      meko: await brandCount(typesense, "MEKO"),
      menon: await brandCount(typesense, "Menon Brakes"),
      pensol: await brandCount(typesense, "Pensol"),
    },
    search: {
      "101": await search(typesense, "101"),
      "103": await search(typesense, "103"),
      "113": await search(typesense, "113"),
      wr: await search(typesense, "TATA ALTROZ WR ASSY"),
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
