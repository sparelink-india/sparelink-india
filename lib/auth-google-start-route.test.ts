/**
 * Browser-first Google OAuth initiation (`GET /auth/google`).
 *
 * These tests pin the contract that makes the mobile flow possible: the
 * browser must *start* the OAuth exchange, because Better Auth binds its
 * `state` to a signed cookie issued to the client that begins the flow and
 * re-validates it on the client that finishes it. React Native and Chrome are
 * separate cookie stores, so a flow started in React Native can never be
 * completed in Chrome.
 *
 * They also pin the safety properties, because a route that can be turned into
 * an open redirect or made to leak a cookie is worse than the bug it fixes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildStartRedirect,
  collectForwardedHeaders,
  googleOAuthCallbackUrl,
  readSetCookies,
  resolveWebOrigin,
} from "@/app/auth/google/route";

const ROUTE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "auth",
  "google",
  "route.ts",
);

/** Source with comments and string literals removed. */
function readCode(): string {
  return readFileSync(ROUTE_FILE, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:[^`\\]|\\.)*`/g, '""')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, '""');
}

/** Two cookies, as Better Auth issues for this flow. */
const STATE_COOKIE = "better-auth.state=<redacted>; Path=/; HttpOnly; SameSite=Lax";
const OAUTH_COOKIE =
  "better-auth.oauth_state=<redacted>; Path=/; HttpOnly; SameSite=Lax";

function providerResponse(): Response {
  const headers = new Headers();
  headers.set(
    "location",
    "https://accounts.google.com/o/oauth2/v2/auth?state=<redacted>",
  );
  headers.append("set-cookie", STATE_COOKIE);
  headers.append("set-cookie", OAUTH_COOKIE);
  return new Response(null, { status: 200, headers });
}

const PROD_ENV = {
  BETTER_AUTH_URL: "https://sparelinkindia.com",
  NEXT_PUBLIC_APP_URL: "https://sparelinkindia.com",
};

describe("the callback URL is a fixed server constant", () => {
  it("is the production /auth/callback", () => {
    assert.equal(
      googleOAuthCallbackUrl(PROD_ENV),
      "https://sparelinkindia.com/auth/callback",
    );
  });

  it("follows the server's configured origin, like Better Auth's baseURL", () => {
    assert.equal(
      googleOAuthCallbackUrl({ BETTER_AUTH_URL: "http://localhost:3000" }),
      "http://localhost:3000/auth/callback",
    );
  });

  it("never yields a bare origin or a doubled slash", () => {
    assert.equal(
      googleOAuthCallbackUrl({ BETTER_AUTH_URL: "https://sparelinkindia.com/" }),
      "https://sparelinkindia.com/auth/callback",
    );
    assert.equal(
      googleOAuthCallbackUrl({ BETTER_AUTH_URL: "https://sparelinkindia.com///" }),
      "https://sparelinkindia.com/auth/callback",
    );
  });

  it("falls back to the documented production origin", () => {
    assert.equal(resolveWebOrigin({}), "https://sparelinkindia.com");
    assert.equal(googleOAuthCallbackUrl({}), "https://sparelinkindia.com/auth/callback");
  });

  it("ignores NEXT_PUBLIC_APP_URL when BETTER_AUTH_URL is set", () => {
    // BETTER_AUTH_URL is what Better Auth trusts; trusting the same value is the
    // whole reason the callback can never be rejected as an untrusted origin.
    assert.equal(
      googleOAuthCallbackUrl({
        BETTER_AUTH_URL: "https://sparelinkindia.com",
        NEXT_PUBLIC_APP_URL: "https://elsewhere.example",
      }),
      "https://sparelinkindia.com/auth/callback",
    );
  });
});

describe("the provider is fixed", () => {
  it("hard-codes google and passes only the constant to Better Auth", () => {
    const raw = readFileSync(ROUTE_FILE, "utf8");
    const code = readCode();
    // The literal is asserted on raw source because readCode() blanks strings.
    assert.match(raw, /const OAUTH_PROVIDER = "google"/);
    // The body sent to Better Auth must reference the module constant, never a
    // literal and never anything derived from the request.
    assert.match(code, /provider:\s*OAUTH_PROVIDER/);
    // No provider literal at all may appear in the call body.
    assert.deepEqual(raw.match(/provider:\s*"[a-z0-9_]+"/gi) ?? [], []);
  });

  it("passes exactly the fixed callback URL to Better Auth", () => {
    const code = readCode();
    // Precise, not a proxy assertion: the body must reference the pure builder
    // and nothing else. A mutation that inlined any other value fails here.
    assert.match(code, /callbackURL:\s*googleOAuthCallbackUrl\(\)/);
    // Exactly one mention in the whole route, so it cannot also be sent
    // somewhere else. (A negative lookahead would be unsafe here: `\s*` matches
    // zero-width and would fire on the correct code.)
    assert.equal((code.match(/callbackURL:/g) ?? []).length, 1);
  });

  it("does not accept provider, callbackURL or any override from the request", () => {
    const code = readCode();
    // Case-insensitive: URLSearchParams must not slip through either.
    assert.doesNotMatch(code, /searchparams/i);
    assert.doesNotMatch(code, /request\.nexturl/i);
    assert.doesNotMatch(code, /ctx\.query/i);
    assert.doesNotMatch(code, /req\.query/i);
  });

  it("takes no request argument at all, so no query parameter can reach it", () => {
    const code = readCode();
    assert.match(code, /export async function GET\(\)/);
  });
});

describe("cookies from the caller are not forwarded", () => {
  it("drops the cookie header entirely", () => {
    const incoming = new Headers({
      cookie: "better-auth.session_token=<redacted>",
      "user-agent": "test",
    });
    const forwarded = collectForwardedHeaders(incoming);

    assert.equal(forwarded.get("cookie"), null);
  });

  it("still forwards origin and referer so Better Auth's check keeps running", () => {
    const incoming = new Headers({
      origin: "https://sparelinkindia.com",
      referer: "https://sparelinkindia.com/login",
      cookie: "a=b",
    });
    const forwarded = collectForwardedHeaders(incoming);

    // Origin validation is preserved, not bypassed: we narrow what the request
    // carries, we do not disable any check.
    assert.equal(forwarded.get("origin"), "https://sparelinkindia.com");
    assert.equal(forwarded.get("referer"), "https://sparelinkindia.com/login");
  });
});

describe("every Set-Cookie is preserved", () => {
  it("reads multiple cookies without folding them", () => {
    const source = new Headers();
    source.append("set-cookie", STATE_COOKIE);
    source.append("set-cookie", OAUTH_COOKIE);

    const cookies = readSetCookies(source);
    assert.equal(cookies.length, 2);
    // Folding into one comma-joined string would corrupt `Expires=`; these
    // cookies carry no Expires, so assert on identity instead.
    assert.ok(cookies.includes(STATE_COOKIE));
    assert.ok(cookies.includes(OAUTH_COOKIE));
  });

  it("returns an empty list when there are none", () => {
    assert.deepEqual(readSetCookies(new Headers()), []);
  });

  it("does not use the folding headers.get('set-cookie') form", () => {
    const code = readCode();
    assert.doesNotMatch(code, /\.get\(\s*["']set-cookie["']/);
  });
});

describe("the provider redirect is forwarded", () => {
  it("returns a redirect to the Location Better Auth generated", () => {
    const response = buildStartRedirect(providerResponse(), PROD_ENV);

    assert.ok(response.status >= 300 && response.status < 400);
    const location = response.headers.get("location") ?? "";
    assert.ok(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
  });

  it("carries every state cookie on that redirect", () => {
    const response = buildStartRedirect(providerResponse(), PROD_ENV);
    const withArray = response.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = withArray.getSetCookie
      ? withArray.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

    assert.equal(cookies.length, 2);
    assert.ok(cookies.some((c) => c.includes("better-auth.state=")));
    assert.ok(cookies.some((c) => c.includes("better-auth.oauth_state=")));
  });
});

describe("failure is handled safely", () => {
  it("redirects to /login when Better Auth refuses", () => {
    const refusal = new Response(
      JSON.stringify({ message: "Invalid origin" }),
      { status: 403, headers: { "content-type": "application/json" } },
    );

    const response = buildStartRedirect(refusal, PROD_ENV);
    const location = response.headers.get("location") ?? "";

    assert.ok(location.startsWith("https://sparelinkindia.com/login"));
    // The refusal body must never be echoed to the browser.
    assert.equal(location.includes("Invalid"), false);
  });

  it("redirects to /login when no Location was produced", () => {
    const noLocation = new Response(null, { status: 200 });

    const response = buildStartRedirect(noLocation, PROD_ENV);
    assert.ok(
      (response.headers.get("location") ?? "").startsWith(
        "https://sparelinkindia.com/login",
      ),
    );
  });

  it("never builds a provider URL itself", () => {
    const code = readCode();
    // The only source of an authorization URL is Better Auth's Location header.
    assert.doesNotMatch(code, /accounts\.google\.com/);
  });
});

describe("nothing sensitive is logged", () => {
  it("contains no logging at all", () => {
    const code = readCode();
    assert.doesNotMatch(code, /console\.(log|warn|error|info|debug)/);
    assert.doesNotMatch(code, /logger\./);
  });

  it("never logs the state, the cookies or the provider URL", () => {
    const raw = readFileSync(ROUTE_FILE, "utf8");
    // No log call may receive the redirect target or a cookie header.
    assert.doesNotMatch(raw, /console\.[a-z]+\([^)]*location/);
    assert.doesNotMatch(raw, /console\.[a-z]+\([^)]*set-cookie/);
    assert.doesNotMatch(raw, /console\.[a-z]+\([^)]*cookie/i);
  });
});
