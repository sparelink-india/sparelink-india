import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { sql } from "drizzle-orm";

async function main() {
  const { getDb } = await import("../lib/db");
  const { part } = await import("../drizzle/schema");
  const db = getDb();
  const rows = await db
    .select({ partNumber: part.partNumber, brand: part.brand })
    .from(part)
    .where(sql`${part.partNumber} ilike '%7811%' or ${part.partNumber} ilike 'M 557' or ${part.partNumber} = 'M-557'`);
  console.log(rows);
}
main();
