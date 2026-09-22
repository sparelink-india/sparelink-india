import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { count, eq, sql } from "drizzle-orm";

import { part, partCategory } from "../drizzle/schema";

async function main() {
  const { getDb } = await import("../lib/db");
  const db = getDb();
  const categories = await db
    .select({
      id: partCategory.id,
      name: partCategory.name,
      slug: partCategory.slug,
      n: count(part.id),
    })
    .from(partCategory)
    .leftJoin(part, eq(part.categoryId, partCategory.id))
    .groupBy(partCategory.id, partCategory.name, partCategory.slug)
    .orderBy(sql`count(${part.id}) desc`);

  const [uncategorized] = await db
    .select({ n: count() })
    .from(part)
    .where(sql`${part.categoryId} is null`);

  console.log(
    JSON.stringify(
      {
        uncategorized: Number(uncategorized.n),
        categories,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
