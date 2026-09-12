import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Typesense from "typesense";

const client = new Typesense.Client({
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

const schema = {
  name: "parts",
  fields: [
    { name: "part_number", type: "string" as const },
    { name: "name", type: "string" as const },
    { name: "description", type: "string" as const, optional: true },
    { name: "brand", type: "string" as const, facet: true, optional: true },
    { name: "category", type: "string" as const, facet: true, optional: true },
    { name: "vehicle_ids", type: "string[]" as const, facet: true, optional: true },
  ],
};

async function main() {
  try {
    await client.collections("parts").delete();
  } catch {
    // Collection does not exist yet.
  }

  await client.collections().create(schema);

  console.log("TYPESENSE COLLECTION CREATED: parts");
}

main().catch((error) => {
  console.error("TYPESENSE ERROR:", error.message);
  process.exit(1);
});
