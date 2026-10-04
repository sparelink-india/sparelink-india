import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APP_AUTH_HOST,
  APP_AUTH_REDIRECT_ORIGIN,
  APP_AUTH_SCHEME,
  MAX_HANDOFF_CODE_MINUTES,
  ONE_TIME_TOKEN_EXPIRY_MINUTES,
  ONE_TIME_TOKEN_PARAM,
  ONE_TIME_TOKEN_STORE,
  UNAUTHENTICATED_FALLBACK_PATH,
  buildAppAuthRedirect,
  isAppAuthRedirect,
  markOneTimeTokenIssued,
  oneTimeTokenPluginOptions,
  readOneTimeTokenParam,
  resetIssuedOneTimeTokens,
  wasOneTimeTokenIssued,
} from "./mobile-auth-handoff";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const CALLBACK_PAGE = "app/auth/callback/page.tsx";
const AUTH_CONFIG = "lib/auth.ts";

describe("mobile auth handoff — plugin configuration", () => {
  beforeEach(() => resetIssuedOneTimeTokens());

  it("keeps the handoff code short-lived", () => {
    // A long-lived code in a URL is a long-lived credential in browser history,
    // OS intent logs and crash reports.
    assert.ok(
      ONE_TIME_TOKEN_EXPIRY_MINUTES <= MAX_HANDOFF_CODE_MINUTES,
      `expiresIn must be <= ${MAX_HANDOFF_CODE_MINUTES} minutes`,
    );
    assert.equal(oneTimeTokenPluginOptions().expiresIn, 3);
  });

  it("stores the code hashed so a database dump yields nothing redeemable", () => {
    assert.equal(ONE_TIME_TOKEN_STORE, "hashed");
    assert.equal(oneTimeTokenPluginOptions().storeToken, "hashed");
  });

  it("is actually wired into the Better Auth config", () => {
    const text = source(AUTH_CONFIG);
    assert.match(text, /oneTimeToken\(oneTimeTokenPluginOptions\(\)\)/);
    assert.match(text, /from "better-auth\/plugins"/);
  });

  it("does not weaken origin protection for the handoff", () => {
    // The app scheme must never become a trusted origin: any app can claim a
    // custom scheme, so trusting it would let a third-party app mint sessions.
    const text = source(AUTH_CONFIG);
    assert.ok(
      !/trustedOrigins/.test(text),
      "lib/auth.ts must not introduce trustedOrigins for the app scheme",
    );
    assert.ok(!text.includes(`${APP_AUTH_SCHEME}://`));
  });
});

describe("mobile auth handoff — redirect target", () => {
  beforeEach(() => resetIssuedOneTimeTokens());

  it("redirects to exactly sparelink://auth", () => {
    assert.equal(APP_AUTH_REDIRECT_ORIGIN, "sparelink://auth");
    assert.equal(
      buildAppAuthRedirect("abc123"),
      `sparelink://auth?${ONE_TIME_TOKEN_PARAM}=abc123`,
    );
    assert.ok(isAppAuthRedirect(buildAppAuthRedirect("abc123")));
  });

  it("refuses to build a redirect without a code", () => {
    assert.throws(() => buildAppAuthRedirect(""), /one-time token is required/i);
    // Whitespace-only must be rejected exactly like an empty one, otherwise a
    // blank value would produce a redirect the app cannot redeem.
    assert.throws(() => buildAppAuthRedirect("   "), /one-time token is required/i);
  });

  it("cannot be steered at another scheme or host by the code value", () => {
    // A hostile token value must stay inside the query string.
    const redirect = buildAppAuthRedirect("x&redirect=https://evil.example");
    assert.ok(redirect.startsWith(`${APP_AUTH_REDIRECT_ORIGIN}?`));
    const parsed = new URL(redirect);
    assert.equal(parsed.protocol, `${APP_AUTH_SCHEME}:`);
    assert.equal(parsed.host, APP_AUTH_HOST);
    assert.equal(parsed.searchParams.get(ONE_TIME_TOKEN_PARAM), "x&redirect=https://evil.example");
  });

  it("refuses a URL from any other scheme or host", () => {
    assert.equal(readOneTimeTokenParam("sparelink://auth?ott=abc"), "abc");
    assert.equal(readOneTimeTokenParam("https://sparelinkindia.com/auth/callback"), null);
    assert.equal(readOneTimeTokenParam("sparelink://evil?ott=abc"), null);
    assert.equal(readOneTimeTokenParam("sparelink://auth?ott="), null);
    assert.equal(readOneTimeTokenParam("sparelink://auth"), null);
    assert.equal(readOneTimeTokenParam("not a url"), null);
  });
});

describe("mobile auth handoff — callback page behaviour", () => {
  beforeEach(() => resetIssuedOneTimeTokens());

  it("requires a session and falls back to the WEB login without one", () => {
    const text = source(CALLBACK_PAGE);
    assert.match(text, /getServerSession\(\)/);
    assert.match(text, new RegExp(`redirect\\(UNAUTHENTICATED_FALLBACK_PATH\\)`));
    // The fallback is an ordinary WEB page, not the app.
    assert.equal(UNAUTHENTICATED_FALLBACK_PATH, "/login");
  });

  it("mints the code server-side and hands off through a redirect", () => {
    const text = source(CALLBACK_PAGE);
    assert.match(text, /auth\.api\.generateOneTimeToken\(/);
    assert.match(text, /buildAppAuthRedirect\(/);
    assert.match(text, /redirect\(handoffUrl\)/);
  });

  it("is never statically rendered or cached", () => {
    // The whole decision depends on the incoming session cookie.
    const text = source(CALLBACK_PAGE);
    assert.match(text, /export const dynamic = "force-dynamic"/);
  });

  it("never renders the code into HTML and never logs it", () => {
    const text = source(CALLBACK_PAGE);
    // No JSX at all: a component that returns markup could leak the code.
    assert.ok(!/<[A-Za-z]/.test(text), "callback page must not render markup");
    for (const forbidden of ["console.log", "console.info", "console.warn", "console.error"]) {
      assert.ok(!text.includes(forbidden), `callback page must not use ${forbidden}`);
    }
  });

  it("does not forward session data, cookies or secrets", () => {
    const text = source(CALLBACK_PAGE);
    for (const forbidden of [
      "set-cookie",
      "Set-Cookie",
      "cookies()",
      "session.user",
      "session.token",
      "accessToken",
      "refreshToken",
      "GOOGLE_CLIENT_SECRET",
    ]) {
      assert.ok(!text.includes(forbidden), `callback page must not reference ${forbidden}`);
    }
  });

  it("fails closed if code generation throws", () => {
    const text = source(CALLBACK_PAGE);
    assert.match(text, /catch\s*\{/);
    // The catch must also land on the safe fallback, never surface the code.
    const catchIndex = text.indexOf("catch {");
    const tail = text.slice(catchIndex);
    assert.match(tail, /redirect\(UNAUTHENTICATED_FALLBACK_PATH\)/);
  });
});

describe("mobile auth handoff — single use", () => {
  beforeEach(() => resetIssuedOneTimeTokens());

  it("tracks a code as issued so it cannot be handed off twice", () => {
    markOneTimeTokenIssued("code-1");
    assert.equal(wasOneTimeTokenIssued("code-1"), true);
    assert.equal(wasOneTimeTokenIssued("code-2"), false);
  });

  it("starts clean per process", () => {
    resetIssuedOneTimeTokens();
    assert.equal(wasOneTimeTokenIssued("code-1"), false);
  });
});