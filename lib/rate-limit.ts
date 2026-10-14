/**
 * In-process rate limiter.
 *
 * This is the FALLBACK path for `lib/rate-limit-db.ts`. On Vercel it is
 * advisory only, because every warm lambda holds its own `Map`; the durable
 * Postgres-backed limiter is the real control. It is retained so a database
 * outage degrades to "limited" rather than "unlimited", and so local development
 * and the unit tests behave predictably.
 *
 * It also carries the attempt count and an explicit reset, which the durable
 * limiter must mirror. An earlier version returned no count, which silently
 * disabled progressive lockout on the fallback path: a multiplier derived from
 * an absent count collapsed to 1 and every attempt was admitted.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Hard ceiling on tracked keys. The keyspace of unauthenticated endpoints is
 * attacker-controlled, so an unbounded Map is a memory-exhaustion vector.
 * When the ceiling is hit the least recently useful keys are dropped, which
 * degrades those specific limits but keeps the process alive.
 */
const MAX_TRACKED_KEYS = 10_000;

function evictIfNeeded() {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  // Drop the keys closest to expiry first: they are the ones whose window is
  // about to reset anyway, so this frees memory at the lowest cost.
  const ordered = [...buckets.entries()].sort(
    (left, right) => left[1].resetAt - right[1].resetAt,
  );
  const dropCount = Math.max(1, Math.floor(MAX_TRACKED_KEYS / 10));
  for (let i = 0; i < dropCount && i < ordered.length; i += 1) {
    buckets.delete(ordered[i][0]);
  }
}

export type MemoryRateLimitDecision = {
  ok: boolean;
  retryAfterSeconds: number;
  /** Attempts recorded in the active window, including this one. */
  attempts: number;
};

export function consumeRateLimitWithCount(
  key: string,
  limit: number,
  windowMs: number,
): MemoryRateLimitDecision {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    // A new key enters the map on every unauthenticated request, so bound it.
    evictIfNeeded();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      attempts: 1,
    };
  }

  const attempts = current.count + 1;
  current.count = attempts;
  const ok = attempts <= limit;
  return {
    ok,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    attempts,
  };
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const decision = consumeRateLimitWithCount(key, limit, windowMs);
  return {
    ok: decision.ok,
    retryAfterSeconds: decision.retryAfterSeconds,
  };
}

/** Forget a key so a legitimate caller is not left near the ceiling. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test seam: drop every tracked key. */
export function resetAllRateLimits(): void {
  buckets.clear();
}