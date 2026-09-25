import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CANCEL_RESTOCK_STOCK_ADJUSTMENT_REASON,
  CANCEL_RESTOCKABLE_STATUSES,
  CHECKOUT_STOCK_ADJUSTMENT_REASON,
  computeRestockCredit,
  ORDER_STOCK_REFERENCE_TYPE,
  shouldRestockOnStatusChange,
} from "./order-cancel-restock";

const CHECKOUT = CHECKOUT_STOCK_ADJUSTMENT_REASON;
const CANCEL_RESTOCK = CANCEL_RESTOCK_STOCK_ADJUSTMENT_REASON;

describe("cancellation restock — recorded checkout reconciliation", () => {
  it("scenario 1: no intervening adjustment credits the full ordered quantity", () => {
    // checkout 10 -> 0, nothing else, cancel
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 0,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: false,
    });
    assert.equal(result.credit, 10);
    assert.equal(result.mode, "recorded");
  });

  it("scenario 2: admin already restored the units, credit 0", () => {
    // checkout 10 -> 0, admin sets 0 -> 10, cancel
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 10,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: true,
    });
    assert.equal(result.credit, 0);
    assert.equal(result.mode, "no_credit");
  });

  it("scenario 3: partial admin adjustment credits only the shortfall", () => {
    // checkout 10 -> 0, admin sets 0 -> 5, cancel
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 5,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: true,
    });
    assert.equal(result.credit, 5);
    assert.equal(result.mode, "recorded");
  });

  it("scenario 4: a retried cancellation credits 0", () => {
    // After the first restock the level is back to the target.
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 10,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: false,
    });
    assert.equal(result.credit, 0);
  });

  it("never credits more than the ordered quantity", () => {
    // Stock was topped up well beyond what this order removed.
    const result = computeRestockCredit({
      orderedQuantity: 4,
      currentQuantity: 500,
      checkoutPostQuantity: 6,
      hasInterveningAdjustment: true,
    });
    assert.equal(result.credit, 0);

    const bounded = computeRestockCredit({
      orderedQuantity: 4,
      currentQuantity: 0,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: false,
    });
    assert.equal(bounded.credit, 4);
  });

  it("never produces a negative credit", () => {
    for (const current of [0, 3, 10, 11, 999]) {
      const result = computeRestockCredit({
        orderedQuantity: 10,
        currentQuantity: current,
        checkoutPostQuantity: 0,
        hasInterveningAdjustment: false,
      });
      assert.ok(result.credit >= 0, `credit was ${result.credit}`);
    }
  });

  it("reconciles correctly when other orders consumed stock in between", () => {
    // checkout 10 -> 0 (this order took 10), then another order legitimately
    // sold 10 more. Cancelling must still restore this order's 10.
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 0,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: true,
    });
    assert.equal(result.credit, 10);
  });

  it("handles a non-zero checkout baseline", () => {
    // Listing had 25, this order took 10, leaving 15.
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 15,
      checkoutPostQuantity: 15,
      hasInterveningAdjustment: false,
    });
    assert.equal(result.credit, 10);
  });
});

describe("cancellation restock — legacy orders without a checkout record", () => {
  it("credits the full quantity when nothing touched the listing afterwards", () => {
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 0,
      checkoutPostQuantity: null,
      hasInterveningAdjustment: false,
    });
    assert.equal(result.credit, 10);
    assert.equal(result.mode, "unchanged_since_checkout");
  });

  it("never over-credits a legacy order with an unexplained adjustment", () => {
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 10,
      checkoutPostQuantity: null,
      hasInterveningAdjustment: true,
    });
    assert.equal(result.credit, 0);
    assert.equal(result.mode, "indeterminate");
    assert.match(result.reason, /manual review/i);
  });
});

describe("cancellation restock — production regression fixture", () => {
  it("does not reproduce the listing-amb-P10605 surplus", () => {
    // Exact production numbers:
    //   seeded 10, checkout 10 -> 0, admin set 0 -> 10, cancel restock +10 -> 20
    // Expected final quantity is 10, not 20.
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 10,
      checkoutPostQuantity: null, // legacy order: no CHECKOUT record existed
      hasInterveningAdjustment: true, // the 17:25:35 admin ADD
    });

    assert.equal(result.credit, 0, "must not credit phantom stock");
    assert.equal(result.mode, "indeterminate");
    // Final quantity must remain what the admin set.
    assert.equal(10 + result.credit, 10);
  });

  it("reaches the same safe answer once checkout tracking exists", () => {
    // The same scenario on a NEW order, which does have a CHECKOUT record.
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: 10,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: true,
    });
    assert.equal(result.credit, 0);
    assert.equal(10 + result.credit, 10);
  });
});

describe("cancellation restock — guards and constants", () => {
  it("credits nothing for a non-positive order quantity", () => {
    for (const ordered of [0, -1]) {
      const result = computeRestockCredit({
        orderedQuantity: ordered,
        currentQuantity: 0,
        checkoutPostQuantity: 0,
        hasInterveningAdjustment: false,
      });
      assert.equal(result.credit, 0);
      assert.equal(result.mode, "no_credit");
    }
  });

  it("tolerates missing input without producing NaN", () => {
    const result = computeRestockCredit({
      orderedQuantity: 10,
      currentQuantity: Number.NaN,
      checkoutPostQuantity: 0,
      hasInterveningAdjustment: false,
    });
    assert.ok(Number.isFinite(result.credit));
    assert.ok(result.credit >= 0 && result.credit <= 10);
  });

  it("keeps the restock status policy unchanged", () => {
    for (const status of CANCEL_RESTOCKABLE_STATUSES) {
      assert.equal(shouldRestockOnStatusChange(status, "cancelled"), true, status);
    }
    assert.equal(shouldRestockOnStatusChange("shipped", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("delivered", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("completed", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("cancelled", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("returned", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("placed", "shipped"), false);
    assert.equal(shouldRestockOnStatusChange("placed", undefined), false);
  });

  it("uses stable machine-matchable reasons and the order reference", () => {
    assert.equal(CHECKOUT, "CHECKOUT");
    assert.equal(CANCEL_RESTOCK, "CANCEL_RESTOCK");
    // A CANCEL_RESTOCK row is distinguishable from a manual/admin row, which
    // is what lets a retry detect that the credit already happened.
    assert.notEqual(CHECKOUT, CANCEL_RESTOCK);
    assert.equal(ORDER_STOCK_REFERENCE_TYPE, "order");
  });
});
