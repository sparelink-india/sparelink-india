import { existsSync } from "node:fs";

import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const argv = process.argv.join(" ").toLowerCase();
const needsLiveDatabase = /\b(migrate|push|studio|pull|check)\b/.test(argv);

function resolveDatabaseUrl(): string {
  if (!needsLiveDatabase) {
    if (existsSync(".env.development.local")) {
      dotenv.config({ path: ".env.development.local" });
    }
    return process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/sparelink";
  }

  const target = (process.env.SPARELINK_DB_TARGET ?? "").trim().toLowerCase();
  if (target !== "test" && target !== "production") {
    throw new Error(
      "Refusing to run a database command without SPARELINK_DB_TARGET=test or SPARELINK_DB_TARGET=production. Use npm run db:migrate:test, or npm run db:migrate:production (requires --i-understand-production).",
    );
  }

  if (target === "production") {
    const allowed = (process.env.SPARELINK_ALLOW_PRODUCTION_DB ?? "").trim();
    if (allowed !== "YES") {
      throw new Error(
        "Refusing production DATABASE_URL. Set SPARELINK_ALLOW_PRODUCTION_DB=YES with SPARELINK_DB_TARGET=production, or use npm run db:migrate:production.",
      );
    }
  }

  const envFile =
    target === "test" ? ".env.development.local" : ".env.local";
  if (!existsSync(envFile)) {
    throw new Error(
      `Missing ${envFile} for SPARELINK_DB_TARGET=${target}.`,
    );
  }

  dotenv.config({ path: envFile, override: true });
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(`DATABASE_URL is not set in ${envFile}.`);
  }
  return url;
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
