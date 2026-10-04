/**
 * Browser-first Google OAuth initiation for the native Android app.
 *
 * Why this route exists
 * ---------------------
 * Better Auth binds its OAuth `state` to a signed cookie issued by the client
 * that *starts* the flow, and re-validates that cookie on the client that
 * *completes* it (`state.mjs`: the database lookup succeeds, then the signed
 * `state` cookie must match or it throws `State mismatch`).
 *
 * React Native and Chrome are two separate cookie stores. When the app POSTed
 * `/api/auth/sign-in/social` itself, Better Auth issued the state cookie into
 * React Native's `android.webkit.CookieManager`, but Google redirected the
 * browser to `/api/auth/callback/google`, so Chrome presented no state cookie
 * and the exchange failed before `/auth/callback` was ever reached.
 *
 * This route removes the split: the browser starts the flow, so the browser
 * also finishes it. Nothing about Better Auth's state handling is relaxed.
 *
 * Security properties this route is responsible for:
 *   - the provider is a constant and the callback URL is a server-derived
 *     constant; neither is ever read from the request, so this endpoint cannot
 *     be turned into an open redirect or used to start a different provider;
 *   - no request parameter of any kind is forwarded to Better Auth;
 *   - the caller's cookies are deliberately NOT forwarded. This endpoint only
 *     *begins* an unauthenticated OAuth flow; it creates no session and reads no
 *     user state, so ambient authority is not needed and must not be exercised.
 *     `Origin`/`Referer` are still forwarded when present, so Better Auth's
 *     origin validation continues to run unchanged;
 *   - the state cookie value is never logged, and neither is the provider URL,
 *     which embeds the state.
 *
 * The handoff itself is unchanged: Better Auth completes the exchange, then
 * redirects to `/auth/callback`, which mints the one-time code and bounces to
 * `sparelink://auth`.
 */
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * The provider is fixed at the only provider SpareLink offers. A request can
 * never influence it.
 */
const OAUTH_PROVIDER = "google";

/**
 * Where Better Auth sends the browser once the code exchange completes. This
 * is the existing mobile handoff page; it is not modified by this route.
 */
const HANDOFF_PATH = "/auth/callback";

/** Used only if neither server variable is configured. */
const FALLBACK_WEB_ORIGIN = "https://sparelinkindia.com";

/**
 * Resolves the public WEB origin from server configuration only.
 *
 * This deliberately mirrors how `lib/auth.ts` derives Better Auth's `baseURL`,
 * so the callback URL is always on the same origin Better Auth already trusts.
 * Never reads from the request.
 */
export function resolveWebOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = (env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "").trim();
  const origin = configured.replace(/\/+$/, "");
  const resolved = origin || FALLBACK_WEB_ORIGIN;
  return resolved.replace(/\/+$/, "");
}

/** The one callback URL Better Auth is allowed to redirect to. */
export function googleOAuthCallbackUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return `${resolveWebOrigin(env)}${HANDOFF_PATH}`;
}

/**
 * Copies the caller's request headers for the Better Auth call, minus cookies.
 *
 * The cookie jar is the entire subject of this fix, so it is deliberately left
 * out: this endpoint must not depend on, or be authorised by, whatever session
 * the browser happens to already hold.
 */
export function collectForwardedHeaders(incoming: Headers): Headers {
  const forwarded = new Headers();
  incoming.forEach((value, key) => {
    if (key.toLowerCase() === "cookie") return;
    forwarded.append(key, value);
  });
  return forwarded;
}

/**
 * Reads every `Set-Cookie` value from a response.
 *
 * `headers.get("set-cookie")` folds multiple cookies into one comma-joined
 * string, which corrupts any `Expires=` attribute and would silently drop all
 * but one cookie. `getSetCookie()` returns them individually and is the only
 * safe way to forward them.
 */
export function readSetCookies(source: Headers): string[] {
  const withArray = source as Headers & { getSetCookie?: () => string[] };
  if (typeof withArray.getSetCookie === "function") {
    return withArray.getSetCookie();
  }
  const single = source.get("set-cookie");
  return single ? [single] : [];
}

/**
 * Turns Better Auth's response into the browser's redirect.
 *
 * Kept separate from the request plumbing so the cookie-forwarding and
 * failure rules can be verified directly. On success the browser is sent to the
 * provider carrying every cookie Better Auth issued; on any refusal the caller
 * is sent to `/login` and nothing about the failure is disclosed.
 */
export function buildStartRedirect(
  result: Response,
  env: Record<string, string | undefined> = process.env,
): NextResponse {
  const setCookies = readSetCookies(result.headers);
  const location = result.ok ? result.headers.get("location") : null;

  const response = NextResponse.redirect(
    location || `${resolveWebOrigin(env)}/login`,
  );
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

/**
 * GET /auth/google
 *
 * Starts Google's authorization flow inside the browser. Always answers with a
 * redirect: either to the provider, or to `/login` if Better Auth declined.
 * This handler reads nothing from the request except its headers, so no query
 * parameter can influence the provider, the callback, or the redirect target.
 */
export async function GET(): Promise<NextResponse> {
  const incoming = await headers();
  const forwarded = collectForwardedHeaders(incoming);

  try {
    const result = await auth.api.signInSocial({
      body: {
        provider: OAUTH_PROVIDER,
        callbackURL: googleOAuthCallbackUrl(),
      },
      asResponse: true,
      headers: forwarded,
    });
    return buildStartRedirect(result);
  } catch {
    // Never surface the provider URL, the state, or any cookie value here.
    return NextResponse.redirect(`${resolveWebOrigin()}/login`);
  }
}
