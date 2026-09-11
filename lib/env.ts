function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

/**
 * Process environment accessors.
 * DATABASE_URL is optional so `next dev` / `next build` work without Postgres.
 */
export const env = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: readOptional("DATABASE_URL"),
  NEXT_PUBLIC_APP_URL:
    readOptional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
} as const;
