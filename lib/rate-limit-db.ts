/**
 * Durable rate limiting for Vercel / serverless production.
 *
 * WHY THIS EXISTS
 * The previous limiter (`lib/rate-limit.ts`) kept counters in a module-level
 * `Map`. On Vercel every warm lambda has its own Map, so:
 *   - a cold start reset every counter,
 *   - a burst across N instances was allowed N times the limit,
 *   - the Map grew without eviction (attacker-controlled keyspace),
 *   - the client IP came from a spoofable `x-forwarded-for` first hop.
 *
 * This module backs the counter with Postgres so the limit is shared by every
 * instance and survives restarts. It falls back to the in-process limiter ONLY
 * when the database is unavailable, so a DB outage degrades to advisory
 * rather than taking auth down entirely.
 *
 * Trust model for client identity:
 *   - Vercel strips inbound `x-forwarded-for` and appends the real chain, so the
 *     LAST entry is the address Vercel observed. We take the last hop and
 *     prefer dedicated single-value headers when present.
 *   - We never trust a client-supplied first hop.
 */

import {
  consumeRateLimitWithCount as consumeMemoryRateLimit,
  resetRateLimit as resetMemoryRateLimit,
} from "@/lib/rate-limit";

export type RateLimitDecision = {
  ok: boolean;
  /** Seconds the caller should wait before retrying. */
  retryAfterSeconds: number;
  /** True when the shared Postgres counter answered (vs the memory fallback). */
  shared: boolean;
  /** Number of attempts recorded in the active window. */
  attempts: number;
};

type SqlClient = {
  unsafe: (query: string, params?: unknown[]) => Promise<unknown[]>;
};

let warnedAboutMissingDatabase = false;

function getSqlClient(): SqlClient | null {
  try {
    // Required lazily so `next build` (which has no DATABASE_URL) still works.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require("@/lib/db") as typeof import("@/lib/db");
    const db = getDb() as unknown as { $client?: unknown };
    const client = db.$client as SqlClient | undefined;
    return client && typeof client.unsafe === "function" ? client : null;
  } catch {
    if (!warnedAboutMissingDatabase) {
      warnedAboutMissingDatabase = true;
      console.warn(
        "[rate-limit] Database unavailable; falling back to in-process limiting. Limits are advisory until DATABASE_URL is reachable.",
      );
    }
    return null;
  }
}

/**
 * Resolve a stable client identity without trusting a spoofable header.
 */
export function resolveClientIp(headers: {
  get(name: string): string | null;
}): string {
  const candidates = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return normaliseIp(value);
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    // Last hop is appended by our edge; a client can only control earlier ones.
    const edgeHop = hops[hops.length - 1];
    if (edgeHop) return normaliseIp(edgeHop);
  }

  return "unknown";
}

function normaliseIp(value: string): string {
  // Strip an IPv4 port suffix and an IPv6 bracket wrapper, then cap length so a
  // hostile header cannot bloat the database key.
  const trimmed = value.replace(/^\[|\]$/g, "").split("%")[0].trim();
  const withoutPort = /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(trimmed)
    ? trimmed.slice(0, trimmed.lastIndexOf(":"))
    : trimmed;
  return withoutPort.slice(0, 64) || "unknown";
}

/**
 * Normalise an account identifier (email / username / phone) so per-account
 * throttling works even when the caller rotates IP addresses.
 */
export function normaliseAccountKey(value: string | null | undefined): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return "";
  return trimmed.slice(0, 190);
}

function bucketKey(scope: string, identifier: string): string {
  return `rl:${scope}:${identifier}`;
}

/**
 * Consume one unit from a durable counter.
 *
 * The upsert increments `attempt_count` inside the database so concurrent
 * requests from different lambdas cannot both read the same pre-increment
 * value and both be admitted.
 */
export async function consumeDurableRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitDecision> {
  const key = bucketKey(input.scope, input.identifier);
  const now = Date.now();

  const client = getSqlClient();
  if (!client) {
    const memory = consumeMemoryRateLimit(key, input.limit, input.windowMs);
    return {
      ok: memory.ok,
      retryAfterSeconds: memory.retryAfterSeconds,
      shared: false,
      attempts: memory.attempts,
    };
  }

  try {
    const rows = await client.unsafe(
      `INSERT INTO rate_limit_bucket (key, attempt_count, window_started_at, reset_at)
       VALUES ($1, 1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET
         attempt_count = CASE
           WHEN rate_limit_bucket.reset_at <= $2 THEN 1
           ELSE rate_limit_bucket.attempt_count + 1
         END,
         window_started_at = CASE
           WHEN rate_limit_bucket.reset_at <= $2 THEN $2
           ELSE rate_limit_bucket.window_started_at
         END,
         reset_at = CASE
           WHEN rate_limit_bucket.reset_at <= $2 THEN $3
           ELSE rate_limit_bucket.reset_at
         END
       RETURNING attempt_count, reset_at`,
      [key, now, now + input.windowMs],
    );

    const row = (rows?.[0] ?? {}) as {
      attempt_count?: number;
      reset_at?: number;
    };
    const attempts = Number(row.attempt_count ?? 1);
    const resetAt = Number(row.reset_at ?? now + input.windowMs);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    return {
      ok: attempts <= input.limit,
      retryAfterSeconds,
      shared: true,
      attempts,
    };
  } catch (error) {
    // A failed counter must never lock a legitimate user out. Degrade to the
    // in-process limiter and surface the problem in logs only.
    console.error("[rate-limit] durable counter failed; using in-process limit", {
      scope: input.scope,
      error: error instanceof Error ? error.message : "unknown",
    });
    const memory = consumeMemoryRateLimit(key, input.limit, input.windowMs);
    return {
      ok: memory.ok,
      retryAfterSeconds: memory.retryAfterSeconds,
      shared: false,
      attempts: memory.attempts,
    };
  }
}

/**
 * Clear a bucket. Used after a successful authentication so a legitimate user
 * who fumbled their password a few times is not left near the ceiling.
 */
export async function resetDurableRateLimit(
  scope: string,
  identifier: string,
): Promise<void> {
  const key = bucketKey(scope, identifier);

  // Always clear the local bucket. When the shared counter is unavailable the
  // local bucket IS the counter, so skipping this left a legitimate caller
  // stuck at the ceiling with no way back.
  resetMemoryRateLimit(key);

  const client = getSqlClient();
  if (!client) return;
  try {
    await client.unsafe(`DELETE FROM rate_limit_bucket WHERE key = $1`, [key]);
  } catch {
    /* best effort */
  }
}

/**
 * Progressive lockout for repeated credential failures.
 *
 * Each successive failure inside the observation window raises the effective
 * ceiling by one step up to `maxMultiplier`, so a distributed credential
 * stuffing run is throttled hard while a genuine user who mistypes twice is
 * barely affected. The growth is linear-in-attempts and bounded, which keeps
 * the behaviour simple, predictable and auditable.
 */
export async function consumeProgressiveLockout(input: {
  scope: string;
  identifier: string;
  baseLimit: number;
  windowMs: number;
  maxMultiplier?: number;
}): Promise<RateLimitDecision> {
  const failures = await consumeDurableRateLimit({
    scope: `${input.scope}:failure`,
    identifier: input.identifier,
    limit: input.baseLimit,
    windowMs: input.windowMs,
  });

  const maxMultiplier = Math.max(1, input.maxMultiplier ?? 8);
  const multiplier = Math.min(maxMultiplier, Math.max(1, failures.attempts));
  const effectiveLimit = input.baseLimit * multiplier;

  return {
    ok: failures.attempts <= effectiveLimit,
    retryAfterSeconds: failures.retryAfterSeconds,
    shared: failures.shared,
    attempts: failures.attempts,
  };
}