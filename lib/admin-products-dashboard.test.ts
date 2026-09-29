import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  ABSENT,
  PRODUCT_FILTERS,
  PRODUCT_SORTS,
  filterProducts,
  hasActiveProductFilters,
  matchesProductFilter,
  matchesProductQuery,
  productBrand,
  productCategory,
  productsEmptyMessage,
  productsErrorMessage,
  sortProducts,
  summariseProducts,
  type AdminProduct,
  type ProductFilter,
  type ProductSort,
} from "./admin-products-dashboard";

function product(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "p1",
    partNumber: "BRK-001",
    name: "Brake Pad Set",
    brand: "Brembo",
    category: "Brakes",
    description: "Front axle ceramic pads",
    listingCount: 3,
    createdAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

const SAMPLE: AdminProduct[] = [
  product({ id: "a", partNumber: "BRK-001", name: "Brake Pad Set", listingCount: 3, brand: "Brembo", category: "Brakes" }),
  product({ id: "b", partNumber: "FLT-100", name: "Oil Filter", listingCount: 12, brand: "Bosch", category: "Filters" }),
  product({ id: "c", partNumber: "SPK-9", name: "Spark Plug", listingCount: 0, brand: null, category: null }),
  product({ id: "d", partNumber: "BLT-77", name: "Drive Belt", listingCount: 1, brand: "Gates", category: "Engine" }),
];

describe("product field accessors", () => {
  it("never invents a brand or category", () => {
    assert.equal(productBrand(product({ brand: "Brembo" })), "Brembo");
    assert.equal(productCategory(product({ category: "Brakes" })), "Brakes");
    assert.equal(productBrand(product({ brand: null })), ABSENT);
    assert.equal(productBrand(product({ brand: "   " })), ABSENT);
    assert.equal(productCategory(product({ category: "" })), ABSENT);
  });
});

describe("product filtering", () => {
  it("exposes exactly the declared filters", () => {
    assert.deepEqual([...PRODUCT_FILTERS], ["all", "listed", "unlisted"]);
  });

  it("splits on listing coverage", () => {
    assert.equal(matchesProductFilter(SAMPLE[0], "all"), true);
    assert.equal(matchesProductFilter(SAMPLE[0], "listed"), true);
    assert.equal(matchesProductFilter(SAMPLE[2], "listed"), false);
    assert.equal(matchesProductFilter(SAMPLE[2], "unlisted"), true);
    assert.equal(matchesProductFilter(SAMPLE[3], "unlisted"), false);
  });

  it("matches the query across every returned field", () => {
    assert.equal(matchesProductQuery(SAMPLE[0], "brk-001"), true);
    assert.equal(matchesProductQuery(SAMPLE[0], "brembo"), true);
    assert.equal(matchesProductQuery(SAMPLE[0], "brakes"), true);
    assert.equal(matchesProductQuery(SAMPLE[0], "ceramic"), true);
    assert.equal(matchesProductQuery(SAMPLE[0], "nothing-here"), false);
    assert.equal(matchesProductQuery(SAMPLE[0], "   "), true);
  });

  it("reports whether any filter is narrowing the list", () => {
    assert.equal(hasActiveProductFilters({ query: "", filter: "all" }), false);
    assert.equal(hasActiveProductFilters({ query: "brake", filter: "all" }), true);
    assert.equal(hasActiveProductFilters({ query: "  ", filter: "listed" }), true);
  });
});

describe("product sorting", () => {
  it("exposes exactly the declared sorts", () => {
    assert.deepEqual([...PRODUCT_SORTS], ["listings", "name", "part", "newest"]);
  });

  it("orders by listing count, highest first, with a stable tiebreak", () => {
    const rows = sortProducts(SAMPLE, "listings");
    assert.deepEqual(
      rows.map((r) => r.listingCount),
      [12, 3, 1, 0],
    );
  });

  it("orders by name and by part number", () => {
    assert.deepEqual(
      sortProducts(SAMPLE, "name").map((r) => r.name),
      ["Brake Pad Set", "Drive Belt", "Oil Filter", "Spark Plug"],
    );
    assert.deepEqual(
      sortProducts(SAMPLE, "part").map((r) => r.partNumber),
      ["BLT-77", "BRK-001", "FLT-100", "SPK-9"],
    );
  });

  it("orders newest first and tolerates an unparseable date", () => {
    const rows = sortProducts(
      [
        product({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
        product({ id: "new", createdAt: "2026-06-01T00:00:00.000Z" }),
        product({ id: "bad", createdAt: "not-a-date" }),
      ],
      "newest",
    );
    assert.deepEqual(rows.map((r) => r.id), ["new", "old", "bad"]);
  });

  it("does not mutate its input", () => {
    const before = SAMPLE.map((r) => r.id);
    sortProducts(SAMPLE, "listings");
    assert.deepEqual(SAMPLE.map((r) => r.id), before);
  });

  it("combines filter, query and sort", () => {
    const rows = filterProducts(SAMPLE, { query: "", filter: "listed", sort: "listings" });
    assert.deepEqual(rows.map((r) => r.id), ["b", "a", "d"]);
  });
});

describe("product summary", () => {
  it("counts only what the API returned", () => {
    const summary = summariseProducts(SAMPLE);
    assert.equal(summary.total, 4);
    assert.equal(summary.listed, 3);
    assert.equal(summary.unlisted, 1);
    assert.equal(summary.listings, 16);
    assert.equal(summary.brands, 3);
    assert.equal(summary.categories, 3);
  });

  it("is all zeroes for an empty catalogue", () => {
    const summary = summariseProducts([]);
    assert.deepEqual(summary, {
      total: 0,
      listed: 0,
      unlisted: 0,
      listings: 0,
      brands: 0,
      categories: 0,
    });
  });

  it("does not double-count brands that differ only by case", () => {
    const summary = summariseProducts([
      product({ id: "1", brand: "Bosch" }),
      product({ id: "2", brand: "bosch" }),
    ]);
    assert.equal(summary.brands, 1);
  });

  it("treats a blank brand as absent rather than a distinct value", () => {
    const summary = summariseProducts([product({ id: "1", brand: "  " })]);
    assert.equal(summary.brands, 0);
  });
});

describe("product empty and error states", () => {
  it("distinguishes loading, filtered-empty, returned-empty and no-catalogue", () => {
    const loading = productsEmptyMessage({ loading: true, hasData: true, filtered: true });
    assert.match(loading.title, /Loading/i);

    const filtered = productsEmptyMessage({ loading: false, hasData: true, filtered: true });
    assert.match(filtered.title, /match/i);
    assert.match(filtered.description, /Clear the filters/i);

    const returned = productsEmptyMessage({ loading: false, hasData: true, filtered: false });
    assert.match(returned.title, /No products found/i);

    const none = productsEmptyMessage({ loading: false, hasData: false, filtered: false });
    assert.match(none.title, /No products yet/i);
  });

  it("never shows four identical messages", () => {
    const messages = [
      productsEmptyMessage({ loading: true, hasData: true, filtered: true }),
      productsEmptyMessage({ loading: false, hasData: true, filtered: true }),
      productsEmptyMessage({ loading: false, hasData: true, filtered: false }),
      productsEmptyMessage({ loading: false, hasData: false, filtered: false }),
    ].map((m) => m.title);
    assert.equal(new Set(messages).size, messages.length);
  });

  it("always produces a non-empty error message", () => {
    assert.equal(productsErrorMessage(new Error("boom")), "boom");
    assert.equal(productsErrorMessage(new Error("   ")).length > 0, true);
    assert.equal(productsErrorMessage("not an error").length > 0, true);
    assert.equal(productsErrorMessage(undefined).length > 0, true);
  });
});

describe("no fabricated product data", () => {
  it("has no hard-coded totals in the view model", () => {
    const source = readFileSync(join(__dirname, "admin-products-dashboard.ts"), "utf8");
    // No literal count, amount or percentage is baked into the model.
    assert.equal(/=\s*\d{2,}\s*;/.test(source.replace(/\d{4}-\d{2}-\d{2}/g, "")), false);
  });

  it("keeps filter and sort types closed", () => {
    const filters: ProductFilter[] = ["all", "listed", "unlisted"];
    const sorts: ProductSort[] = ["listings", "name", "part", "newest"];
    assert.equal(filters.length, PRODUCT_FILTERS.length);
    assert.equal(sorts.length, PRODUCT_SORTS.length);
  });
});
