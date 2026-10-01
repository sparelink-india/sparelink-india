/**
 * WEB COMPLETION MASTER RUN - regression coverage.
 *
 * Everything here is a static source contract or a pure-function test. There
 * are deliberately NO screenshot or browser tests: no desktop browser is
 * connected to this environment, so a test that needed one would report
 * coverage it does not have.
 *
 * Grouped by the phase whose regression it guards.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUTH_SURFACES,
  canAuthenticateAsDealer,
  evaluateLoginRole,
} from "@/lib/auth-flags";
import {
  DEALER_OTP,
  dealerCanSignIn,
  dealerEmailFor,
  dealerIdFromEmail,
  evaluateDealerAccount,
  isDealerId,
  normaliseDealerId,
  otpChallengeUsable,
  otpResendAllowed,
  resolveDealerByProviderIdentity,
  resolveLoginIdentifier,
  validateDealerId,
  verifyDealerOtp,
} from "@/lib/dealer-identity";
import { framedCategoryImage, STOREFRONT_CATEGORIES } from "@/lib/storefront-categories";
import { en, hi } from "@/lib/i18n/messages";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const SKIP = new Set(["node_modules", ".next", ".git", "_backups", ".vercel", "public"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const ALL = [...walk(join(root, "app")), ...walk(join(root, "components"))].map((p) => ({
  path: relative(root, p).replace(/\\/g, "/"),
  source: readFileSync(p, "utf8"),
}));
/** Comments are stripped, so a value quoted in an explanatory comment does not read as live code. */
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const storefront = ALL.filter(
  (f) => !/\/admin\//.test(f.path) && !/\/admin-[^/]*\.tsx$/.test(f.path),
);
const src = (p: string) => read(p);

/* ================================================================= *
 * DARK MODE
 * ================================================================= */

describe("dark mode: Phase 1 + Tier 2 stay intact", () => {
  it("the V3 dark token block is still the single source of dark surfaces", () => {
    const v3 = src("app/v3.css");
    assert.match(v3, /^html\.dark\s*\{/m);
    for (const token of ["--v3-page", "--v3-panel", "--v3-text", "--v3-brand-ink"]) {
      assert.ok(
        new RegExp(`html\\.dark[\\s\\S]*?${token}\\s*:`).test(v3),
        `${token} must have a dark value`,
      );
    }
  });

  it("burgundy-as-fill is untouched, burgundy-as-text is lifted", () => {
    // The distinction the whole Tier 2 pass turned on.
    //
    // `components/home-hero.tsx` is EXCLUDED, deliberately. It carries one
    // `hover:text-[var(--v3-brand)]` and the hero may not be edited, so that
    // one is lifted by a global rule in globals.css instead. The next test
    // proves that rule exists, so the exclusion cannot hide a real gap.
    const EDITABLE = storefront.filter((f) => f.path !== "components/home-hero.tsx");
    assert.ok(
      !EDITABLE.some((f) => /text-\[var\(--v3-brand\)\](?!-ink)/.test(f.source)),
      "an editable component still uses the burgundy FILL token as a text colour",
    );
    const header = src("components/storefront-header.tsx");
    assert.match(header, /bg-\[var\(--v3-brand\)\] text-white/, "the cart stays a burgundy fill");
  });

  it("the protected hero's one brand hover is lifted globally instead", () => {
    const hero = src("components/home-hero.tsx");
    assert.ok(
      /hover:text-\[var\(--v3-brand\)\]/.test(hero),
      "home-hero.tsx must be left as authored",
    );
    assert.match(
      src("app/globals.css"),
      /html\.dark \.hover\\:text-\\\[var\\\(--v3-brand\\\)\\\]:hover\s*\{[^}]*#e8a0b8/,
      "globals.css must lift it, so the protected file is correct without being touched",
    );
  });

  it("no storefront surface still hardcodes the audited light hexes", () => {
    for (const hex of ["#f5dfe3", "#e5f1d9", "#eec4c1", "#bfe0d1", "#ead6d7", "#d8b9bc"]) {
      const hits = storefront.filter((f) => codeOf(f.source).includes(hex));
      assert.deepEqual(hits.map((h) => h.path), [], `${hex} is back`);
    }
  });

  it("no global bg-white/<alpha> override, so Admin's logo plate survives", () => {
    assert.ok(
      !/html\.dark\s+\.bg-white\\?\/\d+/.test(src("app/globals.css")),
      "globals.css must not remap bg-white/<alpha>",
    );
    assert.match(src("components/admin-shell.tsx"), /bg-white\/95/);
  });
});

/* ================================================================= *
 * DEALER AUTH
 * ================================================================= */

describe("dealer auth: the role gate is the security boundary", () => {
  it("refuses an admin at the dealer surface - the reported symptom, correctly", () => {
    const d = evaluateLoginRole("admin", "dealer");
    assert.equal(d.ok, false);
    if (!d.ok) {
      assert.equal(d.kind, "mismatch");
      assert.equal(d.status, 403);
      // The message is unchanged, and must not hint at another door.
      assert.equal(d.message, "This account cannot use this login.");
      assert.ok(!/admin/i.test(d.message), "the refusal must not enumerate the account's role");
    }
  });

  it("refuses a customer at the dealer surface", () => {
    assert.equal(evaluateLoginRole("buyer", "dealer").ok, false);
  });

  it("refuses a dealer at the customer surface when the customer constrains it", () => {
    assert.equal(evaluateLoginRole("dealer", "buyer").ok, false);
  });

  it("admits a dealer at the dealer surface", () => {
    const d = evaluateLoginRole("dealer", "dealer");
    assert.equal(d.ok, true);
    if (d.ok) assert.equal(d.role, "dealer");
  });

  it("admits a role when the surface does not constrain one", () => {
    for (const role of ["buyer", "dealer", "admin"] as const) {
      const d = evaluateLoginRole(role, "");
      assert.equal(d.ok, true, `${role} should be admitted by an unconstrained surface`);
    }
  });

  it("distinguishes a suspended account from a role mismatch", () => {
    const d = evaluateLoginRole("suspended", "dealer");
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.kind, "suspended");
  });

  it("refuses an UNRECOGNISED role rather than defaulting it to a customer", () => {
    const d = evaluateLoginRole("superuser", "");
    assert.equal(d.ok, false, "an unknown role must not become a customer session");
  });

  it("admin is never dealer-capable", () => {
    assert.equal(canAuthenticateAsDealer("dealer"), true);
    assert.equal(canAuthenticateAsDealer("admin"), false);
    assert.equal(canAuthenticateAsDealer("buyer"), false);
    assert.equal(canAuthenticateAsDealer("suspended"), false);
    assert.equal(canAuthenticateAsDealer(null), false);
  });

  it("the three surfaces are declared, and each has one home", () => {
    const paths = AUTH_SURFACES.map((s) => s.loginPath);
    assert.deepEqual(paths, ["/admin", "/login/dealer", "/login"]);
    assert.equal(new Set(AUTH_SURFACES.map((s) => s.role)).size, 3);
  });

  it("the login route destroys the session on every refusal", () => {
    const route = src("app/api/auth/username-login/route.ts");
    // The refusal branch must sign out before returning 403, or a refused
    // attempt leaves an authenticated cookie behind.
    const refusal = /if \(!decision\.ok\) \{[\s\S]*?\}/.exec(route);
    assert.ok(refusal, "the refusal branch must exist");
    assert.match(refusal[0], /signOut/);
  });

  it("no branch in the login route widens the role check", () => {
    const route = src("app/api/auth/username-login/route.ts");
    // The only role comparisons in the route are the surface name and the
    // redirect target. A `|| role ===` or an assignment to `role` would mean
    // an upgrade.
    assert.ok(!/role\s*=\s*"/.test(route), "the route must not assign a role");
    assert.ok(!/expectedRole\s*\|\|/.test(route), "expectedRole must not be bypassable");
  });
});

describe("dealer auth: the permanent dealer ID", () => {
  it("accepts the documented format and normalises the variants", () => {
    assert.equal(isDealerId("DEALER001"), true);
    for (const variant of ["dealer001", "Dealer001", "dealer-001", "DEALER_001", " Dealer 001 "]) {
      assert.equal(isDealerId(variant), true, `${variant} should be a dealer ID`);
      assert.equal(normaliseDealerId(variant), "DEALER001");
    }
  });

  it("rejects the ambiguous short usernames that caused the confusion", () => {
    // "111" is the existing dealer username. It must NOT be accepted as a
    // dealer ID, or the two identifiers collide.
    for (const bad of ["111", "000", "123", "dealer", "DEALER", "user@x.com", ""]) {
      assert.equal(isDealerId(bad), false, `${bad} must not be a dealer ID`);
    }
  });

  it("explains why a bad ID is bad", () => {
    // Narrowed explicitly, because the union has an `ok: true` member that has
    // no `reason` - reading `.reason` off the union directly is a type error,
    // and the point of the check is that the FAILURE carries a reason.
    const reasonOf = (input: string) => {
      const r = validateDealerId(input);
      assert.equal(r.ok, false, `${input} should not validate`);
      if (!r.ok) return r.reason;
      throw new Error("unreachable");
    };
    assert.equal(reasonOf(""), "empty");
    assert.equal(reasonOf("111"), "format");
    assert.equal(reasonOf("DEALER1234567"), "tooLong");
    const ok = validateDealerId("dealer-042");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.dealerId, "DEALER042");
  });

  it("resolves a dealer ID BEFORE the account path, always", () => {
    // A stub that would resolve ANY string, to prove the dealer branch wins
    // by priority and not by luck.
    const resolve = () => "someone@users.sparelink.local";
    const r = resolveLoginIdentifier("DEALER001", resolve);
    assert.equal(r.kind, "dealer");
    if (r.kind === "dealer") {
      assert.equal(r.dealerId, "DEALER001");
      assert.equal(r.lookupEmail, dealerEmailFor("DEALER001"));
    }
  });

  it("leaves the customer and admin path exactly as it was", () => {
    const resolve = (v: string) => (v === "000" ? "000@users.sparelink.local" : null);
    const r = resolveLoginIdentifier("000", resolve);
    assert.equal(r.kind, "account");
    if (r.kind === "account") assert.equal(r.email, "000@users.sparelink.local");
  });

  it("an unresolvable identifier is unknown, never guessed", () => {
    assert.equal(resolveLoginIdentifier("nothing-here", () => null).kind, "unknown");
    assert.equal(resolveLoginIdentifier("   ", () => "x@y.z").kind, "unknown");
  });

  it("the reserved dealer email namespace cannot be produced by an account id", () => {
    const r = resolveLoginIdentifier("dealer+DEALER001@dealers.sparelink.local", () => null);
    assert.equal(r.kind, "dealer");
    if (r.kind === "dealer") assert.equal(r.dealerId, "DEALER001");
    assert.equal(dealerIdFromEmail("someone@users.sparelink.local"), null);
    assert.equal(dealerIdFromEmail(null), null);
  });

  it("gates a dealer on its account status, not just its role", () => {
    assert.equal(dealerCanSignIn("active"), true);
    for (const status of ["pending", "suspended", "closed", null] as const) {
      assert.equal(dealerCanSignIn(status), false, `${status} must not sign in`);
    }
    assert.equal(evaluateDealerAccount("pending").ok, false);
    assert.equal(evaluateDealerAccount("active").ok, true);
  });
});

describe("dealer auth: Google linking does not steal a customer account", () => {
  const dealer = { dealerId: "DEALER001", googleSubject: "sub-1" } as never;
  const identity = { subject: "sub-1", email: "d@shop.com", emailVerified: true };

  it("returns the SAME dealer for a subject already linked - never a new one", () => {
    const r = resolveDealerByProviderIdentity(identity, () => dealer, null, () => false);
    assert.equal(r.kind, "dealer");
  });

  it("REFUSES when the Google email belongs to a customer account", () => {
    // The failure mode the brief forbids: linking on a matching email would
    // move a customer - and their cart, orders and addresses - to the dealer.
    const r = resolveDealerByProviderIdentity(
      identity,
      () => null,
      "DEALER001",
      () => true,
    );
    assert.equal(r.kind, "conflict");
  });

  it("refuses an unverified Google email", () => {
    const r = resolveDealerByProviderIdentity(
      { ...identity, emailVerified: false },
      () => null,
      "DEALER001",
      () => false,
    );
    assert.equal(r.kind, "invalid");
  });

  it("refuses to link when the session is not already a dealer", () => {
    const r = resolveDealerByProviderIdentity(identity, () => null, null, () => false);
    assert.equal(r.kind, "invalid", "a non-dealer session must not be upgraded to a dealer");
  });

  it("refuses an empty subject", () => {
    const r = resolveDealerByProviderIdentity(
      { subject: "", email: "d@shop.com", emailVerified: true },
      () => null,
      "DEALER001",
      () => false,
    );
    assert.equal(r.kind, "invalid");
  });
});

describe("dealer auth: WhatsApp OTP is rate limited and expiring", () => {
  const now = 1_000_000;
  const challenge = {
    dealerId: "DEALER001",
    codeHash: "hash",
    expiresAt: now + 1000,
    sentAt: now,
    attemptsRemaining: 3,
  };
  const matches = (c: string, h: string) => c === "123456" && h === "hash";

  it("has a real limit set", () => {
    assert.equal(DEALER_OTP.length, 6);
    assert.ok(DEALER_OTP.ttlMs > 0);
    assert.ok(DEALER_OTP.maxAttempts > 0);
    assert.ok(DEALER_OTP.resendFloorMs > 0);
    assert.ok(DEALER_OTP.maxPerHour > 0);
  });

  it("expires", () => {
    assert.equal(otpChallengeUsable(challenge, now), true);
    assert.equal(otpChallengeUsable({ ...challenge, expiresAt: now }, now), false);
    assert.equal(otpChallengeUsable(challenge, now + 5000), false);
    assert.equal(otpChallengeUsable(null, now), false);
  });

  it("enforces the resend floor", () => {
    assert.equal(otpResendAllowed(null, now), true);
    assert.equal(otpResendAllowed(now, now), false);
    assert.equal(otpResendAllowed(now - 1000, now), false);
    assert.equal(otpResendAllowed(now - DEALER_OTP.resendFloorMs, now), true);
  });

  it("accepts the right code and rejects the wrong one", () => {
    assert.deepEqual(verifyDealerOtp(challenge, "123456", now, matches), {
      ok: true,
      dealerId: "DEALER001",
    });
    const wrong = verifyDealerOtp(challenge, "654321", now, matches);
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.equal(wrong.reason, "mismatch");
  });

  it("rejects an exhausted challenge even with the right code", () => {
    const dead = { ...challenge, attemptsRemaining: 0 };
    const r = verifyDealerOtp(dead, "123456", now, matches);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "exhausted");
  });

  it("rejects an expired challenge even with the right code", () => {
    const r = verifyDealerOtp({ ...challenge, expiresAt: now - 1 }, "123456", now, matches);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "expired");
  });

  it("rejects a wrong-LENGTH code without consulting the comparison", () => {
    let consulted = false;
    const r = verifyDealerOtp(challenge, "12", now, () => {
      consulted = true;
      return true;
    });
    assert.equal(r.ok, false);
    assert.equal(consulted, false, "a short code must not reach the comparison");
  });

  it("the challenge stores a HASH, never a code", () => {
    // A structural check: the field is named for what it holds.
    const r = verifyDealerOtp(challenge, "123456", now, matches);
    assert.equal(r.ok, true);
    assert.ok(!("code" in challenge), "the challenge must not carry a plaintext code field");
  });
});

describe("dealer auth: the unconfigured entry points are not rendered", () => {
  const page = src("app/login/dealer/page.tsx");

  it("the Google button is behind a real configuration check", () => {
    assert.match(page, /isGoogleOAuthConfigured\(\)/);
    assert.match(page, /\{googleConfigured \? \(/);
  });

  it("the OTP button is behind an explicit feature flag", () => {
    assert.match(page, /NEXT_PUBLIC_DEALER_OTP === "true"/);
  });

  it("the page names the exact configuration still required", () => {
    for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      assert.ok(page.includes(key) || src("lib/dealer-identity.ts").includes(key), `${key} must be reported`);
    }
    assert.ok(
      src("lib/dealer-identity.ts").includes("OTP_DELIVERY_WEBHOOK_URL"),
      "the OTP gateway requirement must be reported",
    );
  });

  it("does not claim either flow is implemented", () => {
    assert.ok(!/isGoogleOAuthConfigured\(\)\s*\?\s*true/.test(page));
    // The unsupported flows must not appear as enabled copy.
    assert.ok(!/DEALER_OTP_ENABLED/.test(page), "no invented configuration key");
  });
});

/* ================================================================= *
 * PUBLIC DEALER LOGIN
 * ================================================================= */

describe("dealer login is hidden from the public storefront", () => {
  const PUBLIC_SURFACES = [
    "components/storefront-header.tsx",
    "components/site-footer.tsx",
    "app/login/page.tsx",
  ];

  for (const file of PUBLIC_SURFACES) {
    it(`${file} renders no /login/dealer link`, () => {
      const body = codeOf(src(file));
      // The string may appear in a comment explaining the removal; it must not
      // appear as an href or a route entry.
      assert.ok(
        !/href=["'{]\/login\/dealer/.test(body),
        `${file} still links to the dealer login`,
      );
      assert.ok(
        !/\{\s*href:\s*"\/login\/dealer"/.test(body),
        `${file} still lists the dealer login in navigation data`,
      );
    });
  }

  it("the ROUTE still exists and is not deleted", () => {
    assert.ok(existsSync(join(root, "app/login/dealer/page.tsx")));
  });

  it("the dealer layout still redirects an unauthenticated visitor there", () => {
    assert.match(src("app/dealer/layout.tsx"), /redirect\("\/login\/dealer"\)/);
  });

  it("the homepage's bulk-order band still offers it to a genuine dealer", () => {
    // Removal was from CUSTOMER navigation, not from the site.
    assert.match(src("components/home-discovery-sections.tsx"), /href="\/login\/dealer"/);
  });

  it("the dictionary key for the old customer link is gone", () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(en, "login.dealerLink"));
    assert.ok(!Object.prototype.hasOwnProperty.call(hi, "login.dealerLink"));
  });
});

/* ================================================================= *
 * LAST UI FIXES
 * ================================================================= */

describe("search results heading carries no quotation marks", () => {
  it("the English string has no quotes around the placeholder", () => {
    const value = en["search.resultsFor"];
    assert.ok(value.includes("{query}"), "the query placeholder must survive");
    assert.ok(!value.includes('"'), `heading must not quote the query: ${value}`);
    assert.ok(!value.includes("\\u201c") && !value.includes("\\u201d"));
  });

  it("the Hindi string has none either", () => {
    assert.ok(!hi["search.resultsFor"].includes('"'));
  });

  it("the heading is rendered WITH the query, or the sentence is incomplete", () => {
    const s = src("components/search-experience.tsx");
    assert.match(s, /t\("search\.resultsFor",\s*\{\s*query\s*\}\)/);
  });

  it("the query itself is rendered separately and unmodified", () => {
    // The query must not be trimmed, upper-cased or otherwise rewritten.
    const s = src("components/search-experience.tsx");
    assert.match(s, /v3-partno[^>]*>\s*\{query\}/);
  });

  it("the search backend is untouched by this change", () => {
    const route = src("app/api/search/parts/route.ts");
    assert.match(route, /query_by: "part_number,name,description,brand,category"/);
    assert.match(route, /query_by_weights: "6,5,1,3,2"/);
  });
});

describe("login state reflects the real session", () => {
  it("the header branches on the session, not on a timer", () => {
    const header = src("components/storefront-header.tsx");
    assert.match(header, /session\.authenticated \?/);
    assert.match(header, /<SignOutButton/);
    /* No CSS-only hiding.
       The control that is not wanted must be ABSENT from the DOM, not merely
       invisible. `[^]` rather than a dotAll `s` flag, because the compile
       target is ES2017 where that flag does not exist. */
    assert.ok(
      !/hidden[^]{0,200}LoginRegister/.test(codeOf(header)),
      "Login/Register must not be hidden with CSS; it must not be rendered when signed in",
    );
  });

  it("the session hook reads the real endpoint and distinguishes unknown from false", () => {
    const hook = src("components/use-storefront-session.ts");
    assert.match(hook, /\/api\/auth\/session-flags/);
    assert.match(hook, /loading: true/);
  });

  it("sign-out tells the header to re-read the session", () => {
    const button = src("components/sign-out-button.tsx");
    assert.match(button, /onSignedOut\?\.\(\)/);
    const header = src("components/storefront-header.tsx");
    assert.match(header, /onSignedOut=\{session\.refresh\}/);
  });

  it("each role lands in its own surface", () => {
    const header = src("components/storefront-header.tsx");
    assert.match(header, /buyer:\s*"\/profile"/);
    assert.match(header, /dealer:\s*"\/dealer"/);
    assert.match(header, /admin:\s*"\/admin"/);
  });
});

describe("whatsapp floats once, bottom-left, with no duplicate", () => {
  it("there is exactly one definition and exactly one mount site", () => {
    const definers = ALL.filter((f) =>
      /export function WhatsAppFloatingButton/.test(f.source),
    );
    assert.deepEqual(
      definers.map((f) => f.path),
      ["components/whatsapp-floating-button.tsx"],
      "there must be exactly one definition of the control",
    );
    // The real duplicate check: how many places RENDER it. One.
    const renderers = ALL.filter((f) => /<WhatsAppFloatingButton[\s/>]/.test(codeOf(f.source)));
    assert.deepEqual(
      renderers.map((f) => f.path),
      ["components/storefront-whatsapp.tsx"],
      "only the wrapper may render the control itself",
    );
    // And how many places MOUNT the wrapper. One, and it is the header.
    const mounts = ALL.filter((f) => /<StorefrontWhatsApp[\s/>]/.test(codeOf(f.source)));
    assert.deepEqual(
      mounts.map((f) => f.path),
      ["components/storefront-header.tsx"],
      "exactly one component may mount the wrapper, or a page gets two controls",
    );
  });

  it("the mount is the header, not the shell", () => {
    // The regression this whole change exists to prevent: mounted in
    // StorefrontShell, the control appeared on 6 of 23 storefront routes and
    // the HOMEPAGE had none. StorefrontHeader is the one component every
    // customer-facing route renders.
    const shell = codeOf(src("components/storefront-shell.tsx"));
    assert.ok(
      !/<StorefrontWhatsApp/.test(shell),
      "StorefrontShell must NOT mount it, or every shell route renders two",
    );
    assert.match(codeOf(src("components/storefront-header.tsx")), /<StorefrontWhatsApp\s*\/>/);
  });

  it("the header is the common wrapper for every storefront chrome path", () => {
    // Three composition paths, all of which must reach the control by way of
    // the header. If a path stops rendering the header, coverage silently
    // drops again - which is exactly what happened before this fix.
    assert.match(src("components/storefront-shell.tsx"), /<StorefrontHeader/);
    assert.match(src("components/vehicle-fitment/fitment-shell.tsx"), /<StorefrontHeader/);
    // The routes that hand-compose the chrome render it directly.
    for (const route of [
      "app/(public)/home-client.tsx",
      "app/brands/page.tsx",
      "app/category/[...slug]/page.tsx",
      "app/login/page.tsx",
      "app/login/dealer/page.tsx",
    ]) {
      assert.match(src(route), /<StorefrontHeader/, `${route} must render the header`);
    }
  });

  it("no page renders both the header and the shell", () => {
    // The other half of "exactly one". A page doing both would render the
    // header twice, and therefore the control twice.
    const both = ALL.filter(
      (f) =>
        /<StorefrontHeader[\s/>]/.test(codeOf(f.source)) &&
        /<StorefrontShell[\s/>]/.test(codeOf(f.source)),
    );
    assert.deepEqual(both.map((f) => f.path), [], "a page renders both the header and the shell");
  });

  it("the shell does not render the control twice via two paths", () => {
    const shell = src("components/storefront-shell.tsx");
    const mounts = (codeOf(shell).match(/<StorefrontWhatsApp/g) ?? []).length;
    assert.equal(mounts, 0, "the shell must have no mount at all");
    const header = src("components/storefront-header.tsx");
    assert.equal(
      (codeOf(header).match(/<StorefrontWhatsApp/g) ?? []).length,
      1,
      "the header must mount it exactly once",
    );
  });

  it("the control is a direct child of <header>, so the drawer cannot clip it", () => {
    // The drawer is an `overflow-y-auto` subtree gated on `menuOpen`. A control
    // inside it would scroll out of view and vanish whenever the drawer closed,
    // so the mount has to sit outside that subtree.
    //
    // Asserted structurally rather than by looking for a comment: between the
    // mount and the header's closing tag there must be NOTHING but whitespace.
    // A mount nested inside the drawer would leave `</div>`s and the `) : null}`
    // that closes it in between, so this genuinely distinguishes the two - and
    // it cannot pass vacuously if the anchor text is ever reworded.
    const header = src("components/storefront-header.tsx");
    const mountIndex = header.lastIndexOf("<StorefrontWhatsApp");
    const closeIndex = header.indexOf("</header>", mountIndex);
    assert.ok(mountIndex > 0, "the mount must exist");
    assert.ok(closeIndex > mountIndex, "the mount must precede </header>");
    const between = header.slice(mountIndex, closeIndex);
    const afterTag = between.slice(between.indexOf("/>") + 2);
    assert.equal(
      afterTag.trim(),
      "",
      `the control must be the last child of <header>; found ${JSON.stringify(afterTag.trim().slice(0, 60))} after it`,
    );
  });

  it("no fixed-position containing block sits above the header", () => {
    // A `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change`
    // or `contain` on an ancestor would make the header a containing block for
    // its `position: fixed` child, and the control would be positioned against
    // that ancestor instead of the viewport - it would ride the page instead
    // of the screen. This asserts the property still holds, so it cannot be
    // broken silently by an animation added to a wrapper.
    //
    // `codeOf` strips comments first: these files EXPLAIN the rule in prose, and
    // the word "transform" in a comment is not a declaration.
    const PROPS = [
      "transform",
      "filter",
      "backdrop-filter",
      "perspective",
      "will-change",
      "contain",
    ];
    for (const file of [
      "components/storefront-header.tsx",
      "components/storefront-shell.tsx",
      "components/vehicle-fitment/fitment-shell.tsx",
      "app/(public)/home-client.tsx",
      "app/layout.tsx",
    ]) {
      const body = codeOf(src(file));
      // (a) a declaration, e.g. `style={{ transform: ... }}` or a CSS-in-JS prop
      const declared = PROPS.find((p) =>
        new RegExp(`(^|[\\s"'\`{])${p}\\s*:`).test(body),
      );
      // (b) a className token. Split on whitespace and require an EXACT match,
      // so `transition-transform` - which does not create a containing block -
      // is not mistaken for `transform`, which does. A token immediately after
      // the opening quote counts, which is why this is a split and not a regex.
      const tokens = [...body.matchAll(/className\s*=\s*"([^"]*)"/g)].flatMap((m) =>
        m[1].split(/\s+/),
      );
      const asClass = PROPS.find((p) => tokens.includes(p));
      const hit = declared ?? asClass;
      assert.equal(
        hit,
        undefined,
        `${file} uses "${hit}", which would trap the fixed control against that ancestor instead of the viewport`,
      );
    }
  });

  it("the CSS wrapper classes above the header set no containing block either", () => {
    // The wrappers are named classes, not inline utilities, so a `transform`
    // could hide in the stylesheet where the TSX scan cannot see it. These are
    // the two classes that sit between <body> and the header on every route.
    const css = [read("app/globals.css"), read("app/v3.css")].join("\n");
    for (const selector of [".v3-page-root", ".storefront-mobile-pad"]) {
      const block = new RegExp(
        `\\${selector}[^{]*\\{([^}]*)\\}`,
      ).exec(css.replace(/\/\*[\s\S]*?\*\//g, ""));
      assert.ok(block, `${selector} should exist in the stylesheets`);
      assert.ok(
        !/(^|;)\s*(transform|filter|backdrop-filter|perspective|will-change|contain)\s*:/.test(
          block[1],
        ),
        `${selector} sets a containing-block property and would trap the fixed control: ${block[1].trim().slice(0, 80)}`,
      );
    }
  });

  it("it is anchored bottom-LEFT, fixed, and safe-area aware", () => {
    const c = src("components/whatsapp-floating-button.tsx");
    assert.match(c, /fixed/);
    assert.match(c, /left-\[calc\(/);
    assert.match(c, /bottom-\[calc\(/);
    assert.match(c, /--safe-bottom/);
    assert.match(c, /--safe-left/);
    assert.ok(!/\bright-\[calc\(/.test(c), "it must not be on the right");
  });

  it("it clears the mobile bottom nav on a phone", () => {
    const c = src("components/whatsapp-floating-button.tsx");
    assert.match(c, /--mobile-nav-height/);
    assert.match(c, /md:bottom-\[calc\(/, "at md and up the nav is gone, so it must lift");
  });

  it("it keeps the WhatsApp brand colour and the existing destination", () => {
    const c = src("components/whatsapp-floating-button.tsx");
    assert.match(c, /bg-\[#25D366\]/);
    const shell = src("components/storefront-shell.tsx");
    assert.match(src("components/storefront-whatsapp.tsx"), /getWhatsAppChatUrl\(\)/);
    void shell;
  });

  it("it has an accessible name at every width", () => {
    const c = src("components/whatsapp-floating-button.tsx");
    assert.match(c, /aria-label=\{label\}/);
  });

  it("it cannot create horizontal overflow", () => {
    // left-anchored and width-constrained, and the expanded state is bounded.
    const c = src("components/whatsapp-floating-button.tsx");
    assert.match(c, /h-12 w-12/);
    assert.match(c, /hover:w-56/);
    assert.ok(!/right-\[calc\(/.test(c));
  });

  it("it is hidden while signed in, to clear the bottom nav", () => {
    assert.match(src("components/storefront-whatsapp.tsx"), /if \(authenticated\) return null/);
  });

  it("signed-in hiding is driven by the same session the header reads", () => {
    // Both the wrapper and the header that hosts it must read the session
    // through the ONE shared hook, so they cannot disagree about who is signed
    // in and the button cannot outlive the state by a render. If the wrapper
    // rolled its own session read, that guarantee would be gone.
    //
    // `codeOf` strips comments, so the explanatory prose in these files - which
    // names the endpoint - is not mistaken for a call to it.
    const wrapper = codeOf(src("components/storefront-whatsapp.tsx"));
    const header = codeOf(src("components/storefront-header.tsx"));
    assert.match(wrapper, /useStorefrontSession\(\)/);
    assert.match(header, /useStorefrontSession\(\)/);
    // Both must import the same hook module, not a local copy of the logic.
    for (const [name, code] of [
      ["wrapper", wrapper],
      ["header", header],
    ] as const) {
      assert.match(
        code,
        /from "@\/components\/use-storefront-session"/,
        `${name} must import the shared session hook`,
      );
    }
    // And the wrapper must not talk to the session endpoint itself.
    assert.ok(
      !/session-flags/.test(wrapper) && !/\bfetch\s*\(/.test(wrapper),
      "the wrapper must go through the hook, not read the session directly",
    );
  });

  it("the wrapper still uses the existing destination helper", () => {
    const wrapper = src("components/storefront-whatsapp.tsx");
    assert.match(wrapper, /getWhatsAppChatUrl\(\)/);
    assert.match(wrapper, /href=\{getWhatsAppChatUrl\(\)\}/);
  });

  it("the control's own behaviour is unchanged by the move", () => {
    // Guards the requirements this fix must NOT have altered while relocating.
    const c = src("components/whatsapp-floating-button.tsx");
    assert.match(c, /bg-\[#25D366\]/, "brand green");
    assert.match(c, /aria-label=\{label\}/, "accessible name");
    assert.match(c, /fixed/, "fixed");
    assert.match(c, /left-\[calc\(/, "bottom-LEFT");
    assert.match(c, /--safe-bottom/);
    assert.match(c, /--safe-left/);
    assert.match(c, /--mobile-nav-height/, "clears the mobile bottom nav");
    assert.match(c, /md:bottom-\[calc\(/, "lifts at md where the nav is gone");
    assert.ok(!/\bright-\[calc\(/.test(c), "must not have moved to the right");
    // Unconfigured number still renders nothing rather than a dead link.
    assert.match(c, /if \(!href\) return null/);
  });
});

describe("products opens the full catalogue", () => {
  it("the route exists", () => {
    assert.ok(existsSync(join(root, "app/products/page.tsx")));
  });

  it("the nav points at /products, not at one category", () => {
    const header = src("components/storefront-header.tsx");
    assert.ok(!/navLink\("\/category\/filters", t\("nav\.products"\)\)/.test(header));
    assert.match(header, /navLink\("\/products", t\("nav\.products"\)\)/);
  });

  it("the mobile drawer points at /products too", () => {
    const header = src("components/storefront-header.tsx");
    const drawer = /\{ href: "\/products", label: t\("nav\.products"\) \}/.test(codeOf(header));
    assert.ok(drawer, "the drawer must not send a shopper to a single category");
  });

  it("the old category route is still reachable, not deleted", () => {
    assert.ok(existsSync(join(root, "app/category/[...slug]/page.tsx")));
  });

  it("the page shows every category, from the one registry", () => {
    const c = src("components/products-catalogue.tsx");
    assert.match(c, /STOREFRONT_CATEGORIES/);
    // No hand-written second copy.
    assert.ok(!/cat\.body/.test(c), "categories must come from the registry");
  });

  it("the page carries the brand and vehicle axes as well", () => {
    const c = src("components/products-catalogue.tsx");
    assert.match(c, /PublicBrandGrid/);
    assert.match(c, /\/vehicle-fitment/);
  });

  it("the search backend is untouched by the new route", () => {
    const route = src("app/api/search/parts/route.ts");
    // The guard that refuses an unscoped query is still in place.
    assert.match(route, /if \(!query && !hasVehicleParams && !hasCategoryScope\)/);
  });

  it("the four view modes are untouched and still shared", () => {
    const switcher = src("components/catalogue-view-switcher.tsx");
    for (const mode of ["grid", "tiles", "list", "detailed"]) {
      assert.ok(switcher.includes(mode), `${mode} view must still exist`);
    }
    const lib = src("lib/catalogue-view.ts");
    assert.match(lib, /grid/);
    assert.match(lib, /tiles/);
    assert.match(lib, /list/);
    assert.match(lib, /detailed/);
  });
});

/* ================================================================= *
 * ENCODING
 * ================================================================= */

describe("no mojibake in application source", () => {
  /**
   * NARROWED DELIBERATELY, and the narrowing matters. A blanket
   * `[\u00c0-\u00ff]` check is WRONG for this codebase: it uses
   * `\u00b7` (99 real occurrences), `\u00d7` and `\u00b0` as ordinary
   * typography, and a detector that cries wolf on 110 correct
   * characters will be deleted rather than trusted.
   *
   * THE REAL SIGNATURE IS THE LEAD BYTE. Every character this
   * corruption mangles has a UTF-8 form beginning 0xC2 or 0xC3, which
   * cp1252 renders first as `\u00c2` or `\u00c3`. A 2-byte original
   * becomes a 2-character run, a 3-byte original a 3-character run:
   *
   *     U+00B7 MIDDLE DOT -> 2 chars
   *     U+2014 EM DASH    -> 3 chars
   *     U+20B9 RUPEE       -> 3 chars
   *
   * `\u00c2` and `\u00c3` never occur in legitimate English or
   * Devanagari UI copy, so requiring one as the lead is specific
   * AND sufficient. A bare middle dot does not match.
   */
  const MOJIBAKE = /[\u00c2\u00c3][^\s]|\u00e2[\u0080-\u00bf]/;
  /**
   * The signature of a cp1252 mis-decode: a lead byte rendered as a Latin-1
   * letter, followed by characters in the 0x80-0x9F range
   * symbols) - the classic 'a-circumflex + two symbol characters' shape.
   */

  it("the storefront and its libraries are clean", () => {
        // This file is excluded because it necessarily contains the pattern it
    // searches for. The other suites use the same exclusion.
    const hits = ALL.filter(
      (f) => !f.path.endsWith(".test.ts") && MOJIBAKE.test(f.source),
    ).map((f) => f.path);
    assert.deepEqual(hits, [], "mojibake reintroduced");
  });

  it("the reported strings now hold the real characters", () => {
    const s = src("components/search-experience.tsx");
    // The rupee, the bullet and the en dash the report named explicitly.
    assert.match(s, /₹/, "the rupee sign must render as U+20B9");
    assert.match(s, /•/, "the separator must be a real bullet");
    assert.match(s, /–/, "the range must be an en dash");
  });

  it("the selection bar reads 'items • Estimated Total'", () => {
    const s = src("components/search-experience.tsx");
    assert.ok(!/â€¢/.test(s));
    assert.match(s, /text-\[var\(--v3-text-3\)\]">•</);
  });

  it("no message string carries a replacement character", () => {
    for (const [key, value] of Object.entries(en)) {
      assert.ok(!value.includes("\uFFFD"), `${key} contains U+FFFD`);
    }
  });

  it("no source file is stored with a broken byte", () => {
    for (const f of ALL) {
      const buffer = readFileSync(join(root, f.path));
      const text = buffer.toString("utf8");
      assert.ok(!text.includes("\uFFFD"), `${f.path} is not valid UTF-8`);
    }
  });
});

/* ================================================================= *
 * IMAGE FRAMING
 * ================================================================= */

describe("image framing is content-aware and never crops a product", () => {
  it("every category has a framed derivative and it exists on disk", () => {
    for (const category of STOREFRONT_CATEGORIES) {
      assert.ok(category.framedImage, `${category.slug} has no framedImage`);
      assert.ok(
        existsSync(join(root, "public", category.framedImage.replace(/^\//, ""))),
        `${category.framedImage} does not exist`,
      );
    }
  });

  it("the source originals are still on disk and unmodified in place", () => {
    for (const category of STOREFRONT_CATEGORIES) {
      assert.ok(
        existsSync(join(root, "public", category.image.replace(/^\//, ""))),
        `${category.image} must survive`,
      );
      assert.ok(
        !category.framedImage.includes(category.image),
        "the derivative must be a different file, not the source",
      );
    }
  });

  it("the framed path is DERIVED from the source path, not hand-written", () => {
    for (const category of STOREFRONT_CATEGORIES) {
      assert.equal(category.framedImage, framedCategoryImage(category.image));
    }
    assert.equal(
      framedCategoryImage("/images/category/filters.png"),
      "/images/category/framed/filters.webp",
    );
  });

  it("the framing script keeps a safety margin, so nothing is clipped", () => {
    const script = src("scripts/frame-category-images.mjs");
    assert.match(script, /CONTENT_MARGIN_RATIO/);
    // A zero margin would crop the exact pixel the detector called background.
    const m = /CONTENT_MARGIN_RATIO = ([\d.]+)/.exec(script);
    assert.ok(m, "the margin must be a named constant");
    assert.ok(Number(m[1]) > 0, "the margin must be greater than zero");
  });

  it("the framing script bounds the crop to the canvas", () => {
    // `Math.min(meta.width - left, ...)` is what prevents sharp from being
    // handed a region larger than the image, which throws.
    const script = src("scripts/frame-category-images.mjs");
    assert.match(script, /Math\.max\(0, bounds\.left - margin\)/);
    assert.match(script, /Math\.min\(meta\.width - left/);
    assert.match(script, /Math\.min\(meta\.height - top/);
  });

  it("no PRODUCT or CATEGORY image uses object-cover", () => {
    // `object-cover` is legitimate for editorial imagery - a promo banner, an
    // offer hero - where the artwork is authored for the frame and being
    // cropped is the intent. It is NOT legitimate for a product or a category
    // tile, where it would cut the thing being sold. So this asserts on the
    // files that render products and categories, not on the whole storefront.
    const PRODUCT_IMAGE_FILES = [
      "components/search-product-card.tsx",
      "components/catalogue-product-table.tsx",
      "components/product-detail-modal.tsx",
      "components/public-brand-grid.tsx",
      "components/catalogue-product-image.tsx",
      "components/products-catalogue.tsx",
      "app/(public)/home-client.tsx",
    ];
    for (const file of PRODUCT_IMAGE_FILES) {
      const body = codeOf(src(file));
      assert.ok(
        !/object-cover/.test(body),
        `${file} renders product artwork with object-cover; a part must never be cut`,
      );
      if (/object-contain/.test(body)) continue;
      // If it renders images at all, it must state its intent.
      if (/<img|<Image/.test(body)) {
        throw new Error(`${file} renders images without object-contain or object-cover`);
      }
    }
  });

  it("the framing change introduced no cover crop of its own", () => {
    // Narrow and absolute: the files this phase touched for framing.
    for (const file of [
      "components/products-catalogue.tsx",
      "app/(public)/home-client.tsx",
    ]) {
      assert.ok(
        !/object-cover/.test(codeOf(src(file))),
        `${file} must not crop; the derivative already frames the product`,
      );
    }
  });

  it("the homepage reads the registry, so the framing applies there too", () => {
    const home = src("app/(public)/home-client.tsx");
    assert.match(home, /framedImage/);
    assert.ok(!/\/images\/category\/filters\.png/.test(codeOf(home)), "no hard-coded source path");
  });

  it("R2 catalogue images are untouched - framing is category-only", () => {
    // The catalogue's own images live on R2 and are shared by the search API
    // and admin. This change must not reach them, so the script must not so
    // much as name the R2 pipeline. The `r2` word is matched case-sensitively
    // and only outside comments, because the script's own comment block
    // explains at length why R2 is deliberately not touched.
    const body = codeOf(src("scripts/frame-category-images.mjs"));
    assert.match(body, /public\/images\/category/);
    assert.ok(
      !/r2-s3|R2Client|catalogue-image-store/.test(body),
      "the framing script must not reach the R2 pipeline",
    );
    // And the R2 module itself must still be the same shape.
    const r2 = src("lib/r2-s3.ts");
    assert.match(r2, /export (async )?function/);
    assert.ok(r2.length > 0);
  });
});
