import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAuthoritativeSellingPricePaise } from "./storefront-price-display";

describe("storefront unpriced display", () => {
  it("treats zero and missing paise as unpriced", () => {
    assert.equal(isAuthoritativeSellingPricePaise(0), false);
    assert.equal(isAuthoritativeSellingPricePaise(null, undefined, 0), false);
  });

  it("keeps a real catalogue selling price", () => {
    assert.equal(isAuthoritativeSellingPricePaise(0, 25600), true);
  });
});
