/**
 * Tier 3 dark-mode coverage.
 *
 * Tier 1 and Tier 2 remapped the page grounds, the type families and one
 * shared focus shape. This file pins the Tier 3 entries, and more usefully it
 * pins the METHOD that found them, because the whole allow-list is
 * hand-maintained and the failure mode of a hand-maintained list is silence:
 * a new component reaches for `text-rose-950`, matches nothing, and ships a
 * 1.4:1 bug with no test to fail.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const GLOBALS = read("app/globals.css");

const SKIP = new Set(["node_modules", ".next", ".git", "_backups", ".vercel"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : walk(p);
    return /\.(tsx|ts)$/.test(e.name) ? [p] : [];
  });
}

/** Storefront sources only - admin is out of scope for this file. */
const STOREFRONT = [...walk(join(root, "app")), ...walk(join(root, "components"))]
  .map((p) => ({ path: relative(root, p).replace(/\\/g, "/"), source: readFileSync(p, "utf8") }))
  .filter(
    (f) =>
      // Admin and dealer are separate surfaces with their own theming, and the
      // brief for this work excludes both. Only the customer storefront is asserted.
      !/\/admin\//.test(f.path) &&
      !/\/admin-[^/]*\.tsx$/.test(f.path) &&
      !/\/dealer\//.test(f.path),
  )
  // Comments explain past bugs; they must not be read as live call sites.
  .map((f) => ({
    path: f.path,
    code: f.source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""),
  }));

/** Every class token declared as a selector target inside an `html.dark` rule. */
function darkAllowList(): Set<string> {
  const covered = new Set<string>();
  const lines = GLOBALS.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*html\.dark/.test(lines[i])) continue;
    let selector = lines[i];
    let j = i;
    while (/,\s*$/.test(selector) && j + 1 < lines.length) {
      j++;
      selector += " " + lines[j];
    }
    for (const m of selector.matchAll(/\.((?:[\w-]+\\:?)*[\w-]+(?:\\?\/[\w]+)?)/g)) {
      const token = m[1].replace(/\\/g, "");
      covered.add(token);
      covered.add(token.replace(/^[\w-]+:/, ""));
    }
    i = j;
  }
  return covered;
}

describe("tier 3: the specific gaps are closed", () => {
  /* A fill token used as ink. Found while migrating the header's theme and
     language control, which is the one piece of chrome a visitor is guaranteed
     to look at - and the control that tells them which theme they are in.

     It read `bg-white ... text-[var(--brand)]`. `--brand` is #7a1233 in BOTH
     themes (it is a fill, and v3.css documents using it as ink at 1.61:1 on a
     dark ground), while `bg-white` is remapped to #161b24 in dark mode. So the
     SELECTED option was #7a1233 on #161b24 - 1.4:1, and unreadable. */
  it("the preference control uses brand-INK, not the brand fill, on the selected option", () => {
    // Comments are stripped first: the note above `optionClass` QUOTES
    // `text-[var(--brand)]` to explain why it was removed, and a raw-source
    // assertion would fail on its own explanation.
    const toggle = read("components/header-preference-toggle.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(
      toggle,
      /text-\[var\(--brand\)\]/,
      "--brand is a fill (#7a1233 in both themes); as ink it is 1.61:1 on dark",
    );
    assert.match(
      toggle,
      /text-\[var\(--v3-brand-ink\)\]/,
      "the selected option must use the token that stays readable in both themes",
    );
  });

  it("states the selected option's ground rather than inheriting the bg-white remap", () => {
    const toggle = read("components/header-preference-toggle.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.match(
      toggle,
      /bg-\[var\(--v3-panel\)\][^"]*font-bold text-\[var\(--v3-brand-ink\)\]/,
      "the selected pill should be an explicit panel ground with brand-ink text",
    );
  });

  it("lifts text-rose-950 so an invalid GSTIN is not invisible in dark mode", () => {
    // #881337 on the #10141c dark field is ~1.4:1. The user typed a wrong
    // GSTIN and the field showed them nothing.
    assert.match(GLOBALS, /html\.dark \.text-rose-950\s*\{\s*color:\s*#fecdd3;/);
  });

  it("keeps the visible-value contract: rose-950 now matches the tier 1 rose", () => {
    const rose950 = GLOBALS.match(/html\.dark \.text-rose-950\s*\{\s*color:\s*(#[0-9a-f]{6});/i)?.[1];
    const rose800 = GLOBALS.match(/html\.dark \.text-rose-800,[\s\S]*?color:\s*(#[0-9a-f]{6});/i)?.[1];
    assert.equal(rose950, rose800, "both invalid-text states must read the same in dark mode");
  });

  it("restores keyboard focus on the zinc focus shape", () => {
    assert.match(GLOBALS, /html\.dark \.focus\\:border-zinc-950:focus\s*\{/);
  });

  it("pairs every remapped status ground with a remapped status border", () => {
    for (const family of ["rose", "emerald", "amber"]) {
      assert.match(
        GLOBALS,
        new RegExp(`html\\.dark \\.border-${family}-200`),
        `border-${family}-200 must be remapped: the ground is already dark`,
      );
      assert.match(GLOBALS, new RegExp(`html\\.dark \\.bg-${family}-50`));
    }
  });

  it("remaps the neutral hairline used to divide order rows", () => {
    assert.match(GLOBALS, /html\.dark \.border-zinc-100/);
    assert.match(GLOBALS, /html\.dark \.divide-zinc-100/);
  });

  it("keeps the /80 spelling of the profile panel dark", () => {
    assert.match(GLOBALS, /html\.dark \.bg-slate-100\\\/80/);
  });
});

describe("the dark allow-list has no customer-facing hole left", () => {
  /**
   * Utilities whose value is intentional in BOTH themes: translucent white over
   * an already-dark band, a solid dark fill, or white ink on a dark band.
   * Each is documented at its call site in globals.css. Adding to this list is
   * how the invariant stays honest - it is not a place to hide a bug.
   */
  const THEME_INVARIANT = new Set([
    "text-white", "bg-black", "text-black",
    "bg-white/10", "bg-white/15", "bg-white/20", "bg-white/25",
    "border-white/10", "border-white/25",
    "text-white/30", "text-white/45", "text-white/55", "text-white/60",
    "text-white/65", "text-white/70", "text-white/75", "text-white/80", "text-white/85",
    // Dark fills and translucent dark fills. These are the intended surface in
    // BOTH themes - a charcoal command band does not become paper in dark mode.
    "bg-slate-800", "bg-slate-900", "bg-slate-950", "bg-zinc-950",
    "bg-slate-900/80", "bg-slate-950/80", "bg-slate-950/70", "bg-zinc-950/60",
    "bg-zinc-950/50",
    // Hover states that darken or lighten correctly against either ground:
    // slate-800 hover on a dark card, white ink on an already-dark band.
    "hover:bg-slate-800", "hover:text-white", "dark:hover:text-slate-200",
    "hover:border-slate-400",
    // A soft shadow ring, and a light hairline drawn around a product thumbnail
    // where it reads as a neutral frame rather than a halo.
    "ring-black/10", "ring-slate-200",
    // Deliberate brand/accent inks that clear AA on the dark grounds they sit on:
    // rose-500 on #10141c is 4.8:1, emerald-600 is 5.1:1.
    "text-rose-500", "text-emerald-600", "bg-emerald-500", "bg-emerald-600",
    // Colour-on-colour status affordances (focus border + matching ring), kept
    // as authored: the colour IS the state cue, and both clear AA on dark.
    "focus:border-rose-500", "focus:ring-rose-500/10",
    "focus:border-emerald-600", "focus:ring-emerald-500/10",
    "border-emerald-500",
  ]);

  it("no storefront colour utility is outside the allow-list", () => {
    const covered = darkAllowList();
    const pattern =
      /\b((?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|to|via|placeholder|divide|decoration|outline)-(?:white|black|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d{1,3})?)\b/g;

    const holes: string[] = [];
    for (const file of STOREFRONT) {
      for (const m of file.code.matchAll(pattern)) {
        const token = m[1];
        if (THEME_INVARIANT.has(token)) continue;
        const bare = token.replace(/^[\w-]+:/, "");
        if (covered.has(token) || covered.has(bare)) continue;
        const line = file.code.slice(0, m.index).split("\n").length;
        holes.push(`${file.path}:${line} ${token}`);
      }
    }

    assert.deepEqual(
      holes,
      [],
      `these storefront utilities are not remapped by app/globals.css:\n  ${holes.join("\n  ")}`,
    );
  });
});