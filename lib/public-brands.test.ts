import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CUSTOMER_HIDDEN_BRAND_NAMES,
  PUBLIC_BRANDS,
  isCustomerVisibleCatalogueBrand,
} from "./public-brands";

describe("public brands", () => {
  it("presents MEKO and STARLINKS and hides CE/OAE brand identities", () => {
    const ids = PUBLIC_BRANDS.map((brand) => brand.id);
    const names = PUBLIC_BRANDS.map((brand) => brand.name);
    assert.ok(ids.includes("meko"));
    assert.ok(ids.includes("starlinks"));
    assert.equal(PUBLIC_BRANDS.find((brand) => brand.id === "meko")?.searchQuery, "MEKO");
    assert.equal(PUBLIC_BRANDS.find((brand) => brand.id === "meko")?.tagline, "Distributor");
    assert.equal(
      PUBLIC_BRANDS.find((brand) => brand.id === "starlinks")?.searchQuery,
      "STARLINKS",
    );
    assert.equal(
      PUBLIC_BRANDS.find((brand) => brand.id === "starlinks")?.tagline,
      "Authorised Distributor",
    );
    assert.ok(!ids.includes("02"));
    assert.ok(!names.includes("CE"));
    assert.ok(!names.includes("OAE"));
    assert.deepEqual([...CUSTOMER_HIDDEN_BRAND_NAMES], ["CE", "OAE"]);
  });

  it("hides only exact CE/OAE brand names, not certification text", () => {
    assert.equal(isCustomerVisibleCatalogueBrand("CE"), false);
    assert.equal(isCustomerVisibleCatalogueBrand("OAE"), false);
    assert.equal(isCustomerVisibleCatalogueBrand("ce"), false);
    assert.equal(isCustomerVisibleCatalogueBrand("MEKO"), true);
    assert.equal(isCustomerVisibleCatalogueBrand("STARLINKS"), true);
    assert.equal(isCustomerVisibleCatalogueBrand("CI AUTOMOTIVE LLP"), true);
    assert.equal(isCustomerVisibleCatalogueBrand("ACE"), true);
  });
});
