import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAcceptPaymentForAllocationStatus,
  canAcceptPaymentForOrderStatus,
  canMarkPaymentPaid,
  canTransitionOrderStatus,
  isBankTransferPaymentMethod,
  isCashfreePaymentMethod,
} from "./payment-security";

describe("payment and order security rules", () => {
  it("keeps Cashfree and bank transfer methods mutually exclusive", () => {
    assert.equal(isCashfreePaymentMethod("online_payment"), true);
    assert.equal(isCashfreePaymentMethod("bank_transfer"), false);
    assert.equal(isBankTransferPaymentMethod("bank_transfer"), true);
    assert.equal(isBankTransferPaymentMethod("online_payment"), false);
  });

  it("rejects cancelled and returned orders for payment", () => {
    assert.equal(canAcceptPaymentForOrderStatus("placed"), true);
    assert.equal(canAcceptPaymentForOrderStatus("cancelled"), false);
    assert.equal(canAcceptPaymentForOrderStatus("returned"), false);
    assert.equal(canAcceptPaymentForAllocationStatus("delivered"), true);
    assert.equal(canAcceptPaymentForAllocationStatus("cancelled"), false);
    assert.equal(
      canMarkPaymentPaid("placed", "pending"),
      true,
    );
    assert.equal(canMarkPaymentPaid("cancelled", "pending"), false);
  });

  it("keeps a cancelled parent non-payable regardless of allocation state", () => {
    // Defense in depth: cancelling an order must not become payable again even
    // if its firm allocation were somehow left in a non-terminal state.
    for (const allocationStatus of ["pending", "confirmed", "packed", "shipped", "delivered"]) {
      assert.equal(
        canMarkPaymentPaid("cancelled", allocationStatus),
        false,
        allocationStatus,
      );
    }
  });

  it("keeps a cancelled or returned allocation non-payable", () => {
    for (const allocationStatus of ["cancelled", "returned"]) {
      assert.equal(canAcceptPaymentForAllocationStatus(allocationStatus), false, allocationStatus);
      assert.equal(
        canMarkPaymentPaid("placed", allocationStatus),
        false,
        allocationStatus,
      );
      // An open parent order does not override a terminal allocation.
      assert.equal(canAcceptPaymentForOrderStatus("placed"), true);
    }
    assert.equal(canAcceptPaymentForAllocationStatus("returned"), false);
    assert.equal(canAcceptPaymentForOrderStatus("returned"), false);
  });

  it("prevents terminal order states from moving backward", () => {
    assert.equal(canTransitionOrderStatus("processing", "completed"), true);
    assert.equal(canTransitionOrderStatus("cancelled", "placed"), false);
    assert.equal(canTransitionOrderStatus("completed", "pending"), false);
    assert.equal(canTransitionOrderStatus("returned", "delivered"), false);
  });
});
