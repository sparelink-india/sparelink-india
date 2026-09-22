import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyInclusiveDiscount,
  calculateInclusiveCartTotals,
  ignoreClientPricing,
  priceCustomerLine,
  resolveEffectiveDiscountPercent,
  splitInclusiveGst,
} from "./party-pricing";

describe("GST-inclusive party pricing", () => {
  it("TEST 1: ₹100 list, 18% GST, 0% discount", () => {
    const line = priceCustomerLine(10000, 1, 18, 0);
    assert.equal(line.netInclusivePaise, 10000);
    assert.equal(line.basePaise, 8475);
    assert.equal(line.gstPaise, 1525);
    assert.equal(line.basePaise + line.gstPaise, 10000);
  });

  it("TEST 2: ₹100 list, 18% GST, 30% inclusive discount", () => {
    const discounted = applyInclusiveDiscount(10000, 30);
    assert.equal(discounted.discountPaise, 3000);
    assert.equal(discounted.netInclusivePaise, 7000);
    const tax = splitInclusiveGst(7000, 18);
    assert.equal(tax.basePaise, 5932);
    assert.equal(tax.gstPaise, 1068);
  });

  it("TEST 3: ₹100 list, 18% GST, 35% inclusive discount", () => {
    const line = priceCustomerLine(10000, 1, 18, 35);
    assert.equal(line.netInclusivePaise, 6500);
    assert.equal(line.basePaise, 5508);
    assert.equal(line.gstPaise, 992);
  });

  it("TEST 4: customer A 30% vs customer B 35% on the same list", () => {
    const a = priceCustomerLine(10000, 1, 18, 30);
    const b = priceCustomerLine(10000, 1, 18, 35);
    assert.equal(a.netInclusivePaise, 7000);
    assert.equal(b.netInclusivePaise, 6500);
  });

  it("TEST 5: unknown customer uses common discount only", () => {
    const resolved = resolveEffectiveDiscountPercent(20, null);
    assert.equal(resolved.effectiveDiscountPercent, 20);
    assert.equal(resolved.source, "common");
  });

  it("TEST 6: assigned discount overrides common", () => {
    const resolved = resolveEffectiveDiscountPercent(20, 30);
    assert.equal(resolved.effectiveDiscountPercent, 30);
    assert.equal(resolved.source, "specific");
  });

  it("TEST 7: removing specific discount falls back to common", () => {
    const assigned = resolveEffectiveDiscountPercent(20, 35);
    const removed = resolveEffectiveDiscountPercent(20, null);
    assert.equal(assigned.effectiveDiscountPercent, 35);
    assert.equal(removed.effectiveDiscountPercent, 20);
    assert.equal(removed.source, "common");
  });

  it("TEST 8: unauthenticated uses common, never another customer's rate", () => {
    const guest = resolveEffectiveDiscountPercent(20, null);
    const customerA = resolveEffectiveDiscountPercent(20, 30);
    assert.equal(guest.effectiveDiscountPercent, 20);
    assert.notEqual(guest.effectiveDiscountPercent, customerA.effectiveDiscountPercent);
  });

  it("TEST 9: client-supplied pricing fields are stripped", () => {
    const cleaned = ignoreClientPricing({
      shippingAddress: { name: "x" },
      discountPercent: 90,
      netPricePaise: 1,
      listPricePaise: 1,
      pricePaise: 1,
      userId: "other-user",
      buyerId: "other-user",
      customerId: "other-user",
    });
    assert.equal(cleaned.discountPercent, undefined);
    assert.equal(cleaned.netPricePaise, undefined);
    assert.equal(cleaned.userId, undefined);
    assert.deepEqual(cleaned.shippingAddress, { name: "x" });
  });

  it("TEST 10: cart totals equal net inclusive with extracted GST", () => {
    const totals = calculateInclusiveCartTotals(
      [{ listInclusivePaise: 10000, quantity: 1, gstRate: 18, discountPercent: 30 }],
      0,
    );
    assert.equal(totals.totalPaise, 7000);
    assert.equal(totals.subtotalPaise, 5932);
    assert.equal(totals.gstPaise, 1068);
    assert.equal(totals.subtotalPaise + totals.gstPaise, totals.totalPaise);
  });

  it("TEST 11: historical snapshot amounts are independent of later discount", () => {
    const original = priceCustomerLine(10000, 1, 18, 30);
    const laterAdminChange = priceCustomerLine(10000, 1, 18, 35);
    assert.equal(original.netInclusivePaise, 7000);
    assert.equal(laterAdminChange.netInclusivePaise, 6500);
    assert.notEqual(original.netInclusivePaise, laterAdminChange.netInclusivePaise);
  });

  it("does not apply discount on pre-GST base", () => {
    const wrong = Math.round(8475 * 0.7);
    const correct = applyInclusiveDiscount(10000, 30).netInclusivePaise;
    assert.equal(correct, 7000);
    assert.notEqual(correct, wrong);
  });
});
