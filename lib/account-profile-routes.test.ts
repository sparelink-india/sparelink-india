/**
 * Account/Profile route repair - regression guard.
 *
 * The defect this prevents: e379271 shipped `account-sections.tsx` and an
 * `/account` entry in the primary navigation, but the route pages those links
 * point at were pre-existing uncommitted work. Production therefore served a
 * primary-nav link to a 404. These tests make the coupling explicit so the next
 * link cannot be added without its page.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");
/** Comments stripped so prose cannot be read as a JSX usage. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ACCOUNTS = [
  "/account",
  "/account/invoices",
  "/account/ledger",
  "/account/payments",
  "/account/schemes",
];
const PROFILE = [
  "/profile/addresses",
  "/profile/kyc",
  "/profile/salesman",
  "/profile/settings",
];
const pageFor = (route: string) => `app${route}/page.tsx`;

describe("account/profile: every navigation target resolves to a real route", () => {
  it("each advertised href has a page file on disk", () => {
    const missing: string[] = [];
    for (const r of [...ACCOUNTS, ...PROFILE]) {
      if (!existsSync(join(root, pageFor(r)))) missing.push(r);
    }
    assert.deepEqual(missing, [], `advertised but no page.tsx: ${missing.join(", ")}`);
  });

  it("the hrefs in account-sections.tsx are exactly the routes that exist", () => {
    const body = code(src("components/account/account-sections.tsx"));
    const hrefs = [...new Set([...body.matchAll(/href:\s*"(\/(?:account|profile)[^"]*)"/g)].map((m) => m[1]))];
    assert.ok(hrefs.length >= 9, `expected the full section list, found ${hrefs.length}`);
    for (const h of hrefs) {
      assert.ok(
        existsSync(join(root, pageFor(h))) || h === "/profile" || h === "/account/change-password",
        `${h} is advertised in account-sections.tsx but ${pageFor(h)} does not exist`,
      );
    }
  });

  it("the primary navigation's /account entry has a page", () => {
    // This is the link that was live in production pointing at a 404.
    const header = code(src("components/storefront-header.tsx"));
    assert.match(header, /navLink\("\/account"/);
    assert.ok(
      existsSync(join(root, "app/account/page.tsx")),
      "the header advertises /account, so app/account/page.tsx must exist",
    );
  });
});

describe("account/profile: route modules are well formed", () => {
  const pages = [...ACCOUNTS, ...PROFILE].map(pageFor);

  it("none of them reach the database directly", () => {
    // A server component importing drizzle would bypass the existing
    // data-loading pattern and could 500 without a session.
    for (const p of pages) {
      const body = code(src(p));
      assert.ok(
        !/from\s+"@\/drizzle|getDb\(/.test(body),
        `${p} touches the database directly; use the existing /api pattern`,
      );
    }
  });

  it("each one renders through AccountSectionLayout", () => {
    for (const p of pages) {
      assert.match(code(src(p)), /<AccountSectionLayout\b/, `${p} must use AccountSectionLayout`);
    }
  });

  it("a component using hooks declares 'use client'", () => {
    for (const p of [...pages, "components/account/account-credit.tsx", "components/account/account-section-layout.tsx", "components/account/profile-addresses.tsx"]) {
      const body = code(src(p));
      const hooks = /\buse(State|Effect|Memo|Callback|Ref|SyncExternalStore)\s*\(/.test(body);
      if (hooks) {
        assert.match(body, /^\s*["']use client["']/m, `${p} calls a hook without 'use client'`);
      }
    }
  });
});

describe("account/profile: protected, and no fabricated data", () => {
  it("the /account layout still demands a session", () => {
    const layout = code(src("app/account/layout.tsx"));
    assert.match(layout, /!session\?\.user/);
    assert.match(layout, /redirect\("\/login"\)/);
  });

  it("a missing or unauthorised credit response is a stated state, not a number", () => {
    const credit = code(src("components/account/account-credit.tsx"));
    // 401/403 is the dealer role gate, not a failure to report as a real balance.
    assert.match(credit, /status === 403/);
    assert.match(credit, /status === 401/);
    // The formatter must refuse to invent a figure. A null Outstanding or Credit
    // Limit used to become a confident "₹0" via `paise ?? 0`, which a customer
    // reads as "you owe nothing" rather than "no credit line is set up".
    assert.match(
      credit,
      /function\s+rupees[\s\S]{0,400}?typeof\s+paise\s*!==\s*"number"[\s\S]{0,160}?return\s+"—"/,
      "rupees() must return an em dash for a missing amount, never Rs 0",
    );
    assert.ok(
      !/function\s+rupees[\s\S]{0,240}?\?\?\s*0/.test(credit),
      "rupees() must not coalesce a missing amount to 0",
    );
    // And an absent summary must not be coerced to a truthy object.
    assert.match(credit, /summary\?\./);
  });

  it("the payments section refuses to invent a history", () => {
    const payments = code(src("app/account/payments/page.tsx"));
    assert.match(payments, /SectionEmpty/);
    assert.ok(
      !/rupees\(\s*\d|\btotalPaise:\s*\d|amountPaise:\s*\d/.test(payments),
      "the payments page must not hardcode money values",
    );
  });
});

describe("account/profile: localization and dark mode", () => {
  it("every titleKey the routes pass exists in the dictionary", () => {
    const dict = code(src("lib/i18n/messages.ts"));
    for (const p of [...ACCOUNTS, ...PROFILE].map(pageFor)) {
      const m = /titleKey="([^"]+)"/.exec(code(src(p)));
      assert.ok(m, `${p} passes no titleKey`);
      assert.ok(dict.includes(`"${m[1]}"`), `${m[1]} used by ${p} is not in the dictionary`);
      assert.ok(
        dict.split("export const hi")[1]?.includes(`"${m[1]}"`),
        `${m[1]} is missing from the Hindi dictionary`,
      );
    }
  });

  it("the frame supplies the h1 and the storefront chrome", () => {
    const layout = code(src("components/account/account-section-layout.tsx"));
    assert.match(layout, /<h1\b/);
    assert.match(layout, /<StorefrontShell\b/);
    assert.match(layout, /useI18n\(\)/);
  });

  it("account surfaces use dark-mode tokens, not light-only escapes", () => {
    // NOTE: a bare `bg-white` is NOT an escape. `app/globals.css` ships
    // `html.dark .bg-white { background-color: #161b24 }`, so the plain token
    // already follows the theme by design. What cannot be remapped that way is
    // an OPACITY variant (`bg-white/95`) or a hardcoded hex, because the class
    // token differs and globals.css documents why. Those are what this asserts.
    for (const p of ["components/account/account-section-layout.tsx", "components/account/account-sections.tsx", "components/account/account-credit.tsx", "components/account/profile-addresses.tsx"]) {
      const body = code(src(p));
      assert.ok(
        !/className="[^"]*\bbg-white\/\d/.test(body),
        `${p} uses a bg-white/<opacity> variant, which the dark theme cannot remap`,
      );
      assert.ok(
        !/className="[^"]*\bbg-\[#[0-9a-fA-F]{3,8}\]/.test(body),
        `${p} hardcodes a hex background, which will not follow the dark theme`,
      );
    }
  });
});

describe("skip to content", () => {
  it("the link exists in the root layout and points at the landmark", () => {
    const layout = code(src("app/layout.tsx"));
    assert.match(layout, /href="#main-content"/);
    assert.match(layout, /sr-only/);
    assert.match(layout, /focus:not-sr-only/);
  });

  it("the link label is localised for both locales", () => {
    const dict = code(src("lib/i18n/messages.ts"));
    const en = /"a11y\.skipToContent":\s*"([^"]+)"/.exec(dict.split("export const hi")[0]);
    const hi = /"a11y\.skipToContent":\s*"([^"]+)"/.exec(dict.split("export const hi")[1] ?? "");
    assert.ok(en, "a11y.skipToContent missing from en");
    assert.ok(hi, "a11y.skipToContent missing from hi");
    assert.notEqual(en[1], hi[1], "the Hindi label must actually be Hindi");
  });

  it("each shell's <main> is the target, so the link always resolves", () => {
    for (const shell of [
      "components/storefront-shell.tsx",
      "components/vehicle-fitment/fitment-shell.tsx",
      "components/admin-shell.tsx",
    ]) {
      assert.match(
        code(src(shell)),
        /<main id="main-content"/,
        `${shell} renders <main> but is not the skip target`,
      );
    }
  });
});
