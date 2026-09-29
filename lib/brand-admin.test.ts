import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { PUBLIC_BRANDS } from "./public-brands";
import {
  BRAND_OVERRIDE_FIELDS,
  PUBLIC_BRAND_IDS,
  describeReset,
  resolveAllBrands,
  resolveBrand,
  validateBrandOverrides,
  type BrandProfileRow,
} from "./brand-admin";

const meko = PUBLIC_BRANDS.find((b) => b.id === "meko")!;

describe("the nine approved public brands are the id space", () => {
  it("has all nine, unchanged", () => {
    assert.deepEqual(PUBLIC_BRAND_IDS, [
      "01",
      "meko",
      "starlinks",
      "03",
      "pensol",
      "superseal",
      "menon-brakes",
      "shivaji-industries",
      "akar",
    ]);
  });

  it("keeps CI Automotive and ONE at their registry ids, not guesses", () => {
    /* The registry uses "01" and "03" for CI Automotive and ONE. Inventing
       readable ids would be a second identity for the same brand. */
    assert.equal(PUBLIC_BRANDS.find((b) => b.id === "01")?.name, "CI Automotive");
    assert.equal(PUBLIC_BRANDS.find((b) => b.id === "03")?.name, "ONE");
  });

  it("has a distinct id per brand", () => {
    assert.equal(new Set(PUBLIC_BRAND_IDS).size, PUBLIC_BRAND_IDS.length);
  });
});

describe("with no overlay, every brand renders exactly as it does today", () => {
  it("returns the registry values untouched", () => {
    const resolved = resolveBrand(meko, undefined);
    assert.equal(resolved.name, meko.name);
    assert.equal(resolved.logo, meko.logo);
    assert.equal(resolved.relationship, meko.relationship);
    assert.equal(resolved.searchQuery, meko.searchQuery);
    assert.deepEqual(resolved.overridden, []);
    assert.equal(resolved.hasProfile, false);
  });

  it("shows all nine visible with zero overlay rows", () => {
    const { visible, ignoredOverlayIds } = resolveAllBrands([]);
    assert.equal(visible.length, 9);
    assert.deepEqual(ignoredOverlayIds, []);
  });
});

describe("an overlay changes presentation only", () => {
  it("applies the fields it sets and reports which", () => {
    const overlay: BrandProfileRow = {
      id: "meko",
      displayName: "MEKO Automotive",
      description: "Water pumps and engine parts.",
    };
    const r = resolveBrand(meko, overlay);
    assert.equal(r.name, "MEKO Automotive");
    assert.equal(r.description, "Water pumps and engine parts.");
    assert.deepEqual(r.overridden.sort(), ["description", "name"]);
  });

  it("leaves unset fields at their registry values", () => {
    const r = resolveBrand(meko, { id: "meko", description: "Only the description" });
    assert.equal(r.name, meko.name);
    assert.equal(r.logo, meko.logo);
    assert.equal(r.relationship, meko.relationship);
    assert.deepEqual(r.overridden, ["description"]);
  });

  it("treats an explicit null as clearing the override", () => {
    const r = resolveBrand(meko, { id: "meko", description: null });
    assert.equal(r.description, null);
    assert.deepEqual(r.overridden, ["description"]);
  });

  it("ignores a relationship outside the closed set", () => {
    const r = resolveBrand(meko, {
      id: "meko",
      relationship: "something-else",
    } as BrandProfileRow);
    assert.equal(r.relationship, meko.relationship, "an invalid value falls back");
    assert.deepEqual(r.overridden, []);
  });

  it("hides a brand only on an explicit false", () => {
    assert.equal(resolveAllBrands([]).visible.length, 9);
    assert.equal(resolveAllBrands([{ id: "meko" }]).visible.length, 9);
    assert.equal(resolveAllBrands([{ id: "meko", isVisible: false }]).visible.length, 8);
  });
});

describe("an overlay cannot add a brand", () => {
  it("discards a row whose id is not in the registry", () => {
    const { brands, ignoredOverlayIds } = resolveAllBrands([
      { id: "invented-brand", displayName: "Not Real" },
    ]);
    assert.equal(brands.length, 9, "membership still comes from the registry");
    assert.deepEqual(ignoredOverlayIds, ["invented-brand"]);
  });

  it("refuses an unknown field, especially a catalogue brand rename", () => {
    const r = validateBrandOverrides({ partBrand: "MEKO" });
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.errors[0].error : "", /separate on purpose/);
  });

  it("has no field that could write part.brand", () => {
    assert.equal(
      BRAND_OVERRIDE_FIELDS.includes("partBrand" as never),
      false,
      "the catalogue's brand value is not reachable",
    );
  });
});

describe("override validation", () => {
  it("accepts valid values", () => {
    const r = validateBrandOverrides({
      displayName: "MEKO",
      description: "Pumps.",
      relationship: "distributor",
      searchQuery: "MEKO water pump",
      displayOrder: 3,
      isVisible: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.displayOrder, 3);
  });

  it("rejects a relationship outside the closed set", () => {
    for (const v of ["partner", "SUPPLIER", ""]) {
      const r = validateBrandOverrides({ relationship: v === "" ? null : v });
      if (v === "") {
        assert.equal(r.ok, true, "an empty relationship clears the override");
        continue;
      }
      assert.equal(r.ok, false, `${v} must be refused`);
    }
  });

  it("rejects a bad display order", () => {
    for (const v of [-1, 1000, 1.5, "abc"]) {
      assert.equal(validateBrandOverrides({ displayOrder: v }).ok, false, `${v}`);
    }
    assert.equal(validateBrandOverrides({ displayOrder: 0 }).ok, true);
    assert.equal(validateBrandOverrides({ displayOrder: null }).ok, true);
  });

  it("rejects over-long text and names the field", () => {
    const r = validateBrandOverrides({ description: "x".repeat(500) });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.errors[0].field, "description");
  });

  it("rejects a non-boolean isVisible", () => {
    assert.equal(validateBrandOverrides({ isVisible: "yes" }).ok, false);
  });
});

describe("ordering puts overridden brands first", () => {
  it("applies display order without disturbing the rest", () => {
    const { visible } = resolveAllBrands([
      { id: "akar", displayOrder: 0 },
      { id: "meko", displayOrder: 1 },
    ]);
    assert.equal(visible.length, 9);
    assert.equal(visible[0].id, "akar");
    assert.equal(visible[1].id, "meko");
  });

  it("leaves the registry order alone when nothing is ordered", () => {
    const { visible } = resolveAllBrands([]);
    assert.deepEqual(visible.map((b) => b.id), PUBLIC_BRAND_IDS);
  });
});

describe("reset restores the registry exactly", () => {
  it("describes what comes back", () => {
    const text = describeReset(meko);
    assert.match(text, /registry values/);
    assert.match(text, new RegExp(meko.relationship));
  });

  it("needs no soft-delete flag, because absent already means registry", () => {
    /* Deleting the overlay row is the reset. That is only true because the
       merge treats a missing field as "use the registry" rather than storing a
       copy of it. */
    const withProfile = resolveBrand(meko, { id: "meko", displayName: "Changed" });
    assert.equal(withProfile.name, "Changed");
    const afterReset = resolveBrand(meko, undefined);
    assert.equal(afterReset.name, meko.name);
  });
});

describe("this module cannot touch the catalogue", () => {
  it("has no database access at all", () => {
    /* The overlay merge is pure. Every read and write lives in the route, so
       this file cannot accidentally grow a query. */
    const src = readFileSync("lib/brand-admin.ts", "utf8");
    for (const forbidden of ["getDb", "drizzle-orm", "pgTable", "update(", "insert(", "delete("]) {
      assert.equal(src.includes(forbidden), false, `must not contain ${forbidden}`);
    }
  });

  it("does not redefine the registry", () => {
    const src = readFileSync("lib/brand-admin.ts", "utf8");
    assert.equal(
      /export const PUBLIC_BRANDS/.test(src),
      false,
      "the registry is imported, not re-declared",
    );
  });
});
