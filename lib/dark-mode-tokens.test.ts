import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * DARK MODE PHASE 1 - token contract.
 *
 * Before this phase the site had a "dark mode" that was really a
 * hand-maintained allow-list of about thirty Tailwind classes in
 * app/globals.css sitting on top of a design system (app/v3.css) that had
 * NO dark overrides whatsoever. That combination is what produced the
 * report "in dark mode, some things are not visible": 207 storefront
 * elements use `bg-white`, so they were darkened, while the text on them
 * came from a `--v3-*` token that could not change.
 *
 * Nothing about a colour being a token makes it theme-aware. The only
 * thing that makes a token theme-aware is there being a second, darker
 * value for it. So this test exists to hold that second value in place:
 * it is a static contract over the two stylesheets, and it fails the build
 * if a `--v3-*` token is added to `:root` without a dark counterpart, or
 * if the class-based dark variant is removed.
 *
 * It is a text-and-structure test, not a rendering test. That is
 * deliberate: browser inspection was unavailable for this phase, and a
 * test that cannot run is worse than no test.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (p: string) => readFileSync(join(root, p), "utf8");

const V3 = source("app/v3.css");
const GLOBALS = source("app/globals.css");

/**
 * Every custom property declared inside a top-level `:root { ... }` block.
 *
 * Deliberately NOT a regex over the whole file: the file also contains a
 * `:root` block inside `@media (max-width: 1023px)`, and a loose match
 * would fold `--v3-header-h` into the list below. The brace walk stops at
 * the matching close, so the media block is skipped because it is not at
 * the start of a line.
 */
function rootDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/^:root\s*\{/gm)) {
    const start = match.index! + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < css.length && depth > 0; end += 1) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}") depth -= 1;
    }
    const body = css.slice(start, end - 1);
    for (const decl of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out.set(decl[1], decl[2].trim().replace(/\s+/g, " "));
    }
  }
  return out;
}

/** Same brace walk, for an `html.dark { ... }` block. */
function darkDeclarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/^html\.dark\s*\{/gm)) {
    const start = match.index! + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < css.length && depth > 0; end += 1) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}") depth -= 1;
    }
    const body = css.slice(start, end - 1);
    for (const decl of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out.set(decl[1], decl[2].trim().replace(/\s+/g, " "));
    }
  }
  return out;
}

const V3_ROOT = rootDeclarations(V3);
const V3_DARK = darkDeclarations(V3);
const GLOBALS_ROOT = rootDeclarations(GLOBALS);
const GLOBALS_DARK = darkDeclarations(GLOBALS);

/**
 * The `--v3-*` tokens that must switch with the theme.
 *
 * Everything here is a SURFACE or an INK. A token is only in this list if
 * flipping it changes what the visitor can read.
 *
 * Deliberately EXCLUDED, and this exclusion is the central design decision
 * of the phase:
 *
 *   --v3-brand, --v3-brand-hover   FILL colours. #7a1233 is a dark colour
 *     in both themes and white-on-burgundy is 10.7:1 either way. Lightening
 *     burgundy to suit a dark page would break every filled button, badge
 *     and the cart control on the site, and would weaken the brand.
 *   --v3-gold                      Measured 7.61:1 on the page ground and
 *     7.36:1 on the inverse band. It needs nothing.
 *   --v3-inverse                   The charcoal dealer and closing bands
 *     are dark-on-dark BY DESIGN and were already correct.
 *   --v3-r, --v3-r-lg, --v3-container, --v3-ease, --v3-header-h
 *     Geometry and motion, not colour.
 */
const MUST_SWITCH = [
  "--v3-page",
  "--v3-panel",
  "--v3-sunk",
  "--v3-sunk-deep",
  "--v3-rule",
  "--v3-rule-strong",
  "--v3-text",
  "--v3-text-2",
  "--v3-text-3",
  "--v3-brand-ink",
  "--v3-brand-soft",
  "--v3-brand-line",
  "--v3-gold-soft",
  "--v3-ok",
  "--v3-ok-soft",
  "--v3-ok-line",
  "--v3-warn",
  "--v3-warn-soft",
  "--v3-warn-line",
  "--v3-bad",
  "--v3-bad-soft",
  "--v3-bad-line",
  "--v3-footer-surface",
  "--v3-footer-rule",
  "--v3-footer-rule-strong",
  "--v3-footer-ink",
  "--v3-footer-ink-2",
  "--v3-footer-gold",
  "--v3-footer-gold-ink",
  "--v3-lift-hi",
] as const;

/**
 * Tokens that MUST be restated in `html.dark` but are allowed to hold the
 * same literal, because they delegate to a token that does change.
 * `--v3-lift` is `0 1px 0 var(--v3-rule)`: the hairline shadow follows
 * `--v3-rule` for free, so restating it documents the dependency rather
 * than changing anything. A test that demanded a different literal here
 * would be demanding a change that buys nothing.
 */
const MUST_RESTATE = ["--v3-lift"] as const;

/** The tokens above that MUST keep their light value in dark mode. */
const MUST_NOT_SWITCH = [
  "--v3-brand",
  "--v3-brand-hover",
  "--v3-inverse",
  "--v3-gold",
] as const;

/** The three globals.css surface tokens, plus the two base theme tokens. */
const GLOBALS_MUST_SWITCH = [
  "--background",
  "--foreground",
  "--surface",
  "--surface-muted",
  "--border-subtle",
] as const;

describe("dark mode: the class-based dark variant", () => {
  it("declares @custom-variant dark so `dark:` follows the .dark class", () => {
    // Tailwind v4 ships `dark:` as @media (prefers-color-scheme: dark).
    // This site sets a CLASS on <html> (app/layout.tsx, lib/i18n/index.ts,
    // components/preferences-provider.tsx). Without this line every
    // `dark:` utility follows the operating system instead of the
    // visitor's own choice, so picking "Light" on a dark OS still applies
    // the dark utilities.
    assert.match(
      GLOBALS,
      /@custom-variant\s+dark\s*\(&:where\(\.dark,\s*\.dark\s+\*\)\)\s*;/,
      "globals.css must declare @custom-variant dark (&:where(.dark, .dark *))",
    );
  });

  it("declares it after the tailwindcss import so it is not swallowed", () => {
    const imported = GLOBALS.indexOf('@import "tailwindcss"');
    const variant = GLOBALS.indexOf("@custom-variant dark");
    assert.ok(imported >= 0, "globals.css must import tailwindcss");
    assert.ok(variant > imported, "@custom-variant must come after the import");
  });

  it("has dark utilities to activate, so the variant is load-bearing", () => {
    // If this ever fails, the @custom-variant line is dead weight and the
    // four utilities in header-preference-toggle.tsx should be reviewed.
    const toggles = source("components/header-preference-toggle.tsx");
    const uses = toggles.match(/\bdark:[a-z-]+/g) ?? [];
    assert.ok(
      uses.length > 0,
      "no `dark:` utilities exist; re-check whether the custom variant is needed",
    );
  });
});

describe("dark mode: app/v3.css has a real dark theme", () => {
  it("declares an html.dark block", () => {
    assert.match(
      V3,
      /^html\.dark\s*\{/m,
      "app/v3.css must contain a top-level html.dark block",
    );
    assert.ok(
      V3_DARK.size > 0,
      "the html.dark block in app/v3.css must declare custom properties",
    );
  });

  for (const token of [...MUST_SWITCH, ...MUST_RESTATE]) {
    it(`redefines ${token} for dark mode`, () => {
      assert.ok(
        V3_ROOT.has(token),
        `${token} is not declared in app/v3.css :root, so the MUST_SWITCH list is stale`,
      );
      assert.ok(
        V3_DARK.has(token),
        `${token} has no html.dark override in app/v3.css, so it stays light-only`,
      );
    });
  }

  for (const token of MUST_SWITCH) {
    it(`gives ${token} a genuinely different dark value`, () => {
      assert.notEqual(
        V3_ROOT.get(token),
        V3_DARK.get(token),
        `${token} has the same value in :root and html.dark, so the override is a no-op`,
      );
    });
  }

  for (const token of MUST_NOT_SWITCH) {
    it(`keeps ${token} unchanged in dark mode`, () => {
      assert.ok(
        V3_ROOT.has(token),
        `${token} is not declared in app/v3.css :root`,
      );
      assert.equal(
        V3_DARK.get(token),
        undefined,
        `${token} must not be redefined for dark mode: it is a fill or is already correct on a dark ground`,
      );
    });
  }

  it("covers every --v3-* token that is either a surface or an ink", () => {
    // The real invariant. MUST_SWITCH above is a curated list; this checks
    // it against the file, so adding a new colour token to :root without
    // deciding its dark value fails here rather than in production.
    const accounted = new Set<string>([
      ...MUST_SWITCH,
      ...MUST_RESTATE,
      ...MUST_NOT_SWITCH,
    ]);
    const geometry = /^--v3-(r|r-lg|container|ease|header-h)$/;
    const orphans = [...V3_ROOT.keys()].filter(
      (name) => name.startsWith("--v3-") && !geometry.test(name) && !accounted.has(name),
    );
    assert.deepEqual(
      orphans,
      [],
      `these --v3-* tokens are neither in MUST_SWITCH nor MUST_NOT_SWITCH; classify each one: ${orphans.join(", ")}`,
    );
  });

  it("declares --v3-brand-ink in light mode as an alias of the brand fill", () => {
    // If light mode declared a different ink colour it would restyle the
    // whole light theme on a dark-mode ticket. Light must be untouched.
    assert.equal(
      V3_ROOT.get("--v3-brand-ink"),
      V3_ROOT.get("--v3-brand"),
      "--v3-brand-ink must equal --v3-brand in :root so light mode is unchanged",
    );
  });
});

describe("dark mode: app/globals.css surface tokens", () => {
  for (const token of GLOBALS_MUST_SWITCH) {
    it(`redefines ${token} for dark mode`, () => {
      assert.ok(
        GLOBALS_ROOT.has(token),
        `${token} is not declared in app/globals.css :root`,
      );
      assert.ok(
        GLOBALS_DARK.has(token),
        `${token} has no html.dark override in app/globals.css`,
      );
      assert.notEqual(
        GLOBALS_ROOT.get(token),
        GLOBALS_DARK.get(token),
        `${token} has the same value in :root and html.dark`,
      );
    });
  }

  it("keeps the dark grounds identical to the ones v3.css uses", () => {
    // Two stylesheets, one palette. If these drift, the header (a bg-white
    // element, so #161b24) and the page root (.v3-page-root) stop matching,
    // which is the exact seam the audit found on the homepage bands.
    assert.equal(GLOBALS_DARK.get("--surface"), V3_DARK.get("--v3-sunk"));
    assert.equal(GLOBALS_DARK.get("--surface-muted"), V3_DARK.get("--v3-panel"));
    assert.equal(GLOBALS_DARK.get("--border-subtle"), V3_DARK.get("--v3-rule"));
    assert.equal(GLOBALS_DARK.get("--background"), V3_DARK.get("--v3-page"));
  });
});

describe("dark mode: the allow-list gaps this phase closed", () => {
  /**
   * The classes the audit found missing from the globals.css allow-list.
   * Each entry is [escaped selector, human reason]. A miss here is the
   * audit bug coming back, so this is the regression net for the whole
   * point of the phase.
   */
  const REQUIRED: Array<[string, string]> = [
    [".bg-zinc-50", "dealer + order-detail page shell"],
    [".bg-zinc-100", "order-detail status pill and per-firm row"],
    [".bg-slate-200", "disabled add-to-cart chip, /cart skeletons"],
    [".bg-emerald-100", "order-confirmation success tick"],
    [".bg-amber-50\\/60", "/checkout Pensol settlement panel"],
    [".text-zinc-950", "dealer headers, inherited wordmark"],
    [".text-zinc-700", "order-detail delivery address"],
    [".text-zinc-600", "dealer + order-detail body ink"],
    [".text-slate-400", "MRP, part numbers, /cart + /checkout footnotes"],
    [".text-slate-300", "hover and disabled tiers"],
    [".text-amber-800", "/cart stock chip, /checkout invalid-GSTIN error"],
    [".text-amber-900", "/cart price-on-request, order-detail return button"],
    [".text-emerald-900", "payment page UPI label"],
    [".text-emerald-950", "payment page UPI value"],
    [".text-rose-600", "/cart + /register field errors"],
    [".text-rose-700", "/checkout invalid-GSTIN error, /wishlist remove"],
    // No call site for either family on the storefront today. Remapped
    // anyway, because this is a hand-maintained allow-list: a future
    // component reaching for `text-neutral-600` would otherwise ship a
    // 1.9:1 bug with nothing to fail.
    [".text-neutral-950", "neutral ink family (no call site yet)"],
    [".text-neutral-400", "neutral muted tier (no call site yet)"],
    [".hover\\:bg-rose-50", "/cart remove-button hover"],
    [".hover\\:bg-emerald-100", "order-confirmation download hover"],
    [".hover\\:text-slate-700", "/register sign-in link hover"],
    [".hover\\:text-slate-800", "mobile bottom nav + qty buttons hover"],
    [".hover\\:text-slate-900", "qty buttons, register edit-phone hover"],
    [".hover\\:text-zinc-700", "/login create-account hover"],
    [".hover\\:text-emerald-950", "/cart success-toast dismiss hover"],
    [".hover\\:text-rose-900", "/cart error-toast dismiss hover"],
    [".has-checked\\:bg-slate-50", "/checkout + /profile radio rows"],
    [".disabled\\:bg-slate-200", "catalogue table disabled add-to-cart"],
    [".divide-slate-100", "/checkout line-item dividers"],
    [".text-\\[\\#7a1233\\]", "burgundy used as ink, lifted to #e8a0b8"],
  ];

  for (const [selector, reason] of REQUIRED) {
    it(`remaps ${selector} (${reason})`, () => {
      assert.ok(
        GLOBALS.includes(`html.dark ${selector}`),
        `globals.css is missing an html.dark override for ${selector}`,
      );
    });
  }

  it("has no global bg-white/<alpha> override", () => {
    // Guard for the one item deliberately left out. `bg-white/95` is the
    // storefront's sticky bars AND the admin sidebar's light logo plate,
    // in one class token, and CSS cannot distinguish them - so darkening
    // it globally would hide the admin wordmark. Tier 2 moves the four
    // storefront call sites to var(--v3-panel) instead. If this assertion
    // ever fails, that migration has landed and the override must go.
    const alphaOverride = /html\.dark\s+\.bg-white\\?\/\d+/;
    assert.ok(
      !alphaOverride.test(GLOBALS),
      "globals.css must not remap bg-white/<alpha> globally: it would darken the admin logo plate in components/admin-shell.tsx",
    );
  });

  it("restores the V3 search input surface", () => {
    // `html.dark input` sets background-color at specificity (0,1,2), which
    // beats `.v3-search input` at (0,1,1). Without this the input keeps a
    // forced #10141c while its value is coloured by
    // `.v3-search .sl-search-input` at (0,2,0) - light ink on that ground
    // at 1.05:1, i.e. typed text that cannot be seen.
    assert.match(
      GLOBALS,
      /html\.dark\s+\.v3-search\s+input\s*\{[^}]*background:\s*transparent/,
      "globals.css must restore `background: transparent` on the V3 search input",
    );
  });
});

describe("dark mode: the three traps a token cannot reach", () => {
  it("A: overrides the carousel arrow, which is a hardcoded white chip", () => {
    // .v3-carousel-arrow is rgba(255,255,255,0.92) with
    // `color: var(--v3-text)`. Lift the ink and the icon reads 1.09:1 on
    // its own chip. Asserted for contrast in dark-mode-contrast.test.ts.
    const block = /html\.dark\s+\.v3-carousel-arrow\s*\{([^}]*)\}/.exec(V3);
    assert.ok(block, "app/v3.css must override .v3-carousel-arrow for dark mode");
    const [, body] = block;
    assert.match(body, /background:\s*(?!\s*rgba\(255)/, "the white chip must be replaced");
    assert.match(body, /color:\s*#/, "the arrow icon needs an explicit dark-mode colour");
  });

  it("B: gives .v3-select a chevron it can actually reach", () => {
    // The light chevron bakes #857972 into an SVG data URI, so no custom
    // property can reach it - the browser has a bitmap by paint time. The
    // dark variant has to re-encode the same path.
    // Anchored to the start of a line, because `html.dark .v3-select`
    // also contains the substring `.v3-select` and appears EARLIER in the
    // file than the light rule - an unanchored match reads the dark rule
    // as the light one and the assertion below would pass for the wrong
    // reason.
    // `m`, not `s`: the compile target is ES2017 where the dotAll flag does
    // not exist. These patterns span lines, so the gaps use `[^}]` and the
    // data URI's own characters rather than `.`.
    const light = /^\.v3-select\s*\{[^}]*background-image:\s*url\("data:image\/svg\+xml,([^"]*)"\)/m.exec(V3);
    const dark = /html\.dark\s+\.v3-select\s*\{[^}]*background-image:\s*url\("data:image\/svg\+xml,([^"]*)"\)/m.exec(V3);
    assert.ok(light, ".v3-select must keep its light-theme chevron");
    assert.ok(dark, "app/v3.css must give .v3-select a dark-theme chevron");
    assert.match(light[1], /fill='%23857972'/, "light chevron should bake the light ink");
    assert.notEqual(light[1], dark[1], "the dark chevron must not be a copy of the light one");
    assert.match(dark[1], /fill='%23[0-9a-f]{6}'/i, "dark chevron must bake a dark-mode ink");
    // Same path, different fill: a changed path would move the arrow.
    const pathOf = (s: string) => /d='([^']*)'/.exec(s)?.[1] ?? "";
    assert.equal(pathOf(dark[1]), pathOf(light[1]), "only the fill may change, never the path");
  });

  it("guards the four state badges, whose borders and gold ink are literal", () => {
    // .v3-badge-ok/-warn/-bad take background and colour from tokens but a
    // hardcoded light border; .v3-badge-gold also hardcodes #7a5a17, which
    // is invisible on the remapped --v3-gold-soft.
    for (const badge of ["v3-badge-ok", "v3-badge-warn", "v3-badge-bad", "v3-badge-gold"]) {
      assert.match(
        V3,
        new RegExp(`html\\.dark\\s+\\.${badge}\\s*\\{`),
        `app/v3.css must override .${badge} for dark mode`,
      );
    }
    // `[^}]` rather than a dotAll `s` flag: the compile target is ES2017.
    assert.match(
      V3,
      /html\.dark\s+\.v3-badge-gold\s*\{[^}]*color:/,
      ".v3-badge-gold's hardcoded #7a5a17 must be replaced for dark mode",
    );
  });

  it("guards the skeleton, which is a near-black shimmer on a dark panel", () => {
    assert.match(
      V3,
      /html\.dark\s+\.v3-skeleton\s*\{/,
      "app/v3.css must override .v3-skeleton for dark mode",
    );
  });

  it("keeps keyboard focus visible on the V3 controls", () => {
    // .v3-focus, .v3-input:focus and .v3-select:focus all ring themselves in
    // var(--v3-brand), which is deliberately NOT lifted because it is a
    // fill. Unfixed, the ring measured 1.61:1 and WCAG 2.4.7 failed for
    // every V3 control on the site.
    assert.match(V3, /html\.dark\s+\.v3-focus:focus-visible\s*\{/);
    assert.match(
      V3,
      /html\.dark\s+\.v3-input:focus,\s*html\.dark\s+\.v3-select:focus\s*\{/,
      "the V3 input and select focus rings must be lifted too",
    );
    assert.match(
      GLOBALS,
      /html\.dark\s+:focus-visible\s*\{/,
      "the global fallback focus ring must be lifted too",
    );
  });
});
