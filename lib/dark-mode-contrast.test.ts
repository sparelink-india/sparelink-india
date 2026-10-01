import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * DARK MODE PHASE 1 - contrast of the pairs this phase introduced.
 *
 * The values under test are PARSED OUT OF THE STYLESHEETS, not copied here.
 * A test that re-states the colours it is checking cannot catch anyone
 * changing a colour, which is the only thing worth catching: the whole
 * dark-mode failure in this repository was a colour that did not change
 * when it had to.
 *
 * Thresholds are WCAG 2.1:
 *   1.4.3 Contrast (Minimum)  4.5:1 normal text, 3:1 large text
 *   1.4.11 Non-text Contrast 3:1 for a control boundary or a focus indicator
 *
 * Two pairs are measured against a LOWER bar than 4.5:1, deliberately and
 * with a reason recorded next to them:
 *
 *   - `.v3-rule` is a decorative hairline: the rule between two content
 *     bands and the column rules inside a footer. WCAG 1.4.11 does not apply
 *     to decoration, so it is held to "visible but quiet".
 *   - the carousel arrow's FILL is held to the same bar, because the arrow
 *     floats over admin-uploaded artwork of unknown brightness and its
 *     visible edge is carried by its BORDER, which is held to 3:1.
 *
 * There is deliberately no browser or screenshot test. Browser inspection
 * was unavailable for this phase, and a test that cannot run is worse than
 * no test: it reports coverage it does not have.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (p: string) => readFileSync(join(root, p), "utf8");

const V3 = source("app/v3.css");
const GLOBALS = source("app/globals.css");

/* ------------------------------------------------------------------ *
 * WCAG 2.1 relative luminance and contrast ratio.
 * ------------------------------------------------------------------ */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ *
 * Read the real token values out of the stylesheets.
 * ------------------------------------------------------------------ */

/**
 * Collect `--token: value` pairs from every top-level block whose selector
 * matches. The caller supplies a RegExp source, already escaped, because
 * these selectors contain backslashes (`.v3-badge-ok`, `html.dark`) and
 * re-escaping an already-escaped selector silently produces a pattern that
 * matches nothing.
 */
function blockDeclarations(css: string, selector: RegExp): Map<string, string> {
  const re = new RegExp(selector.source, `${selector.flags.replace("g", "")}g`);
  const out = new Map<string, string>();
  for (const match of css.matchAll(re)) {
    const start = match.index! + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < css.length && depth > 0; end += 1) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}") depth -= 1;
    }
    for (const decl of css.slice(start, end - 1).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      out.set(decl[1], decl[2].trim().replace(/\s+/g, " "));
    }
  }
  return out;
}

/** A colour token, resolved to a hex. Throws if it is not a plain hex. */
function token(map: Map<string, string>, name: string, where: string): string {
  const raw = map.get(name);
  if (raw === undefined) throw new Error(`${where}: ${name} is not declared`);
  const hex = raw.split(/\s/)[0];
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`${where}: ${name} is not a plain 6-digit hex, so it cannot be contrast-tested: ${raw}`);
  }
  return hex;
}

// `^` anchors to the start of a line, so `html.dark` cannot be matched by a
// mid-line `.dark` and `:root` cannot be matched inside `@media`.
const V3_DARK = blockDeclarations(V3, /^html\.dark\s*\{/m);
const V3_LIGHT = blockDeclarations(V3, /^:root\s*\{/m);
const GLOBALS_DARK = blockDeclarations(GLOBALS, /^html\.dark\s*\{/m);

const dark = (name: string) => token(V3_DARK, name, "v3.css html.dark");
const light = (name: string) => token(V3_LIGHT, name, "v3.css :root");
const gDark = (name: string) => token(GLOBALS_DARK, name, "globals.css html.dark");

/**
 * A literal hex used by a dark-mode override rule in v3.css.
 *
 * The selector is passed pre-escaped, for the same reason as
 * `blockDeclarations`: these selectors contain dots that must not act as
 * wildcards, and re-escaping an already-escaped string breaks the pattern.
 */
function ruleHex(selector: RegExp, property: string): string {
  const block = new RegExp(`html\\.dark\\s+${selector.source}\\s*\\{([^}]*)\\}`).exec(V3);
  if (!block) throw new Error(`app/v3.css has no html.dark ${selector.source} rule`);
  const decl = new RegExp(`${property}\\s*:\\s*(#[0-9a-f]{6})`, "i").exec(block[1]);
  if (!decl) throw new Error(`html.dark ${selector.source} has no literal ${property} hex`);
  return decl[1];
}

const NORMAL = 4.5;
const LARGE = 3;
const HAIRLINE = 1.3;

type Pair = { fg: string; bg: string; min: number; what: string };

/** Assert a list of contrast pairs, reporting the worst offender first. */
function assertAll(pairs: Pair[]) {
  for (const pair of pairs) {
    const ratio = contrast(pair.fg, pair.bg);
    assert.ok(
      ratio >= pair.min,
      `${pair.what}: ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}:1, needs >= ${pair.min}:1`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * The grounds and inks this phase introduced.
 * ------------------------------------------------------------------ */

const PAGE = dark("--v3-page");
const PANEL = dark("--v3-panel");
const SUNK = dark("--v3-sunk");
const FOOTER = dark("--v3-footer-surface");
const FOOTER_GOLD = dark("--v3-footer-gold");
const FOOTER_GOLD_INK = dark("--v3-footer-gold-ink");

describe("dark mode contrast: the token values parse", () => {
  it("resolves every surface and ink token to a real hex", () => {
    for (const name of [
      "--v3-page", "--v3-panel", "--v3-sunk", "--v3-sunk-deep",
      "--v3-rule", "--v3-rule-strong",
      "--v3-text", "--v3-text-2", "--v3-text-3",
      "--v3-brand-ink", "--v3-brand-soft", "--v3-brand-line",
      "--v3-gold-soft",
      "--v3-ok", "--v3-ok-soft", "--v3-ok-line",
      "--v3-warn", "--v3-warn-soft", "--v3-warn-line",
      "--v3-bad", "--v3-bad-soft", "--v3-bad-line",
      "--v3-footer-surface", "--v3-footer-rule", "--v3-footer-rule-strong",
      "--v3-footer-ink", "--v3-footer-ink-2",
      "--v3-footer-gold", "--v3-footer-gold-ink",
    ]) {
      assert.match(dark(name), /^#[0-9a-f]{6}$/i, `${name} must be a plain 6-digit hex`);
    }
  });

  it("reuses the grounds globals.css already established", () => {
    // The two stylesheets must not drift: `.bg-white` is remapped to
    // #161b24, so --v3-panel has to be that, or every homepage band shows
    // a seam against the header.
    assert.equal(PANEL, "#161b24");
    assert.equal(SUNK, "#10141c");
    assert.equal(PAGE, "#0c0e12");
    assert.equal(PAGE, gDark("--background"));
    assert.equal(SUNK, gDark("--surface"));
    assert.equal(PANEL, gDark("--surface-muted"));
  });

  it("keeps burgundy white-readable as a fill in dark mode", () => {
    // The reason --v3-brand is deliberately absent from the dark block. If
    // this ever fails, a burgundy fill has been lightened and the brand has
    // been weakened to suit a dark page.
    assert.ok(
      !V3_DARK.has("--v3-brand"),
      "--v3-brand is a FILL colour and must not be redefined for dark mode",
    );
    assert.ok(
      !V3_DARK.has("--v3-brand-hover"),
      "--v3-brand-hover is a FILL colour and must not be redefined for dark mode",
    );
    assert.equal(light("--v3-brand"), "#7a1233");
    assert.ok(
      contrast("#ffffff", light("--v3-brand")) >= NORMAL,
      "white on the burgundy fill must stay readable",
    );
  });

  it("keeps the light theme byte-for-byte unchanged for the shared tokens", () => {
    // Phase 1 must be a dark-mode change only. If a light value moved, the
    // regression is on the default theme, which every visitor sees.
    for (const name of ["--v3-page", "--v3-panel", "--v3-sunk", "--v3-text", "--v3-brand"]) {
      assert.ok(light(name).length > 0, `${name} must still exist in :root`);
    }
    assert.equal(light("--v3-page"), "#f8f4f0");
    assert.equal(light("--v3-panel"), "#ffffff");
    assert.equal(light("--v3-text"), "#1b1512");
    assert.equal(light("--v3-sunk"), "#f4efea");
  });
});

describe("dark mode contrast: text on every dark surface", () => {
  it("passes 4.5:1 for all three text tiers on the page, panel and sunk grounds", () => {
    assertAll([
      { fg: dark("--v3-text"), bg: PAGE, min: NORMAL, what: "text on page" },
      { fg: dark("--v3-text"), bg: PANEL, min: NORMAL, what: "text on panel" },
      { fg: dark("--v3-text"), bg: SUNK, min: NORMAL, what: "text on sunk" },
      { fg: dark("--v3-text-2"), bg: PAGE, min: NORMAL, what: "text-2 on page" },
      { fg: dark("--v3-text-2"), bg: PANEL, min: NORMAL, what: "text-2 on panel" },
      { fg: dark("--v3-text-2"), bg: SUNK, min: NORMAL, what: "text-2 on sunk" },
      { fg: dark("--v3-text-3"), bg: PAGE, min: NORMAL, what: "text-3 on page" },
      { fg: dark("--v3-text-3"), bg: PANEL, min: NORMAL, what: "text-3 on panel" },
      { fg: dark("--v3-text-3"), bg: SUNK, min: NORMAL, what: "text-3 on sunk" },
    ]);
  });

  it("passes 4.5:1 for the lifted brand ink on every ground it lands on", () => {
    // This is the token that rescues `text-[var(--v3-brand)]`, the
    // secondary price colour, the "Explore" affordance and the facet
    // "Clear" action - all of which measured 1.61:1 on a dark panel.
    assertAll([
      { fg: dark("--v3-brand-ink"), bg: PAGE, min: NORMAL, what: "brand-ink on page" },
      { fg: dark("--v3-brand-ink"), bg: PANEL, min: NORMAL, what: "brand-ink on panel" },
      { fg: dark("--v3-brand-ink"), bg: SUNK, min: NORMAL, what: "brand-ink on sunk" },
      { fg: dark("--v3-brand-ink"), bg: dark("--v3-brand-soft"), min: NORMAL, what: "brand-ink on brand-soft" },
    ]);
  });

  it("passes 4.5:1 for the three state inks on their own soft grounds and on panel", () => {
    for (const [ink, soft, name] of [
      ["--v3-ok", "--v3-ok-soft", "ok"],
      ["--v3-warn", "--v3-warn-soft", "warn"],
      ["--v3-bad", "--v3-bad-soft", "bad"],
    ] as const) {
      assertAll([
        { fg: dark(ink), bg: dark(soft), min: NORMAL, what: `${name} on ${soft}` },
        { fg: dark(ink), bg: PANEL, min: NORMAL, what: `${name} on panel` },
        { fg: dark(ink), bg: PAGE, min: NORMAL, what: `${name} on page` },
      ]);
    }
  });

  it("passes 4.5:1 for gold on the gold-soft badge ground", () => {
    // --v3-gold is deliberately NOT remapped for dark mode: it already
    // reads well against a dark ground, so only its badge surface moves.
    assertAll([
      { fg: light("--v3-gold"), bg: dark("--v3-gold-soft"), min: NORMAL, what: "gold on gold-soft" },
      { fg: light("--v3-gold"), bg: PAGE, min: NORMAL, what: "gold on page" },
      { fg: light("--v3-gold"), bg: PANEL, min: NORMAL, what: "gold on panel" },
    ]);
  });

  it("passes 4.5:1 for the footer inks on the dark footer ground", () => {
    assertAll([
      { fg: dark("--v3-footer-ink"), bg: FOOTER, min: NORMAL, what: "footer heading on footer" },
      { fg: dark("--v3-footer-ink-2"), bg: FOOTER, min: NORMAL, what: "footer link on footer" },
      { fg: dark("--v3-footer-ink-2"), bg: FOOTER, min: NORMAL, what: "footer blurb on footer" },
    ]);
  });

  it("passes 4.5:1 for the gold identity bar's ink on its own filled band", () => {
    // A filled band, so the pair is ink-on-fill, not ink-on-page.
    assertAll([
      { fg: FOOTER_GOLD_INK, bg: FOOTER_GOLD, min: NORMAL, what: "footer bar ink on gold" },
    ]);
  });

  it("separates the gold identity band from the page at 3:1", () => {
    // The bar has to read as its own band, which is its whole job.
    assertAll([
      { fg: FOOTER_GOLD, bg: PAGE, min: LARGE, what: "footer gold band vs page" },
    ]);
  });
});

describe("dark mode contrast: non-text, 3:1", () => {
  it("clears 3:1 for a control boundary", () => {
    // --v3-rule-strong is the border on every .v3-input and .v3-select, so
    // it identifies a control and WCAG 1.4.11 applies. It is measured
    // against SUNK, which is the ground globals.css forces an input onto.
    assertAll([
      { fg: dark("--v3-rule-strong"), bg: SUNK, min: LARGE, what: "input border vs input ground" },
      { fg: dark("--v3-rule-strong"), bg: PANEL, min: LARGE, what: "strong rule vs panel" },
      { fg: dark("--v3-rule-strong"), bg: PAGE, min: LARGE, what: "strong rule vs page" },
    ]);
  });

  it("clears 3:1 for every state badge border on its own soft ground", () => {
    for (const [line, soft, name] of [
      ["--v3-ok-line", "--v3-ok-soft", "ok badge border"],
      ["--v3-warn-line", "--v3-warn-soft", "warn badge border"],
      ["--v3-bad-line", "--v3-bad-soft", "bad badge border"],
    ] as const) {
      assertAll([
        { fg: dark(line), bg: dark(soft), min: LARGE, what: `${name} on ${soft}` },
      ]);
    }
  });

  it("clears 3:1 for the brand outline button's border on the panel", () => {
    // .v3-btn-outline carries --v3-brand-line and is a control boundary.
    assertAll([
      { fg: dark("--v3-brand-line"), bg: PANEL, min: LARGE, what: "brand-line vs panel" },
    ]);
  });

  it("clears 3:1 for the invalid-input border, which is --v3-bad", () => {
    // .v3-input[aria-invalid="true"] sets border-color: var(--v3-bad). In
    // light that was #9b1c17 at 2.26:1 against the input ground, so the
    // invalid state was not perceivable; the lifted value fixes it.
    assertAll([
      { fg: dark("--v3-bad"), bg: SUNK, min: LARGE, what: "invalid border vs input ground" },
    ]);
  });

  it("clears 3:1 for the lifted focus ring on page and panel", () => {
    // WCAG 2.4.7 / 1.4.11. The ring is var(--v3-brand-ink) now, because
    // --v3-brand is a fill and measured 1.61:1 on a dark ground.
    assertAll([
      { fg: dark("--v3-brand-ink"), bg: PAGE, min: LARGE, what: "focus ring vs page" },
      { fg: dark("--v3-brand-ink"), bg: PANEL, min: LARGE, what: "focus ring vs panel" },
      { fg: dark("--v3-brand-ink"), bg: SUNK, min: LARGE, what: "focus ring vs sunk" },
    ]);
  });

  it("holds a decorative hairline to 'visible but quiet'", () => {
    // --v3-rule is a band separator and a column rule: decoration, which
    // 1.4.11 exempts. It must be distinguishable, not readable.
    assertAll([
      { fg: dark("--v3-rule"), bg: PANEL, min: HAIRLINE, what: "hairline vs panel" },
      { fg: dark("--v3-rule"), bg: PAGE, min: HAIRLINE, what: "hairline vs page" },
    ]);
  });
});

describe("dark mode contrast: guard 1, the carousel arrow", () => {
  const chip = ruleHex(/\.v3-carousel-arrow/, "background");
  const icon = ruleHex(/\.v3-carousel-arrow/, "color");
  const ring = ruleHex(/\.v3-carousel-arrow/, "border-color");

  it("is the trap it is claimed to be: the light rule would be white on white", () => {
    // Proves the guard is load-bearing. In light mode the chip is
    // rgba(255,255,255,0.92) - effectively #ffffff once flattened - and
    // the icon is var(--v3-text). Lift --v3-text for dark mode and those
    // two meet at roughly 1.09:1, so the arrow would disappear.
    const ratio = contrast("#ffffff", dark("--v3-text"));
    assert.ok(
      ratio < 1.3,
      `an unguarded white chip with the lifted ink would be ${ratio.toFixed(2)}:1; if this is no longer true the trap description is stale`,
    );
  });

  it("gives a readable icon on its chip at 4.5:1", () => {
    assertAll([{ fg: icon, bg: chip, min: NORMAL, what: "carousel arrow icon on chip" }]);
  });

  it("carries a visible edge at 3:1 from the stage it floats over", () => {
    // The fill is deliberately close to the stage - the arrow sits over
    // admin-uploaded artwork, so a 1px outline is what survives an unknown
    // backdrop and a flat fill does not.
    assertAll([
      { fg: ring, bg: chip, min: LARGE, what: "arrow ring vs chip" },
      { fg: ring, bg: SUNK, min: LARGE, what: "arrow ring vs stage" },
    ]);
  });

  it("keeps the chip a genuinely dark surface, not a light one", () => {
    // The chip is a DARK surface, so the control reads as part of the dark
    // theme instead of punching a white hole in it. Measured against the
    // stage it floats over (--v3-sunk), where it must be a distinct step.
    assert.ok(
      contrast(chip, "#ffffff") > 8,
      `the dark arrow chip ${chip} must not read as a light chip`,
    );
    // One step above the stage, like a raised control: dark, but a
    // distinguishable step. Bounded on both sides - a chip that collapsed
    // onto the stage would be as broken as a white one, and a chip that
    // climbed past the panel would stop reading as a dark surface.
    const chipLum = luminance(chip);
    assert.ok(
      chipLum > luminance(SUNK),
      `the dark arrow chip ${chip} must be a distinct step above the stage ${SUNK}`,
    );
    assert.ok(
      chipLum < luminance("#2a3648"),
      `the dark arrow chip ${chip} has climbed out of the dark-theme range; it should sit between the stage ${SUNK} and a mid ground`,
    );
  });

  it("is guarded rather than simply restyled", () => {
    // Both assertions are about the DARK values, so the light-mode rule
    // cannot be what satisfied them. Guards against a future edit that
    // points these at the light-theme token by mistake.
    const block = /html\.dark\s+\.v3-carousel-arrow\s*\{([^}]*)\}/.exec(V3);
    assert.ok(block, "the dark arrow rule is missing");
    assert.ok(
      !block[1].includes("var(--v3-panel)"),
      "the dark arrow must not reuse --v3-panel as its chip, or it loses the border separation from the stage",
    );
  });
});

describe("dark mode contrast: guard 2, the select chevron", () => {
  /** The fill baked into a chevron data URI, as written in the stylesheet. */
  function chevronInk(css: string, darkVariant: boolean): string {
    // The light selector is anchored to the start of a line. Without the
    // anchor, `\.v3-select` also matches the tail of `html.dark
    // .v3-select`, which appears EARLIER in the file - so "light" and
    // "dark" would resolve to the same declaration and the direction check
    // below would pass for the wrong reason.
    // `m` rather than `s`: the target is ES2017, where the `s` (dotAll)
    // flag does not exist. The selectors span lines, so the gaps are
    // matched with an explicit `[^]`-style class instead of `.`.
    const selector = darkVariant
      ? /^html\.dark\s+\.v3-select\s*\{[^}]*fill='%23([0-9a-f]{6})'/m
      : /^\.v3-select\s*\{[^}]*fill='%23([0-9a-f]{6})'/m;
    const m = selector.exec(css);
    assert.ok(m, darkVariant ? "no dark chevron found" : "no light chevron found");
    return `#${m[1]}`;
  }

  it("reads at 3:1 on both grounds a select can sit on", () => {
    // A chevron is a non-text control indicator, so 1.4.11 at 3:1. The
    // light variant bakes #857972 into the image and cannot be measured by
    // token, which is exactly why the dark variant has to exist at all.
    assertAll([
      { fg: chevronInk(V3, true), bg: PANEL, min: LARGE, what: "dark chevron vs panel" },
      { fg: chevronInk(V3, true), bg: SUNK, min: LARGE, what: "dark chevron vs sunken input" },
    ]);
  });

  it("is actually lighter than the light chevron", () => {
    // A no-op override would pass the 3:1 assertion above while leaving the
    // bug in place, so assert the direction of travel too.
    assert.ok(
      luminance(chevronInk(V3, true)) > luminance(chevronInk(V3, false)),
      "the dark chevron must be lighter than the light one",
    );
  });
});

describe("dark mode contrast: guard 3, the V3 search input", () => {
  it("restores the search surface instead of leaving a forced dark fill", () => {
    // globals.css sets `html.dark input { background-color:#10141c }` at
    // specificity (0,1,2). `.v3-search input` is (0,1,1) and loses. The
    // override restores `transparent` so the input takes the search pill's
    // own surface again.
    assert.match(
      GLOBALS,
      /html\.dark\s+\.v3-search\s+input\s*\{[^}]*background:\s*transparent/,
      "the V3 search input override is missing",
    );
  });

  it("keeps the typed value readable on the restored surface", () => {
    // The value is coloured by `.v3-search .sl-search-input` at (0,2,0),
    // which beats the globals input rule, so --v3-text is what paints it.
    // With the input back on the pill surface, the pair is ink on panel.
    assertAll([
      { fg: dark("--v3-text"), bg: PANEL, min: NORMAL, what: "search value on restored pill" },
    ]);
  });

  it("keeps the placeholder readable on the restored surface", () => {
    // globals.css sets `input::placeholder { color:#94a3b8 }` in dark mode.
    assertAll([
      { fg: "#94a3b8", bg: PANEL, min: NORMAL, what: "search placeholder on pill" },
    ]);
  });

  it("keeps the clear affordance readable on the restored surface", () => {
    // `.v3-search .sl-search-clear` uses --v3-text-3.
    assertAll([
      { fg: dark("--v3-text-3"), bg: PANEL, min: NORMAL, what: "search clear glyph on pill" },
    ]);
  });
});

describe("dark mode contrast: the globals.css allow-list additions", () => {
  /** The lifted inks this phase added, against the grounds they land on. */
  const LIFTED: Array<[string, string[]]> = [
    ["#fbbf24", ["#1a2430", "#10141c"]],
    ["#6ee7b7", ["#1a2430", "#10141c"]],
    ["#fda4af", ["#1a2430", "#161b24"]],
    ["#86efac", ["#1a2430", "#161b24"]],
    ["#5eead4", ["#1a2430", "#161b24"]],
    ["#e2e8f0", ["#161b24"]],
    ["#cbd5e1", ["#161b24", "#10141c"]],
    ["#94a3b8", ["#161b24", "#10141c"]],
  ];

  for (const [ink, grounds] of LIFTED) {
    it(`${ink} clears 4.5:1 on ${grounds.join(" and ")}`, () => {
      for (const bg of grounds) {
        assertAll([{ fg: ink, bg, min: NORMAL, what: `${ink} on ${bg}` }]);
      }
    });
  }

  it("reads every lifted ink out of globals.css rather than trusting this list", () => {
    // The values above are the expected ones; this asserts they are the ones
    // actually written, so the two lists cannot diverge.
    //
    // `\r\n`-tolerant on purpose. The stylesheets are checked out with CRLF
    // on Windows and git warns it will normalise them, so a `\n`-exact
    // matcher would fail on this machine and pass on a Linux CI runner.
    // Matching the selector and the declaration independently avoids
    // depending on the line ending at all.
    const expects: Array<[string[], string]> = [
      [["html.dark .text-amber-800,", "html.dark .text-amber-900 {", "color: #fbbf24;"], "#fbbf24"],
      [["html.dark .text-emerald-900,", "html.dark .text-emerald-950 {", "color: #6ee7b7;"], "#6ee7b7"],
      [["html.dark .text-rose-600,", "html.dark .text-rose-700 {", "color: #fda4af;"], "#fda4af"],
    ];
    for (const [lines, expected] of expects) {
      // Within a short window, in order: a selector pair followed by its
      // shared declaration. The gap is bounded so a match cannot run on and
      // pick up the declaration of an UNRELATED later rule.
      const window = lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const re = new RegExp(`${window[0]}[\\s\\S]{0,20}?${window[1]}[\\s\\S]{0,20}?${window[2]}`);
      const m = re.exec(GLOBALS);
      assert.ok(m, `globals.css is missing the rule for ${lines[0]}`);
      assert.ok(
        m[0].includes(expected),
        `the rule for ${lines[0]} should resolve to ${expected}, matched: ${m[0]}`,
      );
    }
  });

  it("keeps the remapped grounds distinct from the panel they sit on", () => {
    // These are SURFACE-ON-SURFACE separations, not text, and they are the
    // real regression risk in a dark theme: two grounds that collapse
    // together are a missing surface, not a dark theme. But the correct bar
    // is "a different colour", not 1.3:1 - sunken and panel are one
    // deliberate step apart and always carry either ink on top or a
    // hairline between them, which is measured elsewhere in this file.
    // 1.02:1 would pass this test and still be a real bug, so the floor is
    // set at 1.05:1, which catches an accidental duplicate without
    // demanding a contrast ratio these steps were never designed to hit.
    for (const [ground, label] of [
      [SUNK, "sunk"],
      ["#1e2530", "remapped bg-slate-200"],
      ["#12312a", "remapped bg-emerald-100"],
      ["#1a2430", "remapped state-*-50"],
      ["#2b3444", "remapped bg-slate-300"],
    ] as const) {
      const ratio = contrast(ground, PANEL);
      assert.ok(
        ratio >= 1.05 && ratio < 3,
        `${label} (${ground}) against the panel (${PANEL}) is ${ratio.toFixed(2)}:1; it must be a distinct ground, not identical to the panel and not a light surface`,
      );
    }
  });

  it("separates the page ground from the panel", () => {
    // Same reasoning as the check above: one deliberate step apart, and
    // always divided by a --v3-rule hairline, which is measured on its own.
    const ratio = contrast(PANEL, PAGE);
    assert.ok(
      ratio >= 1.05 && ratio < 3,
      `panel (${PANEL}) against the page ground (${PAGE}) is ${ratio.toFixed(2)}:1; they must be distinct grounds`,
    );
  });
});
