/**
 * Mobile Google-auth handoff — the seam between the WEB browser session and the
 * native app.
 *
 * Why this exists
 * ---------------
 * Google OAuth for mobile runs in a Chrome Custom Tab, so the resulting session
 * cookie lands in Chrome's cookie jar. React Native's fetch reads
 * `android.webkit.CookieManager` instead, and those two jars are separate: the
 * app cannot read a session the browser established. Copying the cookie or a
 * token across in a `sparelink://` URL would mean putting a live credential in
 * a URL, where it lands in browser history, OS intent logs and crash reports.
 *
 * So no credential crosses the boundary. Better Auth's `one-time-token` plugin
 * mints a short-lived, single-use code that resolves to the session server-side.
 * Only that code travels in the URL, and the app exchanges it over its own
 * `POST`, which returns a session cookie into the app's own jar.
 *
 * Security properties this module is responsible for:
 *   - the redirect target is fixed to `sparelink://auth` and nothing else;
 *   - the code is short-lived and single-use (enforced by the plugin, not here);
 *   - the code is stored hashed, so the database never holds a usable value;
 *   - no password, OAuth client secret, refresh token or session cookie is ever
 *     placed in the URL.
 */

/** Minutes a handoff code stays valid. Kept short: it is redeemed immediately. */
export const ONE_TIME_TOKEN_EXPIRY_MINUTES = 3;

/**
 * Hashed at rest. The raw code exists only in the redirect URL and in the
 * mobile app's memory; a database dump yields nothing redeemable.
 */
export const ONE_TIME_TOKEN_STORE = "hashed" as const;

/** The one redirect target this codebase is allowed to hand off to. */
export const APP_AUTH_SCHEME = "sparelink";
export const APP_AUTH_HOST = "auth";
export const APP_AUTH_REDIRECT_ORIGIN = `${APP_AUTH_SCHEME}://${APP_AUTH_HOST}`;

/** Query parameter carrying the handoff code. */
export const ONE_TIME_TOKEN_PARAM = "ott";

/**
 * Where an unauthenticated visit goes. Better Auth sends the browser here
 * immediately after the Google code exchange, so reaching this page without a
 * session means the exchange did not complete and there is nothing to hand off.
 */
export const UNAUTHENTICATED_FALLBACK_PATH = "/login";

/**
 * Plugin options, asserted by tests. `expiresIn` is bounded by
 * `MAX_HANDOFF_CODE_MINUTES` so a future edit cannot quietly turn a
 * three-minute code into a long-lived one.
 */
export const MAX_HANDOFF_CODE_MINUTES = 5;

export function oneTimeTokenPluginOptions(): {
  expiresIn: number;
  storeToken: typeof ONE_TIME_TOKEN_STORE;
} {
  return {
    expiresIn: ONE_TIME_TOKEN_EXPIRY_MINUTES,
    storeToken: ONE_TIME_TOKEN_STORE,
  };
}

/**
 * Builds the single permitted redirect target.
 *
 * The code is URL-encoded so it cannot break out of the query string, and the
 * scheme/host are constants rather than input, so no request-controlled value
 * can influence where the browser is sent.
 */
export function buildAppAuthRedirect(oneTimeToken: string): string {
  const value = oneTimeToken.trim();
  if (!value) {
    throw new Error("A one-time token is required to build the app handoff redirect.");
  }
  return `${APP_AUTH_REDIRECT_ORIGIN}?${ONE_TIME_TOKEN_PARAM}=${encodeURIComponent(value)}`;
}

/** True when `value` is a redirect this module produced. Used by tests. */
export function isAppAuthRedirect(value: string): boolean {
  return value.startsWith(`${APP_AUTH_REDIRECT_ORIGIN}?`);
}

/**
 * Extracts the handoff code from a handoff URL, or null when it is absent or
 * empty. The mobile app uses the same rule so both sides agree on what counts
 * as a usable code.
 */
export function readOneTimeTokenParam(handoffUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(handoffUrl);
  } catch {
    return null;
  }
  if (parsed.protocol.replace(":", "").toLowerCase() !== APP_AUTH_SCHEME) return null;
  if (parsed.host.toLowerCase() !== APP_AUTH_HOST) return null;
  const value = parsed.searchParams.get(ONE_TIME_TOKEN_PARAM);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Marks a code as spent so it cannot be redeemed twice in one process. The
 * plugin's `consumeVerificationValue` already deletes the record server-side;
 * this is defence in depth for the single page render that issues it.
 */
const issuedCodes = new Set<string>();

export function markOneTimeTokenIssued(oneTimeToken: string): void {
  issuedCodes.add(oneTimeToken.trim());
}

export function wasOneTimeTokenIssued(oneTimeToken: string): boolean {
  return issuedCodes.has(oneTimeToken.trim());
}

/** Test-only reset. */
export function resetIssuedOneTimeTokens(): void {
  issuedCodes.clear();
}