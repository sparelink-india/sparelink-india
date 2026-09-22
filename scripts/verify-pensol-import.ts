import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/db");
  const { part, dealerListing, inventory, firm, partCategory } = await import("../drizzle/schema");
  const { eq, sql, like } = await import("drizzle-orm");
  const Typesense = (await import("typesense")).default;

  const db = getDb();
  const [partsCount] = await db.select({ n: sql<number>`count(*)::int` }).from(part);
  const [listingsCount] = await db.select({ n: sql<number>`count(*)::int` }).from(dealerListing);
  const [pensolCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(part)
    .where(eq(part.brand, "Pensol"));
  const hind = (await db.select().from(firm).where(eq(firm.name, "Hind Motors")))[0];
  const [hindListings] = hind
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(dealerListing)
        .where(eq(dealerListing.firmId, hind.id))
    : [{ n: 0 }];
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
  const [stockPensol] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inventory)
    .innerJoin(dealerListing, eq(inventory.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .where(sql`${part.brand} = 'Pensol' AND ${inventory.quantity} > 0`);
  const duplicateNumbers = await db
    .select({ partNumber: part.partNumber, n: sql<number>`count(*)::int` })
    .from(part)
    .where(eq(part.brand, "Pensol"))
    .groupBy(part.partNumber)
    .having(sql`count(*) > 1`);
  const duplicateSourcePack = await db
    .select({
      sourcePack: sql<string>`lower(coalesce((${part.specifications})::json->>'source_url','')) || '|' || lower(coalesce((${part.specifications})::json->>'pack_size',''))`,
      n: sql<number>`count(*)::int`,
    })
    .from(part)
    .where(eq(part.brand, "Pensol"))
    .groupBy(
      sql`lower(coalesce((${part.specifications})::json->>'source_url','')) || '|' || lower(coalesce((${part.specifications})::json->>'pack_size',''))`,
    )
    .having(sql`count(*) > 1`);
  const [oahParts] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(part)
    .where(sql`${part.brand} IS DISTINCT FROM 'Pensol'`);
  const sample = await db
    .select({
      partNumber: part.partNumber,
      name: part.name,
      category: partCategory.name,
      pricePaise: dealerListing.pricePaise,
      mrpPaise: dealerListing.mrpPaise,
      quantity: inventory.quantity,
    })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .leftJoin(dealerListing, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(like(part.name, "%AP-LR%"))
    .limit(12);

  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY) {
    throw new Error("Typesense env not configured.");
  }
  const client = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST,
        port: Number(process.env.TYPESENSE_PORT ?? 443),
        protocol: process.env.TYPESENSE_PROTOCOL ?? "https",
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 30,
  });
  const collection = await client.collections("parts").retrieve();
  const pensolIndex = await client.collections("parts").documents().search({
    q: "*",
    query_by: "brand",
    filter_by: "brand:=Pensol",
    per_page: 1,
  });
  const { readdirSync, existsSync } = await import("fs");
  const imageDir = existsSync("data/catalogue-image-store")
    ? "data/catalogue-image-store"
    : "data/source-catalogue/images";
  const pensolImageFiles = existsSync(imageDir)
    ? readdirSync(imageDir).filter((name) => name.toUpperCase().startsWith("PENSOL-")).length
    : 0;
  const queries = [
    "Pensol",
    "AP-LR 30000",
    "AP-LR 100000",
    "AP-LR 135000",
    "Platinum",
    "Diamond",
    "Gear TX",
    "4ST",
    "Coolant",
    "Brake Fluid",
    "101",
    "103",
    "5240L,M5",
    "30456",
    "30151R",
    "30151L",
    "113",
    "TATA ALTROZ WR ASSY",
  ];
  const search: Record<string, { found: number; top: string[] }> = {};
  for (const q of queries) {
    const result = await client.collections("parts").documents().search({
      q,
      query_by: "part_number,name,description,brand,category",
      per_page: 5,
      prefix: true,
      num_typos: 1,
    });
    const hits = result.hits ?? [];
    search[q] = {
      found: typeof result.found === "number" ? result.found : hits.length,
      top: hits.map((hit) => {
        const doc = (hit.document ?? {}) as { name?: string; brand?: string; part_number?: string };
        return `${doc.brand || ""} | ${doc.part_number || ""} | ${doc.name || ""}`.trim();
      }),
    };
  }

  const { parseSearchIntent, filterAutocompleteHits } = await import("../lib/search-intent");
  const wrIntent = parseSearchIntent("TATA ALTROZ WR ASSY");
  const wrSearch = await client.collections("parts").documents().search({
    q: wrIntent.typesenseQuery,
    query_by: "part_number,name,description,brand,category",
    per_page: 50,
    prefix: true,
    num_typos: 1,
  });
  const wrHits = wrSearch.hits ?? [];
  const wrSuggest = filterAutocompleteHits(
    wrIntent,
    wrHits,
    (hit) => (hit.document ?? {}) as { name?: string; brand?: string; category?: string; part_number?: string; description?: string },
    12,
  );

  const report = {
    parts: Number(partsCount.n ?? 0),
    listings: Number(listingsCount.n ?? 0),
    pensolParts: Number(pensolCount.n ?? 0),
    hindMotorsListings: Number(hindListings.n ?? 0),
    pensolPricePositive: Number(pricedPensol.n ?? 0),
    pensolMrpPresent: Number(mrpPensol.n ?? 0),
    pensolStockPositive: Number(stockPensol.n ?? 0),
    duplicatePensolPartNumbers: duplicateNumbers.length,
    duplicateSourceUrlAndPack: duplicateSourcePack.length,
    oahParts: Number(oahParts.n ?? 0),
    pensolImageFiles,
    typesensePensolDocuments:
      typeof pensolIndex.found === "number" ? pensolIndex.found : 0,
    apLrSample: sample,
    typesenseDocuments: Number(collection.num_documents ?? 0),
    search,
    wrAssySuggest: wrSuggest.map((hit) => {
      const doc = (hit.document ?? {}) as { name?: string; part_number?: string };
      return `${doc.part_number || ""} | ${doc.name || ""}`.trim();
    }),
    wrAssySuggestCount: wrSuggest.length,
    wrAssyTypesenseFound: typeof wrSearch.found === "number" ? wrSearch.found : wrHits.length,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
