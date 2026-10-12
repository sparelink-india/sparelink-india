/**
 * Typesense ranking-query fallback for the parts search.
 *
 * WHY THIS EXISTS
 *   `GET /api/search/parts` first searches with ranking parameters
 *   (`query_by`, `query_by_weights`, `infix`, `num_typos`, `drop_tokens_threshold`).
 *   Some deployments reject that richer query shape, so the route retries once
 *   with plain default parameters.
 *
 * THE DEFECT THIS FIXES
 *   The retry was previously written as a bare `catch { result = await search(...) }`.
 *   That catch fired for EVERY error, and the retry itself sat outside any
 *   try/catch. So a genuine infrastructure failure - bad API key (401), missing
 *   `parts` collection (404), Typesense 5xx, or a socket timeout - was retried
 *   with different parameters, failed a second time, and propagated out of the
 *   route as an opaque HTTP 500. The second failure was never the search's fault,
 *   and the original error was discarded by the outer handler.
 *
 *   This module keeps the fallback for the one error class it can actually help
 *   with, and lets every other error propagate immediately as an honest failure.
 *
 * ERROR TAXONOMY (not invented - read off the installed client)
 *   node_modules/typesense/lib/Typesense/ApiCall.js, `customErrorForResponse`:
 *
 *     HTTP 400 -> RequestMalformed     HTTP 404 -> ObjectNotFound
 *     HTTP 401 -> RequestUnauthorized  HTTP 409 -> ObjectAlreadyExists
 *     HTTP 422 -> ObjectUnprocessable  HTTP 5xx -> ServerError
 *     anything else -> HTTPError      transport/timeout -> TypesenseError (no httpStatus)
 *
 *   `TypesenseError`'s constructor assigns `this.name` to the concrete subclass
 *   name, so `error.name` is the reliable discriminator.
 *
 *   RANKABLE  (the server rejected THIS query's parameters; retrying with the
 *              plain default shape can plausibly succeed): 400, 422.
 *   INFRA     (retrying cannot help - do not mask it): 401, 403, 404, 409,
 *              429, 5xx, and any transport-level error with no httpStatus.
 */

/** Error subclass names for a query the server rejected because of its shape. */
const RANKABLE_ERROR_NAMES: ReadonlySet<string> = new Set([
  "RequestMalformed", // HTTP 400
  "ObjectUnprocessable", // HTTP 422
]);

/** HTTP statuses that mean "this query was rejected", not "the service is down". */
const RANKABLE_STATUSES: ReadonlySet<number> = new Set([400, 422]);

type ErrorShape = {
  name?: unknown;
  httpStatus?: unknown;
};

/**
 * True only when retrying without the ranking parameters could plausibly help.
 *
 * Infrastructure failures are deliberately NOT rankable, so they surface as
 * failures instead of being retried into an opaque 500.
 */
export function isRankableQueryError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const { name, httpStatus } = error as ErrorShape;

  if (typeof name === "string" && RANKABLE_ERROR_NAMES.has(name)) return true;

  // Secondary signal, from the same error object, for a Typesense build that
  // does not subclass per status. Only 400/422 qualify.
  if (typeof httpStatus === "number" && RANKABLE_STATUSES.has(httpStatus)) return true;

  return false;
}

/**
 * Run `search` with the richer ranking parameters, and retry exactly once with
 * the plain defaults **only** when the failure is a rankable-query rejection.
 *
 * Guarantees:
 *   - at most one fallback attempt, never an unbounded retry;
 *   - infrastructure failures propagate on the first throw, unchanged;
 *   - a failing fallback propagates too - this never converts a failure into a
 *     successful or empty result.
 */
export async function searchWithRankingFallback<T>(
  search: (params: Record<string, unknown>) => Promise<T>,
  defaultParams: Record<string, unknown>,
  rankedParams: Record<string, unknown>,
): Promise<T> {
  try {
    return await search(rankedParams);
  } catch (error) {
    if (!isRankableQueryError(error)) throw error;
    return await search(defaultParams);
  }
}
