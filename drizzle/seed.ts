import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/db");
  const { partCategory } = await import("./schema");

  const db = getDb();

  const categories = [
    {
      id: "cat-engine",
      name: "Engine",
      slug: "engine",
      description: "Engine and internal engine components",
    },
    {
      id: "cat-transmission",
      name: "Transmission",
      slug: "transmission",
      description: "Transmission and drivetrain components",
    },
    {
      id: "cat-brakes",
      name: "Brakes",
      slug: "brakes",
      description: "Brake system components",
    },
    {
      id: "cat-suspension",
      name: "Suspension",
      slug: "suspension",
      description: "Suspension and steering components",
    },
    {
      id: "cat-electrical",
      name: "Electrical",
      slug: "electrical",
      description: "Electrical and electronic components",
    },
    {
      id: "cat-filters",
      name: "Filters",
      slug: "filters",
      description: "Air, oil, fuel and cabin filters",
    },
    {
      id: "cat-cooling",
      name: "Cooling",
      slug: "cooling",
      description: "Cooling system components",
    },
    {
      id: "cat-body",
      name: "Body",
      slug: "body",
      description: "Body and exterior components",
    },
  ];

  await db.insert(partCategory).values(categories).onConflictDoNothing();

  console.log(`Seeded ${categories.length} part categories.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
