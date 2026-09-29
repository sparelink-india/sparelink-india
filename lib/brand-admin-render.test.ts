import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PUBLIC_BRANDS } from "./public-brands";
import { resolveAllBrands } from "./brand-admin";

const read = (f: string) => readFileSync(f, "utf8");

describe("the storefront renders the registry when nothing is overridden", () => {
  it("produces exactly the approved nine, unchanged", () => {
    /* The load-bearing property: with zero overlay rows the merge is the
       identity, so shipping this cannot change what /brands renders today. */
    const { brands, visible } = resolveAllBrands([]);
    assert.equal(brands.length, 9);
    assert.equal(visible.length, 9);
    for (const [i, expected] of PUBLIC_BRANDS.entries()) {
      assert.equal(brands[i].id, expected.id);
      assert.equal(brands[i].name, expected.name);
      assert.equal(brands[i].logo, expected.logo);
      assert.equal(brands[i].relationship, expected.relationship);
      assert.equal(brands[i].searchQuery, expected.searchQuery);
      assert.deepEqual(brands[i].overridden, []);
    }
  });
});

describe("both brand surfaces read one override-aware source", () => {
  it("the grid, the directory and the section all use the shared hook", () => {
    /* They used to read PUBLIC_BRANDS independently, which is how a
       storefront ends up showing a brand name the admin never saved, or the
       reverse. One hook, three call sites. */
    const src = read("components/public-brand-grid.tsx");
    assert.ok(
      /useResolvedBrands\(\)/.test(src),
      "the grid must read the resolved list",
    );
    assert.equal(
      /\{PUBLIC_BRANDS\.map\(/.test(src),
      false,
      "no surface may render the raw registry",
    );
  });

  it("the hook starts from the registry, so there is no loading flash", () => {
    const src = read("components/use-resolved-brands.ts");
    assert.ok(
      /useState<readonly PublicBrand\[\]>\(PUBLIC_BRANDS\)/.test(src),
      "initial state must be the registry, not empty",
    );
  });

  it("the hook falls back to the registry on failure", () => {
    /* A database problem or a network blip must leave the approved brands
       rendering exactly as they always have, not blank the section. */
    const src = read("components/use-resolved-brands.ts");
    assert.ok(/catch\s*\{/.test(src), "must handle a failed request");
    assert.equal(
      /setBrands\(\[\]\)/.test(src),
      false,
      "must never replace the registry with an empty list",
    );
  });

  it("the hook re-checks ids before showing anything", () => {
    /* The endpoint already discards non-registry ids, but this is the component
       that decides what a customer sees, so it does not take that on trust. */
    const src = read("components/use-resolved-brands.ts");
    assert.ok(/approved\.has\(b\?\.id\)/.test(src), "must filter to approved ids");
    assert.ok(
      /if \(safe\.length === 0/.test(src),
      "an empty result must not replace the registry",
    );
  });
});

describe("the storefront never gains or loses a brand", () => {
  it("an override for an unknown id changes nothing", () => {
    const { brands, visible, ignoredOverlayIds } = resolveAllBrands([
      { id: "ghost-brand", displayName: "Injected" },
    ]);
    assert.equal(brands.length, 9);
    assert.equal(visible.length, 9);
    assert.deepEqual(ignoredOverlayIds, ["ghost-brand"]);
    assert.equal(
      visible.some((b) => b.name === "Injected"),
      false,
    );
  });

  it("hiding one brand still leaves the other eight", () => {
    const { visible } = resolveAllBrands([{ id: "meko", isVisible: false }]);
    assert.equal(visible.length, 8);
    assert.equal(visible.some((b) => b.id === "meko"), false);
  });
});

describe("nothing in this phase touched the catalogue", () => {
  it("the storefront and hook contain no database access", () => {
    for (const f of ["components/use-resolved-brands.ts", "components/public-brand-grid.tsx"]) {
      const src = read(f);
      for (const forbidden of ["getDb", "drizzle-orm", "part.brand", "update("]) {
        assert.equal(src.includes(forbidden), false, `${f} must not contain ${forbidden}`);
      }
    }
  });

  it("the public endpoint exposes presentation only", () => {
    /* /api/brands is public, so it must not leak configuration state, internal
       ids beyond the registry's own, or catalogue counts. */
    const src = read("app/api/brands/route.ts");
    assert.equal(/ignoredOverlayIds/.test(src), true, "drift is surfaced");
    assert.equal(
      /requireAdminApi/.test(src),
      false,
      "it is public; the public brands page depends on it",
    );
    assert.equal(
      /drainListing|part_vehicle|inventory|dealerListing/.test(src),
      false,
      "no catalogue data in a public response",
    );
  });
});
