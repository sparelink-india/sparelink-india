import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/drizzle/schema";
import { env } from "@/lib/env";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | undefined;
let db: Database | undefined;

/**
 * Lazy Postgres + Drizzle client. Call this only from server code that
 * actually needs the database. The web app does not call it on startup.
 */
export function getDb(): Database {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a Postgres URL before using the database.",
    );
  }

  if (!db) {
    client = postgres(env.DATABASE_URL, { max: 1 });
    db = drizzle(client, { schema });
  }

  return db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}
