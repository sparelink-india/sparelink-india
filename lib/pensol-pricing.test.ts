import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateInclusiveCartTotals, ignoreClientPricing } from "./party-pricing";
import {
  applyPensolNet,
  detectPensolCategory,
  isPensolProduct,
  parsePackUnits,
  parsePensolSettlement,
  resolvePensolDiscount,
} from "./pensol-pricing";

const greaseCustomer = {
  oil: {
    cashDiscountPaisePerUnit: 1500,
    creditDiscountPaisePerUnit: 500,
  },
  grease: {
    cashDiscountPaisePerUnit: 2500,
    creditDiscountPaisePerUnit: 1000,
  },
  sku: {},
};

const commonNone = { oil: null, grease: null, sku: {} };

describe("Pensol fixed ₹/unit discount", () => {
  it("TEST 1: DLP ₹461, 1KG cash ₹25 => ₹436", () => {
    const priced = applyPensolNet(46100, 2500, 1, 1);
    assert.equal(priced.discountPaise, 2500);
    assert.equal(priced.netInclusivePaise, 43600);
  });

  it("TEST 2: DLP ₹461, 1KG credit ₹10 => ₹451", () => {
    const priced = applyPensolNet(46100, 1000, 1, 1);
    assert.equal(priced.discountPaise, 1000);
    assert.equal(priced.netInclusivePaise, 45100);
  });

  it("TEST 3: DLP ₹922, 2KG cash ₹25 => ₹872", () => {
    const priced = applyPensolNet(92200, 2500, 2, 1);
    assert.equal(priced.billableUnits, 2);
    assert.equal(priced.discountPaise, 5000);
    assert.equal(priced.netInclusivePaise, 87200);
  });

  it("TEST 4: DLP ₹922, 2KG credit ₹10 => ₹902", () => {
    const priced = applyPensolNet(92200, 1000, 2, 1);
    assert.equal(priced.discountPaise, 2000);
    assert.equal(priced.netInclusivePaise, 90200);
  });

  it("TEST 5: Oil 1 LTR cash ₹15 => ₹15 discount", () => {
    const priced = applyPensolNet(10000, 1500, 1, 1);
    assert.equal(priced.discountPaise, 1500);
  });

  it("TEST 6: Oil 5 LTR cash ₹15 => ₹75 discount", () => {
    const priced = applyPensolNet(50000, 1500, 5, 1);
    assert.equal(priced.discountPaise, 7500);
    assert.equal(priced.netInclusivePaise, 42500);
  });

  it("TEST 7: same customer grease cash/credit isolation", () => {
    const resolved = resolvePensolDiscount({
      isPensol: true,
      name: "APLR 30000 GREASE",
      categoryName: "Grease",
      uom: "1 KG",
      customerConfig: greaseCustomer,
      commonConfig: commonNone,
    });
    assert.equal(resolved.cashDiscountPaisePerUnit, 2500);
    assert.equal(resolved.creditDiscountPaisePerUnit, 1000);
  });

  it("TEST 8: different customers stay isolated", () => {
    const a = resolvePensolDiscount({
      isPensol: true,
      name: "Pensol Oil",
      categoryName: "Oil",
      uom: "1 LTR",
      customerConfig: greaseCustomer,
      commonConfig: commonNone,
    });
    const b = resolvePensolDiscount({
      isPensol: true,
      name: "Pensol Oil",
      categoryName: "Oil",
      uom: "1 LTR",
      customerConfig: {
        oil: {
          cashDiscountPaisePerUnit: 2000,
          creditDiscountPaisePerUnit: 800,
        },
        grease: {
          cashDiscountPaisePerUnit: 3000,
          creditDiscountPaisePerUnit: 1200,
        },
        sku: {},
      },
      commonConfig: commonNone,
    });
    assert.equal(a.cashDiscountPaisePerUnit, 1500);
    assert.equal(b.cashDiscountPaisePerUnit, 2000);
  });

  it("TEST 9: unknown customer uses common, otherwise none", () => {
    const withCommon = resolvePensolDiscount({
      isPensol: true,
      name: "Pensol Grease",
      categoryName: "Grease",
      uom: "KG",
      customerConfig: null,
      commonConfig: greaseCustomer,
    });
    const without = resolvePensolDiscount({
      isPensol: true,
      name: "Pensol Grease",
      categoryName: "Grease",
      uom: "KG",
      customerConfig: null,
      commonConfig: commonNone,
    });
    assert.equal(withCommon.source, "common");
    assert.equal(withCommon.cashDiscountPaisePerUnit, 2500);
    assert.equal(without.source, "none");
    assert.equal(without.cashDiscountPaisePerUnit, 0);
  });

  it("TEST 10-12: client pricing fields stripped; settlement validated", () => {
    const cleaned = ignoreClientPricing({
      pensolSettlement: "cash",
      pensolCashDiscountPaisePerUnit: 999999,
      dlpPaise: 1,
      mrpPaise: 1,
      buyerId: "other",
    });
    assert.equal(cleaned.pensolSettlement, "cash");
    assert.equal(cleaned.pensolCashDiscountPaisePerUnit, undefined);
    assert.equal(cleaned.dlpPaise, undefined);
    assert.equal(cleaned.buyerId, undefined);
    assert.equal(parsePensolSettlement("cash"), "cash");
    assert.equal(parsePensolSettlement("wire"), "invalid");
  });

  it("TEST 13: non-Pensol does not receive Pensol discount", () => {
    assert.equal(isPensolProduct({ brand: "Generic", name: "Filter 113" }), false);
    const resolved = resolvePensolDiscount({
      isPensol: false,
      name: "Door Handle",
      customerConfig: greaseCustomer,
      commonConfig: greaseCustomer,
    });
    assert.equal(resolved.source, "none");
    assert.equal(resolved.cashDiscountPaisePerUnit, 0);
  });

  it("TEST 14: mixed cart only Pensol lines get the rupee discount", () => {
    const totals = calculateInclusiveCartTotals(
      [
        {
          listInclusivePaise: 46100,
          quantity: 1,
          gstRate: 18,
          discountPercent: 30,
          unitFixedDiscountPaise: 2500,
        },
        {
          listInclusivePaise: 10000,
          quantity: 1,
          gstRate: 18,
          discountPercent: 0,
        },
      ],
      0,
    );
    assert.equal(totals.lines[0].netInclusivePaise, 43600);
    assert.equal(totals.lines[0].discountPercent, 0);
    assert.equal(totals.lines[1].netInclusivePaise, 10000);
  });

  it("TEST 15-16: MRP unused; DLP unchanged as base", () => {
    const mrp = 60400;
    const dlp = 46100;
    const priced = applyPensolNet(dlp, 2500, 1, 1);
    assert.equal(priced.dlpInclusivePaise, 46100);
    assert.notEqual(priced.netInclusivePaise, mrp - 2500);
  });

  it("TEST 17: non-Pensol GST-inclusive percent engine still works", () => {
    const totals = calculateInclusiveCartTotals(
      [{ listInclusivePaise: 10000, quantity: 1, gstRate: 18, discountPercent: 30 }],
      0,
    );
    assert.equal(totals.totalPaise, 7000);
  });

  it("does not multiply pack when UOM quantity is unknown", () => {
    const pack = parsePackUnits("unknown", "Pensol mystery pack", null);
    assert.equal(pack.packUnits, null);
  });

  it("parses 2 KG pack and grease category", () => {
    assert.deepEqual(parsePackUnits("2 KG", "APLR 30000 GREASE", null), {
      unit: "kg",
      packUnits: 2,
    });
    assert.equal(detectPensolCategory("Grease", "APLR 30000 GREASE"), "grease");
    assert.equal(isPensolProduct({ brand: "Pensol", name: "APLR 30000 GREASE" }), true);
  });

  it("SKU override beats category", () => {
    const resolved = resolvePensolDiscount({
      isPensol: true,
      sku: "APLR-30000-1KG",
      name: "APLR 30000 GREASE",
      categoryName: "Grease",
      uom: "1 KG",
      customerConfig: {
        ...greaseCustomer,
        sku: {
          "APLR-30000-1KG": {
            cashDiscountPaisePerUnit: 4000,
            creditDiscountPaisePerUnit: 1500,
          },
        },
      },
      commonConfig: commonNone,
    });
    assert.equal(resolved.source, "sku");
    assert.equal(resolved.cashDiscountPaisePerUnit, 4000);
  });
});
