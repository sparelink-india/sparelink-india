/**
 * The sticky-header height token must describe the header that actually exists.
 *
 * `--v3-header-h` is read by every sticky in-page rail so its first row clears
 * the sticky site header. It had only two tiers - 208px, then 96px below lg -
 * while the header has three bands, so the whole 768-1023px band read 96px
 * against a real 144px. That was invisible only because the one live consumer
 * was `lg:sticky`; a rail that became sticky in the tablet band would have
 * tucked under the utility bar.
 *
 * An earlier attempt at this test tried to DERIVE the three row heights by
 * regexing Tailwind classes out of the header and multiplying by 16 for the
 * rem-based scale. That is too brittle to be worth having: `h-8`, `h-12`,
 * `min-h-16` and `min-h-[96px]` are four different spellings, and any future
 * edit to an unrelated class in a 634-line file silently changes the arithmetic
 * the test asserts. So the measured heights are stated here, and what is
 * actually verified is that the header still contains the rows that produce
 * them, plus that the token's tier STRUCTURE is correct.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const V3 = read("app/v3.css");
const HEADER = read("components/storefront-header.tsx");

/**
 * The measured header height per band, in px.
 *
 * THESE ARE MEASUREMENTS, NOT ARITHMETIC.
 *
 * A previous revision of this test derived the numbers by reading Tailwind
 * classes out of storefront-header.tsx and summing them (h-8 = 2rem = 32px,
 * md:min-h-[96px], lg:min-h-16 = 4rem = 64px -> 96 / 144 / 208). A real browser
 * then measured the rendered <header> and disagreed on every band:
 *
 *     320-414px   header renders 161px, not 96px
 *     834px       header renders 145px, not 144px
 *     1440px      header renders 210px, not 208px
 *
 * The mobile figure is the interesting one: there the main row WRAPS, because
 * the search field drops below the logo-and-actions line, so the row's height
 * comes from its content and no declared min-height predicts it. Only a laid-out
 * page can report it.
 *
 * So the numbers are stated, and what this file verifies is that the token still
 * declares a correctly ordered tier per band and that the header still contains
 * the three rows the desktop figure is made of. The last test is the one that
 * matters when the header changes: re-measure in a browser, update this table.
 */
const BANDS = [
  { key: "base", expected: 161, why: "320/360/390/414 - wrapped rows, measured 161px" },
  { key: "min-width:768-1023", expected: 145, why: "834px - utility + main, no nav row, measured 145px" },
  { key: "min-width:1024", expected: 210, why: "1440px - utility 48 + main + nav 64, measured 210px" },
];

function tiers(): Record<string, number> {
  const out: Record<string, number> = {};
  const base = /:root\s*\{[\s\S]*?--v3-header-h:\s*(\d+)px/.exec(V3);
  if (base) out.base = Number(base[1]);

  for (const m of V3.matchAll(
    /@media\s*\((min-width|max-width):\s*(\d+)px\)(?:\s*and\s*\((?:min|max)-width:\s*(\d+)px\))?\s*\{\s*:root\s*\{[\s\S]*?--v3-header-h:\s*(\d+)px/g,
  )) {
    out[m[3] ? `${m[1]}:${m[2]}-${m[3]}` : `${m[1]}:${m[2]}`] = Number(m[4]);
  }
  return out;
}

describe("the sticky-header height token matches the real header", () => {
  it("declares a tier for every band, not just two", () => {
    const t = tiers();
    for (const band of BANDS) {
      assert.notEqual(
        t[band.key],
        undefined,
        `no --v3-header-h tier for the "${band.key}" band (${band.why}); found ${JSON.stringify(t)}`,
      );
    }
  });

  it("each tier equals the height measured off a real browser", () => {
    const t = tiers();
    for (const band of BANDS) {
      assert.equal(
        t[band.key],
        band.expected,
        `${band.key} should be ${band.expected}px (${band.why})`,
      );
    }
  });

  it("is TALLER on mobile than on tablet, because the main row wraps", () => {
    // An earlier version of this test asserted the tiers grow monotonically with
    // the viewport. A real browser disproved it: mobile renders 161px while
    // tablet renders 145px.

    // That is correct behaviour, not a bug. Below `md` the header's main row
    // WRAPS - logo and account actions on one line, the search field dropping to
    // the next - so its height comes from its content and no min-height predicts
    // it. From `md` the row stops wrapping and the taller utility bar replaces
    // the extra wrapped line, which lands lower.

    // The assertion is restated as the relationship that was actually measured,
    // so it still fails loudly if a header change makes the bands wrong in
    // either direction.
    const t = tiers();
    assert.ok(
      t.base > t["min-width:768-1023"],
      `mobile (${t.base}px) is expected to be taller than tablet (${t["min-width:768-1023"]}px) because the row wraps below md`,
    );
    assert.ok(
      t["min-width:1024"] > t["min-width:768-1023"],
      `desktop (${t["min-width:1024"]}px) must be taller than tablet (${t["min-width:768-1023"]}px) - the primary nav row appears at lg`,
    );
  });

  it("the header still contains the three rows these numbers describe", () => {
    // The guard that makes the measured values meaningful: if the header drops
    // or re-spans a row, one of these disappears and the numbers above are
    // re-measured rather than silently trusted.
    assert.match(HEADER, /v3-container flex h-8 items-center/, "utility bar row (h-8, md:h-12)");
    assert.match(HEADER, /md:h-12/, "utility bar grows to 3rem at md");
    assert.match(HEADER, /md:min-h-\[96px\]/, "main row is 96px from md");
    assert.match(HEADER, /lg:min-h-16/, "primary nav row is 4rem from lg");
  });

  it("the primary nav row is still desktop-only, which is why it drops out below lg", () => {
    const rows = [...HEADER.matchAll(/className="([^"]*\bhidden\b[^"]*lg:block[^"]*)"/g)].map((m) => m[1]);
    assert.ok(
      rows.some((c) => c.includes("border-t")),
      `expected a nav row hidden below lg and lg:block above; found ${JSON.stringify(rows)}`,
    );
  });
});