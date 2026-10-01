/**
 * DARK MODE TIER 2 - source-contract regression tests.
 *
 * Phase 1 fixed the token environment. Tier 2 migrated the individual
 * components that the environment could not reach, and every fix in this
 * file is a contract rather than a rendering: a literal that must not come
 * back, a token that must be consumed, a pairing that must stay apart.
 *
 * These are deliberately static source assertions rather than rendered
 * assertions. Browser inspection is unavailable, and the honest form of
 * coverage without it is "the class that caused the bug is gone and the
 * token that fixes it is present" - which is checkable, and which a
 * screenshot test could only check by being run by a human.
 *
 * The assertions are grouped by the failure they prevent:
 *   1. the logo artwork pair, and no plate behind it in either theme
 *   2. no global bg-white/<alpha> override, and the storefront call sites
 *   3. burgundy-as-ink migrated, burgundy-as-fill untouched
 *   4. the hardcoded light chips, and the ones that must survive
 *   5. the non-V3 focus states
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const GLOBALS = read("app/globals.css");
const V3 = read("app/v3.css");
const BRAND_LOGO = read("components/brand-logo.tsx");
const ADMIN_SHELL = read("components/admin-shell.tsx");

const SKIP = new Set(["node_modules", ".next", ".git", "_backups", ".vercel"]);

/** Every .tsx under app/ and components/, excluding admin, as {path, source}. */
const STOREFRONT = [
  ...walk(join(root, "app")),
  ...walk(join(root, "components")),
]
  .map((p) => ({ path: relative(root, p).replace(/\\/g, "/"), source: readFileSync(p, "utf8") }))
  .filter((f) => !/\/admin\//.test(f.path) && !/\/admin-[^/]*\.tsx$/.test(f.path))
  // `raw` keeps the comments for readable failure messages; `code` is what
  // the literal searches run against.
  .map((f) => ({
    path: f.path,
    raw: f.source,
    source: f.source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
  }));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * Strips block and line comments before a literal is searched for.
 *
 * These tests quote the OLD broken values in their explanatory comments -
 * `bg-[#f6f7f9]`, `bg-white/95`, `bg-slate-300` and friends - so a search
 * over raw source would report an already-fixed defect as still present.
 */
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * Reads a WebP's canvas size straight out of its RIFF header.
 *
 * Three chunk types carry dimensions, at three different offsets, and the
 * point of the assertion is that the derivative is still 2:1 - so the value
 * has to come from the file rather than from the generator's own log. No
 * image dependency: this is the only WebP layout needed for a static asset.
 */
function webpSize(buf: Buffer): { width: number; height: number } {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF", "not a RIFF container");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP", "not a WebP payload");
  // 0-3 RIFF | 4-7 size | 8-11 WEBP | 12-15 chunk FourCC | 16-19 chunk SIZE.
  // Chunk data therefore starts at 20, not 12 - the size field is what makes
  // the naive reading of the spec land four bytes early.
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // 3-byte frame tag, then the 9d 01 2a start code, then 14-bit dimensions.
    assert.deepEqual(
      [buf[23], buf[24], buf[25]],
      [0x9d, 0x01, 0x2a],
      "VP8 start code is not where the spec puts it",
    );
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    // 1 flag byte + 3 reserved, then two 24-bit (value + 1) dimensions.
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  throw new Error(`unsupported WebP chunk ${chunk}`);
}

/* ================================================================= *
 * 1. THE LOGO ARTWORK
 * ================================================================= */

describe("tier 2: the logo artwork", () => {
  /**
   * Strips block comments before a literal is searched for.
   *
   * These tests quote the OLD broken values in their failure messages, so
   * several comments legitimately contain `bg-[#f6f7f9]`, `bg-white/95`
   * and friends while explaining what was replaced. Searching the raw
   * source would therefore report a fix as still present.
   */
  it("paints no plate behind the logo in either theme", () => {
    // The plate existed only because the asset was a raster-traced SVG with no
    // dark variant. A matched artwork pair removes the reason for it, and a
    // white box in dark mode is exactly what the brief forbids.
    //
    // Both sources are read through codeOf: each keeps a comment naming the
    // selectors it retired, which is the whole point of those comments.
    assert.ok(
      !/brand-logo-plate/.test(codeOf(GLOBALS)),
      "globals.css must no longer define .brand-logo-plate",
    );
    assert.ok(
      !/brand-logo-plate/.test(codeOf(BRAND_LOGO)),
      "brand-logo.tsx must no longer apply the brand-logo-plate class",
    );
    assert.ok(
      !/--logo-plate/.test(codeOf(GLOBALS)),
      "the --logo-plate token is obsolete and must not linger",
    );
    // The whole ternary in one match, deliberately: a lazy capture across
    // `className={` would start on the image-failed fallback span and run on
    // to the next "inline-flex", dragging the invert branch's `bg-white` into
    // the group and reporting a plate that is not there. Matching the literal
    // pins the normal branch to exactly "inline-flex" - no bg-*, no padding,
    // no background - and re-checks the invert plate in the same breath.
    assert.match(
      codeOf(BRAND_LOGO),
      /invert\s*\?\s*"inline-flex rounded-md bg-white px-1\.5 py-1"\s*:\s*"inline-flex"\s*\}/,
      "the wrapper must keep the invert plate and resolve to a bare inline-flex everywhere else",
    );
  });

  it("selects a distinct dark artwork rather than recolouring the light one", () => {
    assert.match(BRAND_LOGO, /sparelink-india-logo\.webp/);
    assert.match(BRAND_LOGO, /sparelink-india-logo-dark\.webp/);
    const code = codeOf(BRAND_LOGO);
    assert.ok(
      !/brightness|invert\(|filter\s*:/.test(code),
      "the dark mark must be real artwork, not a CSS filter over the light one",
    );
    // Driven by the preference that already toggles html.dark, so there is
    // no second theme mechanism.
    assert.match(BRAND_LOGO, /const logoSrc = LOGO_SRC\[forceTheme \?\? theme\]/);
    assert.match(BRAND_LOGO, /const \{ t, theme \} = useI18n\(\)/);
  });

  it("ships both web assets at the master's 2:1 ratio, so a swap cannot reflow", () => {
    // The header sizes the mark by height and lets the width follow, so the
    // intrinsic ratio IS the layout. A stretched or cropped derivative would
    // move the row, and this is the assertion that catches it.
    const dims = ["sparelink-india-logo.webp", "sparelink-india-logo-dark.webp"].map((f) =>
      webpSize(readFileSync(join(root, "public/images/brand", f))),
    );
    for (const d of dims) {
      assert.equal(d.width, 1200, "the derivative is the 1200px proportional scale");
      assert.equal(d.height, 600, "height must be 1200/2, i.e. the master's 2:1");
    }
    assert.deepEqual(dims[0], dims[1], "both themes must render in the same box");
  });

  it("preserves the invert branch exactly", () => {
    // The auth pages sit on a dark ground already; that branch had its own
    // `bg-white` plate before this phase and must keep it. It is still the
    // right pairing, because `html.dark .bg-white` remaps that token in step
    // with the theme, so the plate and the artwork stay matched.
    assert.match(
      BRAND_LOGO,
      /invert\s*\?\s*"inline-flex rounded-md bg-white px-1\.5 py-1"/,
      "the invert branch must keep its own unconditional bg-white plate",
    );
  });

  it("removes Admin's light plate and pins the dark artwork there", () => {
    // The admin sidebar is a hardcoded `bg-[#0f172a]` in both themes. It had
    // a `bg-white/95` plate so the light-ground-only mark could read on it;
    // with a real dark artwork the plate is not just unnecessary but wrong,
    // because the light artwork would drop its own white plate onto a dark
    // rail. So the plate goes and the artwork is pinned.
    assert.ok(
      !/bg-white\/95/.test(ADMIN_SHELL),
      "admin must no longer paint a light plate behind the logo",
    );
    assert.match(
      ADMIN_SHELL,
      /<BrandLogo\s+compact\s+forceTheme="dark"/,
      "admin must pin the dark artwork, since its rail is dark in both themes",
    );
    assert.ok(
      !/brand-logo-plate/.test(ADMIN_SHELL),
      "admin must not use the storefront plate class",
    );
  });

  it("uses the lifted brand ink for the image-failed fallback", () => {
    // That fallback is text, not a fill, so it must not be the burgundy fill.
    assert.match(BRAND_LOGO, /text-\[var\(--v3-brand-ink\)\]/);
    assert.ok(
      !/text-\[#7a1233\]/.test(BRAND_LOGO),
      "the fallback must not use the raw burgundy literal",
    );
  });
});

/* ================================================================= *
 * 2. bg-white/95
 * ================================================================= */

describe("tier 2: bg-white/95", () => {
  it("has no global override, because the class token spanned colliding surfaces", () => {
    assert.ok(
      !/html\.dark\s+\.bg-white\\?\/\d+/.test(GLOBALS),
      "globals.css must not remap bg-white/<alpha> globally",
    );
  });

  it("has no live bg-white/<alpha> call site left to remap", () => {
    // Four storefront bars moved to var(--v3-panel); the fifth was the admin
    // logo plate, removed with the dark artwork. Nothing is left, so the
    // assertion above can only pass and the old collision cannot return.
    assert.ok(
      !/\bbg-white\/95\b/.test(ADMIN_SHELL),
      "the admin logo plate must be gone",
    );
  });

  it("all four storefront call sites are theme-aware", () => {
    // The Phase 1 audit named exactly four. Each must now consume
    // --v3-panel, which is #ffffff in light and the dark panel in dark.
    // Comments are stripped: two of these files explain the change in a
    // comment that legitimately quotes `bg-white/95`.
    const AUDIT_SITES = [
      "app/cart/page.tsx",
      "app/checkout/page.tsx",
      "app/orders/[id]/payment/payment-client.tsx",
      "components/product-detail-modal.tsx",
    ];
    for (const p of AUDIT_SITES) {
      const file = STOREFRONT.find((f) => f.path === p);
      assert.ok(file, `${p} must be a storefront component`);
      assert.ok(
        /bg-\[var\(--v3-panel\)\]\/95/.test(file.source),
        `${p} must use bg-[var(--v3-panel)]/95`,
      );
      assert.ok(
        !/\bbg-white\/95\b/.test(file.source),
        `${p} must no longer carry a hardcoded bg-white/95`,
      );
    }
  });

  it("no storefront component outside those four still uses the literal", () => {
    const strays = STOREFRONT.filter(
      (f) =>
        /\bbg-white\/95\b/.test(f.source) &&
        ![
          "app/cart/page.tsx",
          "app/checkout/page.tsx",
          "app/orders/[id]/payment/payment-client.tsx",
          "components/product-detail-modal.tsx",
        ].includes(f.path),
    );
    assert.deepEqual(
      strays.map((s) => s.path),
      [],
      "a storefront component still hardcodes bg-white/95; it needs the panel token",
    );
  });
});

/* ================================================================= *
 * 3. BURGUNDY: INK vs FILL
 * ================================================================= */

describe("tier 2: burgundy as ink vs burgundy as fill", () => {
  it("migrated every storefront text-[var(--v3-brand)] to brand-ink", () => {
    // EXCEPT in files this phase may not edit. `components/home-hero.tsx`
    // carries `hover:text-[var(--v3-brand)]` on its mobile category row; the
    // hero is protected, so that one is lifted by a global rule instead -
    // see the next test. Editing a protected file to fix a colour would
    // have been the wrong trade.
    const PROTECTED_FROM_EDIT = ["components/home-hero.tsx"];
    const stale = STOREFRONT.filter(
      (f) =>
        !PROTECTED_FROM_EDIT.includes(f.path) &&
        /text-\[var\(--v3-brand\)\](?!-ink)/.test(f.source),
    );
    assert.deepEqual(
      stale.map((s) => s.path),
      [],
      "these files still use the burgundy FILL token as a text colour, which is 1.61:1 on a dark panel",
    );
  });

  it("lifts the protected file's brand hover globally instead of editing it", () => {
    // Proof the hero keeps its original class AND is still correct.
    const hero = read("components/home-hero.tsx");
    assert.ok(
      /hover:text-\[var\(--v3-brand\)\]/.test(hero),
      "home-hero.tsx must be left as authored, not migrated",
    );
    assert.ok(
      !/hover:text-\[var\(--v3-brand-ink\)\]/.test(hero),
      "home-hero.tsx must not be edited by this phase",
    );
    assert.match(
      GLOBALS,
      /html\.dark \.hover\\:text-\\\[var\\\(--v3-brand\\\)\\\]:hover\s*\{[^}]*color:\s*#e8a0b8/,
      "globals.css must lift that hover so the protected file stays correct",
    );
  });

  it("left every burgundy fill alone", () => {
    // Fills keep --v3-brand. White on it is 10.7:1 and it is correct in
    // both themes; lightening it would weaken the brand and break every
    // filled button on the site.
    // Counts taken from the pre-Tier-2 source, so a drop means a fill was
    // migrated to ink by mistake. They are exact, not floors: the migration
    // was a mechanical rewrite of `text-[var(--v3-brand)]` only, so no fill
    // count should move at all.
    const FILLS: Array<[string, number]> = [
      ["components/storefront-header.tsx", 3],
      ["components/catalogue-product-table.tsx", 4],
      ["components/search-experience.tsx", 4],
      ["components/header-search.tsx", 3],
      ["components/catalogue-view-switcher.tsx", 1],
      ["components/vehicle-quick-selector.tsx", 1],
    ];
    for (const [p, expected] of FILLS) {
      const n = (codeOf(read(p)).match(/bg-\[var\(--v3-brand\)\]/g) ?? []).length;
      assert.equal(
        n,
        expected,
        `${p} has ${n} burgundy fills, expected ${expected}; a fill was migrated to ink by mistake`,
      );
    }
  });

  it("kept the cart button a burgundy fill with white text", () => {
    const h = read("components/storefront-header.tsx");
    assert.match(
      h,
      /href="\/cart"[\s\S]{0,320}?bg-\[var\(--v3-brand\)\] text-white/,
      "the cart control is the header's one filled action and must stay burgundy",
    );
  });

  it("remaps the raw burgundy literal, plain and hovered", () => {
    // Two class tokens, so two rules. `text-[#7a1233]` is used by ~27
    // storefront links; `hover:text-[#7a1233]` by 4 product titles.
    // The CSS escapes the brackets; in a JS RegExp source that is
    // `text-\\\[\\#7a1233\\\]`.
    assert.match(GLOBALS, /html\.dark \.text-\\\[\\#7a1233\\\] \{/);
    assert.match(GLOBALS, /html\.dark \.hover\\:text-\\\[\\#7a1233\\\]:hover \{/);
  });

  it("defines --v3-brand-ink in light as the burgundy fill, so light is identical", () => {
    const rootBlock = /\n:root\s*\{([\s\S]*?)\n\}/.exec(V3);
    assert.ok(rootBlock, "v3.css must have a :root block");
    const brand = /--v3-brand:\s*(#[0-9a-f]{6})/i.exec(rootBlock[1])?.[1];
    const ink = /--v3-brand-ink:\s*(#[0-9a-f]{6})/i.exec(rootBlock[1])?.[1];
    assert.equal(
      ink,
      brand,
      "in light mode brand-ink must equal brand, or this phase restyles the default theme",
    );
  });
});

/* ================================================================= *
 * 4. THE HARDCODED LIGHT CHIPS
 * ================================================================= */

describe("tier 2: hardcoded light chips", () => {
  const FORBIDDEN: Array<[string, string]> = [
    ["#f5dfe3", "LIST price chip - now --v3-brand-soft"],
    ["#e5f1d9", "DISC chip - now --v3-ok-soft"],
    ["#eec4c1", "error notice border - now --v3-bad-line"],
    ["#bfe0d1", "success notice border - now --v3-ok-line"],
    ["#ead6d7", "selection bar - now --v3-brand-soft"],
    ["#d8b9bc", "selection bar rule - now --v3-brand-line"],
  ];

  for (const [hex, why] of FORBIDDEN) {
    it(`no storefront surface still hardcodes ${hex} (${why})`, () => {
      const hits = STOREFRONT.filter((f) => f.source.includes(hex));
      assert.deepEqual(
        hits.map((h) => h.path),
        [],
        `${hex} is a hardcoded light value with no dark counterpart`,
      );
    });
  }

  it("preserved the % OFF corner badge, which is a deliberate fill", () => {
    // `bg-[#4b7d1c] text-white` is white on olive at 4.6:1 - acceptable, and
    // a chosen colour rather than a light-on-dark defect. Only the paired
    // chip and the bare-text discount went to the v3 tokens.
    const src = read("components/search-product-card.tsx");
    assert.match(src, /bg-\[#4b7d1c\]/, "the % OFF badge fill must survive");
    assert.match(
      src,
      /bg-\[#4b7d1c\][^"]*text-white/,
      "the % OFF badge keeps white text on its fill",
    );
  });

  it("kept the semantic pairings apart", () => {
    // A discount must not be rendered as a success, or an error as a sale.
    const card = read("components/search-product-card.tsx");
    assert.match(
      card,
      /bg-\[var\(--v3-brand-soft\)\][^"]*text-\[var\(--v3-brand-ink\)\]/,
      "the LIST chip keeps the brand pair",
    );
    assert.match(
      card,
      /bg-\[var\(--v3-ok-soft\)\][^"]*text-\[var\(--v3-ok\)\]/,
      "the DISC chip keeps the ok pair",
    );
    const states = read("components/page-states.tsx");
    assert.match(states, /border-\[var\(--v3-ok-line\)\][^"]*text-\[var\(--v3-ok\)\]/);
    assert.match(states, /border-\[var\(--v3-bad-line\)\][^"]*text-\[var\(--v3-bad\)\]/);
  });
});

/* ================================================================= *
 * 5. THE NON-V3 FOCUS STATES
 * ================================================================= */

describe("tier 2: focus on the non-V3 storefront forms", () => {
  it("neutralises focus:bg-white, which flashed a white field with white text", () => {
    // `.focus\:bg-white:focus` is (0,2,0) and beats `html.dark input`
    // (0,1,2), so the field went #ffffff while its text was #f1f5f9.
    assert.match(
      GLOBALS,
      /html\.dark \.focus\\:bg-white:focus\s*\{[^}]*background-color:\s*#10141c/,
    );
  });

  it("lifts focus:border-slate-950 to the v3 strong-rule value", () => {
    // #020617 on a #10141c field is 1.2:1: keyboard focus was invisible.
    assert.match(
      GLOBALS,
      /html\.dark \.focus\\:border-slate-950:focus\s*\{[^}]*border-color:\s*#5b6a85/,
    );
  });

  it("lifts the 10% slate-950 ring to something visible", () => {
    assert.match(GLOBALS, /html\.dark \.focus\\:ring-slate-950\\\/10:focus/);
  });

  it("lifts the focus-visible ring on the secondary buttons", () => {
    assert.match(GLOBALS, /html\.dark \.focus-visible\\:ring-slate-950:focus-visible/);
  });

  it("never removes a focus indicator - only recolours it", () => {
    // Every rule in the focus family sets a colour, and none sets
    // `outline: none` or `box-shadow: none`.
    const focusRules = [...GLOBALS.matchAll(/html\.dark [^{]*focus[^{]*\{([^}]*)\}/g)].map(
      (m) => m[1],
    );
    assert.ok(focusRules.length >= 4, "expected the focus rules to still be present");
    for (const body of focusRules) {
      assert.ok(
        !/outline\s*:\s*none/.test(body),
        "a dark rule removes the focus outline; focus must stay visible",
      );
      assert.ok(
        !/box-shadow\s*:\s*none/.test(body),
        "a dark rule removes the focus ring; focus must stay visible",
      );
    }
  });
});

/* ================================================================= *
 * 6. THE PRODUCT MODAL GALLERY
 * ================================================================= */

describe("tier 2: the product modal gallery", () => {
  const MODAL = read("components/product-detail-modal.tsx");

  it("no longer hardcodes the light gallery surface", () => {
    // Comments are stripped: the replacement note quotes #f6f7f9 to explain
    // what it replaced and why.
    const bare = codeOf(MODAL);
    assert.ok(
      !/bg-\[#f6f7f9\]/.test(bare),
      "the gallery column must use a v3 token, not a bare hex",
    );
    assert.match(bare, /bg-\[var\(--v3-sunk\)\]/);
  });

  it("gives the six floating gallery controls a visible edge", () => {
    // Each was `bg-white` on a surface that also became #161b24, so the
    // control and its background became the same colour. A border restores
    // the boundary in both themes.
    const edgeCount = (MODAL.match(/border-\[var\(--v3-rule-strong\)\]/g) ?? []).length;
    assert.ok(
      edgeCount >= 7,
      `expected a border on the close button, the 360 button, zoom and 4 arrows; found ${edgeCount}`,
    );
  });

  it("keeps the product stage near-white, because the photography needs it", () => {
    // Most product shots are on white. A dark stage turns them into white
    // rectangles floating on black. The stage is v3-panel on purpose.
    assert.match(MODAL, /rounded-2xl bg-\[var\(--v3-panel\)\]/);
  });

  it("recolours the inactive gallery dot off bg-slate-300", () => {
    // `bg-slate-300` is not in any dark allow-list, so the inactive dots
    // stayed #cbd5e1 on a dark stage. Comments stripped: the replacement
    // note names the old class.
    const bare = codeOf(MODAL);
    assert.ok(!/\bbg-slate-300\b/.test(bare), "bg-slate-300 is not remapped for dark");
    assert.match(bare, /w-1\.5 bg-\[var\(--v3-rule-strong\)\]/);
  });

  it("keeps the active dot a burgundy fill", () => {
    assert.match(MODAL, /w-5 bg-\[var\(--v3-brand\)\]/);
  });

  it("keeps WhatsApp branding green", () => {
    // The icon is a fixed #25D366 glyph, which is brand-legal on any ground.
    assert.match(MODAL, /WhatsAppIcon/);
    assert.match(
      MODAL,
      /border-\[var\(--v3-ok-line\)\] bg-\[var\(--v3-ok-soft\)\][^"]*text-\[var\(--v3-ok\)\]/,
      "the WhatsApp CTA keeps a green surface and a green label via the ok pair",
    );
  });

  it("keeps the quantity stepper and add-to-cart functional", () => {
    assert.match(MODAL, /decreaseQuantity/);
    assert.match(MODAL, /increaseQuantity|setQuantity/);
    assert.match(MODAL, /bg-\[#7a1233\][^"]*text-white|addToCart|addToCartBusy/);
  });

  it("moved the stock tone onto the v3 state pairs", () => {
    // `text-emerald-800` was remapped to PINK by the pre-existing globals
    // rule, so an in-stock pill rendered rose. Comments stripped: the
    // replacement note names the class it removed.
    const bare = codeOf(MODAL);
    assert.ok(!/text-emerald-800/.test(bare), "the pink-rendered stock class is gone");
    assert.match(bare, /bg-\[var\(--v3-ok-soft\)\] text-\[var\(--v3-ok\)\]/);
    assert.match(bare, /bg-\[var\(--v3-bad-soft\)\] text-\[var\(--v3-bad\)\]/);
    // And the neutral tone, which was `bg-slate-100 text-slate-600`.
    assert.match(bare, /bg-\[var\(--v3-sunk\)\] text-\[var\(--v3-text-2\)\]/);
  });
});

/* ================================================================= *
 * 7. THE FOOTER DECISION
 * ================================================================= */

describe("tier 2: the footer is left as an intentional light surface", () => {
  it("no component was changed to force a footer treatment", () => {
    // The audit called footer appearance a design decision, not a
    // readability defect. Tier 2 must not have quietly resolved it.
    const footer = STOREFRONT.find((f) => f.path === "components/site-footer.tsx");
    assert.ok(footer, "site-footer.tsx must exist");
    assert.ok(
      !/brand-logo-plate|v3-brand-ink/.test(footer.source),
      "site-footer.tsx must be untouched by Tier 2",
    );
  });

  it("the footer ground is still remapped, so the decision is visible not accidental", () => {
    // Phase 1 already gave the footer a dark ground. That is a legibility
    // repair for the footer INK, not a redesign of the band: the three-band
    // structure, the gold bar and the logo treatment are unchanged. This test
    // records the state so a future change to it is deliberate.
    const dark = /html\.dark\s*\{([\s\S]*?)\n\}/.exec(V3);
    assert.ok(dark && /--v3-footer-surface:\s*#161b24/.test(dark[1]));
    // And the gold bar is still a separate filled band, not folded into the
    // ground.
    assert.match(read("app/v3.css"), /\.v3-footer-bar\s*\{\s*background:\s*var\(--v3-footer-gold\)/);
  });
});
