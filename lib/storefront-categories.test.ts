import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STOREFRONT_CATEGORIES,
  findStorefrontCategory,
  storefrontSlugForSourceCategory,
  typesenseCategoryFilter,
} from "./storefront-categories";

describe("storefront categories", () => {
  it("maps the eight homepage groups", () => {
    assert.deepEqual(
      STOREFRONT_CATEGORIES.map((item) => item.slug),
      [
        "body-parts",
        "filters",
        "braking-system",
        "engine-parts",
        "suspension-steering",
        "clutch-transmission",
        "electricals",
        "lubricants",
      ],
    );
  });

  it("maps source catalogue slugs without inventing new groups", () => {
    assert.equal(storefrontSlugForSourceCategory("outside-door-handle"), "body-parts");
    assert.equal(storefrontSlugForSourceCategory("filters-cat-src-filters"), "filters");
    assert.equal(storefrontSlugForSourceCategory("brake-shoes"), "braking-system");
    assert.equal(storefrontSlugForSourceCategory("uncategorized"), null);
    assert.ok(findStorefrontCategory("body-parts"));
    assert.equal(findStorefrontCategory("unknown"), null);
  });

  it("builds a Typesense exact category filter", () => {
    assert.equal(
      typesenseCategoryFilter(["FILTERS", "Filters"]),
      "category:=[`FILTERS`,`Filters`]",
    );
  });
});
