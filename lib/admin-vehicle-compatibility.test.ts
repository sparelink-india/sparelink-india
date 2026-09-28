import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  COMPATIBILITY_FILTERS,
  COMPATIBILITY_STATUS_LABEL,
  EMPTY_PRODUCT_FILTERS,
  PER_PAGE_MAX,
  buildProductPredicates,
  filterVehicleOptions,
  hasActiveProductFilters,
  normaliseProductFilters,
  resolvePagination,
  rowCompatibilityStatus,
  summariseCompatibility,
  vehicleLinkLabel,
  vehicleOptionLabel,
  vehicleVariantLabel,
  type CompatProduct,
  type VehicleOption,
} from "./admin-vehicle-compatibility";

/**
 * Pure-logic tests for the read-only compatibility browser.
 *
 * The vehicle fixture mirrors the live `vehicle` table, including the real
 * audit figures: Swift 7, i20 5, Baleno 5, one part each elsewhere, and Creta
 * at 0. A fixture that invented nicer numbers would let a real regression pass.
 */
const VEHICLES: VehicleOption[] = [
  { id: "vehicle-hyundai-creta", make: "Hyundai", model: "Creta", variant: "1.5 Petrol", linkCount: 0 },
  { id: "vehicle-hyundai-i20", make: "Hyundai", model: "i20", variant: "1.2 Petrol", linkCount: 5 },
  { id: "vehicle-mahindra-bolero", make: "Mahindra", model: "Bolero", variant: "DI / mHawk", linkCount: 1 },
  { id: "vehicle-mahindra-reva", make: "Mahindra", model: "Reva", variant: "Electric", linkCount: 1 },
  { id: "vehicle-maruti-baleno", make: "Maruti Suzuki", model: "Baleno", variant: "1.2 Petrol", linkCount: 5 },
  { id: "vehicle-maruti-swift", make: "Maruti Suzuki", model: "Swift", variant: "1.2 Petrol", linkCount: 7 },
  { id: "vehicle-tata-ace", make: "Tata", model: "Ace", variant: "HT / Mini Truck", linkCount: 1 },
  { id: "vehicle-tata-magic", make: "Tata", model: "Magic", variant: "Passenger Van", linkCount: 1 },
  { id: "vehicle-tata-nexon", make: "Tata", model: "Nexon", variant: "1.2 Petrol", linkCount: 1 },
  { id: "vehicle-tata-sumo", make: "Tata", model: "Sumo", variant: "All Variants", linkCount: 1 },
  { id: "vehicle-universal-car", make: "Universal", model: "Car", variant: "Universal Fit", linkCount: 1 },
];

function product(over: Partial<CompatProduct> = {}): CompatProduct {
  return {
    id: "part-1",
    partNumber: "SL-AIR-FILTER-001",
    name: "AIR FILTER",
    brand: "SpareLink",
    categoryId: "cat-filters",
    categoryName: "Filters",
    isLinked: false,
    imageUrl: null,
    listingCount: 1,
    ...over,
  };
}

describe("vehicle selection", () => {
  it("labels a vehicle as make plus model, never folding in the variant", () => {
    assert.equal(vehicleOptionLabel(VEHICLES[5]), "Maruti Suzuki Swift");
    assert.equal(vehicleVariantLabel(VEHICLES[5]), "1.2 Petrol");
  });

  it("renders a missing variant as a dash rather than an empty string", () => {
    assert.equal(vehicleVariantLabel({ variant: null }), "—");
    assert.equal(vehicleVariantLabel({ variant: "   " }), "—");
  });

  it("finds Swift by model, by make and by variant, case-insensitively", () => {
    for (const query of ["swift", "SWIFT", "Maruti", "1.2 Petrol"]) {
      assert.ok(
        filterVehicleOptions(VEHICLES, query).some((item) => item.id === "vehicle-maruti-swift"),
        `"${query}" did not match Swift`,
      );
    }
  });

  it("returns everything for a blank query", () => {
    assert.equal(filterVehicleOptions(VEHICLES, "   ").length, VEHICLES.length);
  });

  it("returns nothing for a query that matches no vehicle", () => {
    assert.deepEqual(filterVehicleOptions(VEHICLES, "lamborghini"), []);
  });

  it("matches a contiguous run of fields, because make/model/variant are joined with a space", () => {
    assert.deepEqual(
      filterVehicleOptions(VEHICLES, "suzuki swift 1.2").map((item) => item.model),
      ["Swift"],
    );
  });

  it("does not match a query that skips a field, so 'maruti petrol' finds nothing", () => {
    // Documented rather than accidental: the fields are joined into one string,
    // so a gap in the middle is not a match. Stated here so changing to
    // per-field matching later is a deliberate, visible decision.
    assert.deepEqual(filterVehicleOptions(VEHICLES, "maruti petrol"), []);
  });

  it("pluralises the link label so '1 linked product' is never '1 linked products'", () => {
    assert.equal(vehicleLinkLabel(1), "1 linked product");
    assert.equal(vehicleLinkLabel(0), "0 linked products");
    assert.equal(vehicleLinkLabel(7), "7 linked products");
  });
});

describe("compatibility status", () => {
  it("reports a product with a real link as linked", () => {
    assert.equal(rowCompatibilityStatus({ isLinked: true }), "linked");
    assert.equal(COMPATIBILITY_STATUS_LABEL.linked, "LINKED");
  });

  it("reports a product with no link as not linked", () => {
    assert.equal(rowCompatibilityStatus({ isLinked: false }), "not_linked");
    assert.equal(COMPATIBILITY_STATUS_LABEL.not_linked, "NOT LINKED");
  });

  it("counts a mixed page without losing a row", () => {
    const rows = [
      product({ id: "a", isLinked: true }),
      product({ id: "b", isLinked: false }),
      product({ id: "c", isLinked: true }),
    ];
    assert.deepEqual(summariseCompatibility(rows), { linked: 2, notLinked: 1, total: 3 });
  });

  it("summarises an empty page as zeros rather than NaN", () => {
    assert.deepEqual(summariseCompatibility([]), { linked: 0, notLinked: 0, total: 0 });
  });

  it("reports zero links for a vehicle that has none, like Creta", () => {
    const creta = VEHICLES.find((item) => item.model === "Creta");
    assert.ok(creta);
    assert.equal(creta.linkCount, 0);
    const rows = [product(), product()];
    assert.equal(summariseCompatibility(rows).linked, 0, "Creta must show no linked products");
  });
});

describe("product filters", () => {
  it("describes a free-text search over the part number and the name", () => {
    const predicates = buildProductPredicates(
      normaliseProductFilters({ q: "SL-AIR" }),
      "vehicle-maruti-swift",
    );
    assert.deepEqual(predicates, [
      { kind: "text", columns: ["partNumber", "name"], value: "SL-AIR" },
    ]);
  });

  it("describes a brand filter", () => {
    assert.deepEqual(buildProductPredicates(normaliseProductFilters({ brand: "SpareLink" }), "v"), [
      { kind: "brand", value: "SpareLink" },
    ]);
  });

  it("describes a category filter by id, not by name", () => {
    assert.deepEqual(buildProductPredicates(normaliseProductFilters({ categoryId: "cat-filters" }), "v"), [
      { kind: "category", value: "cat-filters" },
    ]);
  });

  it("describes the linked and not-linked filters as join conditions", () => {
    assert.deepEqual(buildProductPredicates(normaliseProductFilters({ status: "linked" }), "v"), [
      { kind: "compatibility", value: "linked" },
    ]);
    assert.deepEqual(buildProductPredicates(normaliseProductFilters({ status: "not_linked" }), "v"), [
      { kind: "compatibility", value: "not_linked" },
    ]);
  });

  it("drops a compatibility filter when no vehicle is selected", () => {
    // Without a vehicle the LEFT JOIN has nothing to test, so honouring the
    // filter would return a misleading half-result instead of ignoring it.
    assert.deepEqual(buildProductPredicates(normaliseProductFilters({ status: "linked" }), null), []);
  });

  it("describes no predicate for an empty filter set", () => {
    assert.deepEqual(buildProductPredicates(EMPTY_PRODUCT_FILTERS, "v"), []);
  });

  it("combines every active filter at once", () => {
    const filters = normaliseProductFilters({
      q: "filter",
      brand: "SpareLink",
      categoryId: "cat-filters",
      status: "linked",
    });
    assert.deepEqual(buildProductPredicates(filters, "v"), [
      { kind: "text", columns: ["partNumber", "name"], value: "filter" },
      { kind: "brand", value: "SpareLink" },
      { kind: "category", value: "cat-filters" },
      { kind: "compatibility", value: "linked" },
    ]);
  });

  it("trims values and rejects an unknown status rather than trusting the query string", () => {
    const filters = normaliseProductFilters({
      q: "  SL-AIR  ",
      brand: "  SpareLink ",
      status: "not-a-status",
    });
    assert.equal(filters.q, "SL-AIR");
    assert.equal(filters.brand, "SpareLink");
    assert.equal(filters.status, "all", "an unknown status must not widen the filter");
  });

  it("coerces a non-string or missing value to empty rather than passing it through", () => {
    const filters = normaliseProductFilters({ q: 42, brand: null, categoryId: undefined });
    assert.deepEqual(filters, { q: "", brand: "", categoryId: "", status: "all" });
  });

  it("survives a null body", () => {
    assert.deepEqual(normaliseProductFilters(null), EMPTY_PRODUCT_FILTERS);
  });

  it("knows when a filter set is active", () => {
    assert.equal(hasActiveProductFilters(EMPTY_PRODUCT_FILTERS), false);
    assert.equal(hasActiveProductFilters({ ...EMPTY_PRODUCT_FILTERS, status: "linked" }), true);
    assert.equal(hasActiveProductFilters({ ...EMPTY_PRODUCT_FILTERS, q: "x" }), true);
  });

  it("offers exactly the three documented compatibility filters", () => {
    assert.deepEqual([...COMPATIBILITY_FILTERS], ["all", "linked", "not_linked"]);
  });
});

describe("pagination", () => {
  it("puts page one at offset zero", () => {
    assert.deepEqual(resolvePagination({ page: 1, perPage: 50, total: 9017 }), {
      page: 1,
      perPage: 50,
      offset: 0,
      total: 9017,
      totalPages: 181,
      clamped: false,
    });
  });

  it("offsets later pages by whole pages", () => {
    assert.equal(resolvePagination({ page: 3, perPage: 25, total: 9017 }).offset, 50);
  });

  it("caps perPage at the documented maximum", () => {
    assert.equal(resolvePagination({ page: 1, perPage: 500, total: 100 }).perPage, PER_PAGE_MAX);
  });

  it("refuses a perPage below one", () => {
    assert.equal(resolvePagination({ page: 1, perPage: 0, total: 100 }).perPage, 1);
    assert.equal(resolvePagination({ page: 1, perPage: -5, total: 100 }).perPage, 1);
  });

  it("clamps a page past the end instead of returning a silent empty grid", () => {
    const result = resolvePagination({ page: 9999, perPage: 50, total: 9017 });
    assert.equal(result.page, 181);
    assert.equal(result.clamped, true);
  });

  it("never clamps a page inside the range", () => {
    assert.equal(resolvePagination({ page: 2, perPage: 50, total: 9017 }).clamped, false);
  });

  it("handles a zero total as one empty page", () => {
    assert.deepEqual(resolvePagination({ page: 1, perPage: 25, total: 0 }), {
      page: 1,
      perPage: 25,
      offset: 0,
      total: 0,
      totalPages: 1,
      clamped: false,
    });
  });

  it("treats a junk page or perPage as the defaults", () => {
    const result = resolvePagination({ page: "abc", perPage: "xyz", total: 10 });
    assert.equal(result.page, 1);
    assert.equal(result.perPage, 25);
  });

  it("treats a negative or non-finite total as zero rather than producing NaN offsets", () => {
    assert.equal(resolvePagination({ page: 1, perPage: 25, total: -5 }).total, 0);
    assert.equal(resolvePagination({ page: 1, perPage: 25, total: Number.NaN }).offset, 0);
  });

  it("keeps every page inside the result set", () => {
    const total = 9017;
    const perPage = 50;
    const last = resolvePagination({ page: 10_000, perPage, total });
    assert.ok(last.offset + last.perPage <= total + perPage);
  });
});

describe("this phase has no mutation path", () => {
  const FILES = [
    "lib/admin-vehicle-compatibility.ts",
    "app/api/admin/products-paginated/route.ts",
    "app/api/admin/vehicles/route.ts",
    "app/admin/editing/vehicle-compatibility/page.tsx",
  ];

  it("exposes no write HTTP method on either route", () => {
    for (const file of ["app/api/admin/products-paginated/route.ts", "app/api/admin/vehicles/route.ts"]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const method of ["export async function POST", "export async function PATCH", "export async function PUT", "export async function DELETE"]) {
        assert.equal(
          source.includes(method),
          false,
          `${file} must not export ${method} in a read-only phase`,
        );
      }
    }
  });

  it("never writes through Drizzle", () => {
    // Scoped to the two API routes. The page is a browser component and has no
    // database access at all - `Set.delete` there is not a query - so the page is
    // asserted separately on the thing that would actually matter: it must not
    // import the database.
    for (const file of [
      "app/api/admin/products-paginated/route.ts",
      "app/api/admin/vehicles/route.ts",
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const call of [".insert(", ".update(", ".delete("]) {
        assert.equal(source.includes(call), false, `${file} must not call ${call}`);
      }
    }
  });

  it("keeps the database out of the browser page entirely", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app", "admin", "editing", "vehicle-compatibility", "page.tsx"),
      "utf8",
    );
    for (const forbidden of ["@/lib/db", "drizzle-orm", "getDb", "partVehicleCompatibility"]) {
      assert.equal(
        page.includes(forbidden),
        false,
        `the page must not reference ${forbidden}; it reads the read-only API instead`,
      );
    }
  });

  it("never reaches for a mutation helper or a second compatibility store", () => {
    for (const file of FILES) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      for (const forbidden of ["writeAuditLog", "randomUUID", "db.transaction", "onConflictDoNothing"]) {
        assert.equal(source.includes(forbidden), false, `${file} must not use ${forbidden}`);
      }
    }
  });

  it("reads compatibility from part_vehicle_compatibility and nothing else", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app", "api", "admin", "products-paginated", "route.ts"),
      "utf8",
    );
    assert.ok(source.includes("partVehicleCompatibility"), "the real join must be used");
    for (const forbidden of ["vehicleTypes", "vehicle_types", "specifications", "typesense"]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${forbidden} is a different signal and must not be consulted for status`,
      );
    }
  });

  it("protects both routes with requireAdminApi", () => {
    for (const file of ["app/api/admin/products-paginated/route.ts", "app/api/admin/vehicles/route.ts"]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      assert.ok(source.includes("requireAdminApi"), `${file} must call requireAdminApi`);
      assert.ok(
        source.includes('"error" in access'),
        `${file} must return the gate's error response`,
      );
    }
  });

  it("renders link and unlink as conditional actions, not a read-only notice", () => {
    // Updated in Phase 3C. The read-only phase asserted these were permanently
    // disabled; they are now real mutations, so the guard that matters is
    // different: the page must not call the mutation endpoints directly without
    // confirming, must not claim to be read-only, and must disable an action
    // whose precondition is not met.
    const page = readFileSync(
      path.join(process.cwd(), "app", "admin", "editing", "vehicle-compatibility", "page.tsx"),
      "utf8",
    );

    assert.equal(
      page.includes("Read-only inspection"),
      false,
      "the page must no longer describe itself as read-only",
    );
    assert.ok(page.includes("Link ${"), "the link action must be present");
    assert.ok(page.includes("Unlink ${"), "the unlink action must be present");

    // Both actions are gated on the busy flag and on a real precondition.
    for (const label of ["Link ${", "Unlink ${"]) {
      const index = page.indexOf(label);
      // Wide enough to span the whole button element: the label lives in the
      // children, above the `disabled` prop in source order.
      const window = page.slice(Math.max(0, index - 900), index);
      assert.ok(
        window.includes("disabled="),
        `"${label}" must be conditionally disabled, never unconditionally enabled`,
      );
      assert.ok(
        window.includes("busy"),
        `"${label}" must be disabled while a request is in flight`,
      );
      assert.ok(
        window.includes("enabled"),
        `"${label}" must be gated on the resolved action plan, not a raw count`,
      );
    }

    // A filtered selection is confirmed before it is sent.
    assert.ok(page.includes("expectedCount"), "a filtered scope must send its confirmed count");
    assert.ok(
      page.includes("AdminConfirmDialog"),
      "a mutation must be confirmed with the affected count shown",
    );
  });
});
