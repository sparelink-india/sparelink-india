import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/db");
  const { partNumberSearchText } = await import("../lib/search-intent");
  const { part, partCategory, partVehicleCompatibility } =
    await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const Typesense = (await import("typesense")).default;

  const typesense = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST!,
        port: Number(process.env.TYPESENSE_PORT ?? 443),
        protocol: process.env.TYPESENSE_PROTOCOL ?? "https",
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY!,
    connectionTimeoutSeconds: 5,
  });

  const db = getDb();

  const parts = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      description: part.description,
      brand: part.brand,
      category: partCategory.name,
    })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id));

  const documents = [];

  for (const item of parts) {
    const compatibility = await db
      .select({ vehicleId: partVehicleCompatibility.vehicleId })
      .from(partVehicleCompatibility)
      .where(eq(partVehicleCompatibility.partId, item.id));

    documents.push({
      id: item.id,
      part_number: item.partNumber,
      part_number_search: partNumberSearchText(item.partNumber),
      name: item.name,
      description: item.description ?? "",
      brand: item.brand ?? "",
      category: item.category ?? "",
      vehicle_ids: compatibility.map((row) => row.vehicleId),
    });
  }

  if (documents.length === 0) {
    console.log("No parts found to index.");
    return;
  }

  const result = await typesense
    .collections("parts")
    .documents()
    .import(documents, { action: "upsert" });

  console.log(`INDEXED ${documents.length} PARTS`);
  console.log(result);
}

main().catch((error) => {
  console.error("INDEX ERROR:", error.message);
  process.exit(1);
});
