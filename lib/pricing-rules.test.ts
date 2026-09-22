import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPricingRuleCurrentlyValid,
  pickHighestPriorityRule,
  publicEffectivePrice,
  resolveEffectiveSellingPrice,
  type PricingRuleCandidate,
} from "./pricing-rules";
import { ignoreClientPricing } from "./party-pricing";

function rule(
  partial: Partial<PricingRuleCandidate> & Pick<PricingRuleCandidate, "id" | "scope">,
): PricingRuleCandidate {
  return {
    discountPercent: 10,
    isActive: true,
    validFrom: null,
    validUntil: null,
    ...partial,
  };
}

describe("pricing rules hierarchy", () => {
  it("defaults to listing price when no rule exists", () => {
    const result = resolveEffectiveSellingPrice({
      listInclusivePaise: 10000,
      matchedRule: null,
    });
    assert.equal(result.netInclusivePaise, 10000);
    assert.equal(result.discountPercent, 0);
    assert.equal(result.source, "listing");
  });

  it("applies customer-specific rule over category", () => {
    const matched = pickHighestPriorityRule([
      rule({ id: "cat", scope: "pricing_category", discountPercent: 5 }),
      rule({ id: "cust", scope: "customer", discountPercent: 20 }),
    ]);
    assert.equal(matched?.id, "cust");
    const priced = resolveEffectiveSellingPrice({
      listInclusivePaise: 10000,
      matchedRule: matched,
    });
    assert.equal(priced.netInclusivePaise, 8000);
    assert.equal(priced.source, "customer_rule");
  });

  it("prefers dealer rule over category", () => {
    const matched = pickHighestPriorityRule([
      rule({ id: "cat", scope: "pricing_category", discountPercent: 5 }),
      rule({ id: "dealer", scope: "dealer", discountPercent: 15 }),
    ]);
    assert.equal(matched?.id, "dealer");
  });

  it("ignores inactive or out-of-window rules", () => {
    assert.equal(
      isPricingRuleCurrentlyValid({
        isActive: false,
        validFrom: null,
        validUntil: null,
      }),
      false,
    );
    const future = new Date(Date.now() + 86400000);
    assert.equal(
      isPricingRuleCurrentlyValid({
        isActive: true,
        validFrom: future,
        validUntil: null,
      }),
      false,
    );
  });

  it("falls back to verification specific then common", () => {
    const specific = resolveEffectiveSellingPrice({
      listInclusivePaise: 10000,
      matchedRule: null,
      verificationSpecificPercent: 25,
      verificationCommonPercent: 10,
    });
    assert.equal(specific.source, "verification_specific");
    assert.equal(specific.netInclusivePaise, 7500);

    const common = resolveEffectiveSellingPrice({
      listInclusivePaise: 10000,
      matchedRule: null,
      verificationSpecificPercent: null,
      verificationCommonPercent: 10,
    });
    assert.equal(common.source, "verification_common");
    assert.equal(common.netInclusivePaise, 9000);
  });

  it("public payload never includes internal rule id leakage requirement — id optional admin-only", () => {
    const priced = resolveEffectiveSellingPrice({
      listInclusivePaise: 5000,
      matchedRule: rule({ id: "secret", scope: "customer", discountPercent: 10 }),
    });
    const pub = publicEffectivePrice(priced);
    assert.equal("ruleId" in pub, false);
    assert.equal(pub.netInclusivePaise, 4500);
  });

  it("client pricing fields are stripped (tamper resistance)", () => {
    const cleaned = ignoreClientPricing({
      dealerListingId: "x",
      quantity: 2,
      totalPaise: 999,
      discountPercent: 99,
      netInclusivePaise: 1,
    });
    assert.equal("totalPaise" in cleaned, false);
    assert.equal("discountPercent" in cleaned, false);
    assert.equal("netInclusivePaise" in cleaned, false);
    assert.equal(cleaned.dealerListingId, "x");
  });

  it("skips rules with null discount (do not invent)", () => {
    const matched = pickHighestPriorityRule([
      rule({ id: "empty", scope: "customer", discountPercent: null }),
      rule({ id: "cat", scope: "pricing_category", discountPercent: 5 }),
    ]);
    assert.equal(matched?.id, "cat");
  });
});
