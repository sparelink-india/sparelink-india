import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { WATER_PUMP_SEGMENTS } from "./category-navigation";
import {
  CONFIG_OWNED_CATEGORY_IDS,
  checkCategoryCollisions,
  decideCategoryDelete,
  describeCategoryImpact,
  isConfigOwnedCategoryId,
  slugifyCategoryName,
  validateCategoryEdit,
  type CategoryRow,
} from "./category-admin";

const row = (over: Partial<CategoryRow> = {}): CategoryRow => ({
  id: "cat-brakes",
  name: "Brakes",
  slug: "brakes",
  description: null,
  productCount: 120,
  ...over,
});

describe("the slug rule is one rule, not two", () => {
  it("imports the real slugify rather than reimplementing it", () => {
    /* The real rule is not trivial: `&` becomes "and", every non-alphanumeric
       run becomes a space, whitespace becomes hyphens, the result is cut at 80
       characters, and an empty result becomes "category". A copied version
       drifts, and then one category has two URLs. */
    const src = readFileSync("lib/category-admin.ts", "utf8");
    assert.ok(
      /import \{ slugifyCategory \} from "@\/lib\/category-navigation"/.test(src),
      "must import the config's own slugify",
    );
    assert.equal(
      /function slugifyCategoryName\s*\(/.test(src),
      false,
      "must not define a second slugify",
    );
  });

  it("handles the real rule's edge cases, because it IS the real rule", () => {
    for (const [name, expected] of [
      ["Brakes", "brakes"],
      ["Engine & Transmission", "engine-and-transmission"],
      ["Wiper  Systems", "wiper-systems"],
      ["Earthmover", "earthmover"],
      ["", "category"],
      ["   ", "category"],
      ["---", "category"],
      ["A".repeat(200), "a".repeat(80)],
    ] as const) {
      assert.equal(slugifyCategoryName(name), expected, `${JSON.stringify(name)}`);
    }
  });

  it("preserves the approved water-pump segments exactly", () => {
    assert.deepEqual(
      WATER_PUMP_SEGMENTS.map((s) => s.id),
      ["heavy-commercial-vehicle", "passenger-vehicle", "agriculture", "earthmover"],
    );
    for (const segment of WATER_PUMP_SEGMENTS) {
      assert.equal(
        slugifyCategoryName(segment.name),
        segment.slug,
        `${segment.id}: the config's own slug must match its name`,
      );
      assert.ok(isConfigOwnedCategoryId(segment.id));
    }
    assert.ok(isConfigOwnedCategoryId("water-pump-assy"));
  });

  it("treats a non-config id as not config-owned", () => {
    assert.equal(isConfigOwnedCategoryId("cat-brakes"), false);
  });
});

describe("editing a category", () => {
  it("derives the slug from the name when none is given", () => {
    const r = validateCategoryEdit({ name: "Brakes & Bearings" });
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.slug, "brakes-and-bearings");
  });

  it("refuses a hand-written slug that disagrees with the name", () => {
    /* This is the URL-safety rule. A slug that is not the canonical
       derivation gives one category two addresses. */
    const r = validateCategoryEdit({ name: "Brakes", slug: "brakes-and-stopping" });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.errors[0].field, "slug");
    assert.match(r.ok === false ? r.errors[0].error : "", /second URL/);
  });

  it("accepts a slug that exactly matches the derivation", () => {
    assert.equal(validateCategoryEdit({ name: "Brakes", slug: "brakes" }).ok, true);
  });

  it("rejects a malformed slug", () => {
    for (const slug of ["Brakes", "brakes!", "brakes--and", "-brakes", "brakes-"]) {
      const r = validateCategoryEdit({ name: "Brakes", slug });
      assert.equal(r.ok, false, `${slug} must be refused`);
    }
  });

  it("requires a name", () => {
    for (const name of ["", "   ", null, undefined, 42]) {
      const r = validateCategoryEdit({ name });
      assert.equal(r.ok, false, `${String(name)} must be refused`);
    }
  });

  it("treats an empty description as cleared", () => {
    const r = validateCategoryEdit({ name: "Brakes", description: "   " });
    assert.equal(r.ok && r.value.description, null);
  });

  it("reports which field is wrong", () => {
    const r = validateCategoryEdit({ name: "x".repeat(200), description: "y".repeat(600) });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.errors.length, 2);
  });
});

describe("deletion is refused while products depend on a category", () => {
  it("refuses and names the count", () => {
    /* The FK is ON DELETE SET NULL, so a permitted delete would NOT error. It
       would succeed and strip the category from every product. That is why
       this is a hard refusal and not a warning. */
    const d = decideCategoryDelete(row({ productCount: 4317 }));
    assert.equal(d.allowed, false);
    assert.match(d.allowed === false ? d.error : "", /4317 product/);
    assert.match(d.allowed === false ? d.error : "", /detach/);
  });

  it("permits an empty category but warns about its URL", () => {
    const d = decideCategoryDelete(row({ productCount: 0 }));
    assert.equal(d.allowed, true);
    assert.match(d.allowed === true ? (d.warning ?? "") : "", /\/category\/brakes/);
  });

  it("refuses a single product too, not just a large count", () => {
    assert.equal(decideCategoryDelete(row({ productCount: 1 })).allowed, false);
  });
});

describe("collisions are caught before the database is", () => {
  const others = [
    { id: "a", name: "Clutch", slug: "clutch" },
    { id: "b", name: "Filters", slug: "filters" },
  ];

  it("rejects a duplicate slug", () => {
    const r = checkCategoryCollisions({ name: "Clutch Systems", slug: "clutch" }, others, "new");
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /slug/);
  });

  it("rejects a duplicate name regardless of case", () => {
    const r = checkCategoryCollisions({ name: "clutch", slug: "clutch-system" }, others, "new");
    assert.equal(r.ok, false);
  });

  it("ignores the category's own row, so a rename is not a self-collision", () => {
    assert.equal(
      checkCategoryCollisions({ name: "Clutch", slug: "clutch" }, others, "a").ok,
      true,
    );
  });

  it("accepts a genuinely new category", () => {
    assert.equal(
      checkCategoryCollisions({ name: "Suspension", slug: "suspension" }, others, "new").ok,
      true,
    );
  });
});

describe("impact is reported before an admin commits", () => {
  it("says the URL is unchanged when the slug holds", () => {
    const impact = describeCategoryImpact(row(), { name: "Brakes and Bends", slug: "brakes" });
    assert.equal(impact.urlImpact, "unchanged");
    assert.equal(impact.productImpact, "none");
  });

  it("says the URL moves when the name changes the slug", () => {
    const impact = describeCategoryImpact(row(), { name: "Braking Systems", slug: "braking-systems" });
    assert.equal(impact.urlImpact, "moves");
    assert.equal(impact.productCount, 120, "and reports how many products are affected");
  });

  it("never claims products will be detached by an edit", () => {
    /* A rename keeps the row, so every product keeps its category_id. Only a
       delete can detach one, and that is refused. */
    assert.equal(describeCategoryImpact(row(), { name: "X", slug: "x" }).productImpact, "none");
  });
});

describe("this module creates no second taxonomy", () => {
  it("has no category table, no builder and no bulk path", () => {
    const src = readFileSync("lib/category-admin.ts", "utf8");
    assert.equal(/pgTable\(/.test(src), false, "no new category table");
    assert.equal(/insert\(/.test(src), false, "no insert path");
    assert.equal(/delete\(/.test(src), false, "no delete path");
    assert.equal(/part\s*\.\s*update/.test(src), false, "never mass-updates products");
  });

  it("names the config-owned ids it must not duplicate", () => {
    assert.ok(CONFIG_OWNED_CATEGORY_IDS.includes("water-pump-assy"));
    assert.equal(
      CONFIG_OWNED_CATEGORY_IDS.includes("cat-brakes" as never),
      false,
      "a catalogue category is not a config id",
    );
  });
});
