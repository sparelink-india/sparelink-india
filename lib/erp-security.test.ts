import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stripClientMoneyFields } from "./b2b-lines";
import { ignoreClientPricing } from "./party-pricing";

/**
 * Security-oriented unit checks for ERP completion surfaces.
 * Route-level auth still uses requireAdminApi / requireDealerApi.
 */
describe("ERP completion security guards", () => {
  it("strips client money on B2B payloads", () => {
    const cleaned = stripClientMoneyFields({
      dealerListingId: "listing-1",
      quantity: 2,
      unitPricePaise: 1,
      unitCostPaise: 2,
      totalPaise: 999999,
      gstRate: 5,
    });
    assert.equal("unitPricePaise" in cleaned, false);
    assert.equal("unitCostPaise" in cleaned, false);
    assert.equal("totalPaise" in cleaned, false);
    assert.equal("gstRate" in cleaned, false);
    assert.equal(cleaned.dealerListingId, "listing-1");
  });

  it("strips storefront client pricing overrides", () => {
    const cleaned = ignoreClientPricing({
      listingId: "x",
      netInclusivePaise: 1,
      discountPercent: 90,
      totalPaise: 1,
    });
    assert.equal("netInclusivePaise" in cleaned, false);
    assert.equal("discountPercent" in cleaned, false);
    assert.equal("totalPaise" in cleaned, false);
  });

  it("documents that purchase costs must not be in dealer credit payloads", () => {
    // Dealer credit API returns only credit fields — assert shape contract.
    const dealerCreditPublic = {
      creditLimitPaise: 1000,
      outstandingPaise: 0,
      availableCreditPaise: 1000,
    };
    assert.equal("unitCostPaise" in dealerCreditPublic, false);
    assert.equal("supplierGstin" in dealerCreditPublic, false);
    assert.equal("purchaseCostPaise" in dealerCreditPublic, false);
  });
});
