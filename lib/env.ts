function readOptional(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

/**
 * Public origin used for Cashfree return URLs and absolute links.
 * Local/dev may fall back to localhost. Production requests require an
 * explicit https NEXT_PUBLIC_APP_URL (set on the host, not in git).
 */
export function getPublicAppUrl(): string {
  const configured = readOptional("NEXT_PUBLIC_APP_URL");
  const productionNode = process.env.NODE_ENV === "production";

  if (productionNode) {
    if (!configured) {
      throw new Error(
        "NEXT_PUBLIC_APP_URL must be set to the public https origin when NODE_ENV=production.",
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
    }

    if (parsed.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_APP_URL must use https in production.");
    }

    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      throw new Error(
        "NEXT_PUBLIC_APP_URL must not be localhost when NODE_ENV=production.",
      );
    }

    return configured.replace(/\/+$/, "");
  }

  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
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
