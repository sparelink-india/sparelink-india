import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALLOCATION_STATUS_CANCELLED,
  ALLOCATION_STATUS_RETURNED,
  allocationTerminalStatusForOrderStatus,
  closeOrderAllocations,
  shouldCloseAllocationsOnStatusChange,
} from "./order-cancel-allocation";
import { CANCEL_RESTOCKABLE_STATUSES, shouldRestockOnStatusChange } from "./order-cancel-restock";
import { canAcceptPaymentForAllocationStatus } from "./payment-security";

/**
 * Structural fake for the drizzle chain used by `closeOrderAllocations`.
 * It records the exact `.set()` payload so we can assert the update is
 * narrowly scoped (no paymentStatus, no reopening).
 */
function createFakeTx(
  rows: Array<{ id: string; orderId: string; fulfillmentStatus: string }>,
) {
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    updates,
    update() {
      const payload: Record<string, unknown> = {};
      const chain = {
        set(next: Record<string, unknown>) {
          Object.assign(payload, next);
          return chain;
        },
        where() {
          return chain;
        },
        async returning() {
          updates.push({ ...payload });
          // Emulate the `ne(fulfillmentStatus, target)` guard.
          return rows
            .filter((row) => row.fulfillmentStatus !== payload.fulfillmentStatus)
            .map((row) => ({ id: row.id }));
        },
      };
      return chain;
    },
  };
  return tx;
}

describe("order cancel — allocation propagation policy", () => {
  it("closes allocations for placed -> cancelled", () => {
    assert.equal(shouldCloseAllocationsOnStatusChange("placed", "cancelled"), true);
    assert.equal(
      allocationTerminalStatusForOrderStatus("cancelled"),
      ALLOCATION_STATUS_CANCELLED,
    );
  });

  it("closes allocations for processing -> cancelled", () => {
    assert.equal(shouldCloseAllocationsOnStatusChange("processing", "cancelled"), true);
    assert.equal(shouldCloseAllocationsOnStatusChange("confirmed", "cancelled"), true);
    assert.equal(shouldCloseAllocationsOnStatusChange("packed", "cancelled"), true);
    assert.equal(shouldCloseAllocationsOnStatusChange("pending", "cancelled"), true);
  });

  it("still closes allocations out of shipped/delivered, unlike restock", () => {
    // Deliberate asymmetry: goods have left the warehouse so they are NOT
    // restocked, but the allocation must still close or it stays open work.
    assert.equal(shouldRestockOnStatusChange("shipped", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("delivered", "cancelled"), false);
    assert.equal(shouldCloseAllocationsOnStatusChange("shipped", "cancelled"), true);
    assert.equal(shouldCloseAllocationsOnStatusChange("delivered", "cancelled"), true);
  });

  it("treats cancelled -> cancelled as a no-op", () => {
    assert.equal(shouldCloseAllocationsOnStatusChange("cancelled", "cancelled"), false);
  });

  it("propagates returned without inventing a new status", () => {
    assert.equal(shouldCloseAllocationsOnStatusChange("delivered", "returned"), true);
    assert.equal(shouldCloseAllocationsOnStatusChange("placed", "returned"), true);
    assert.equal(
      allocationTerminalStatusForOrderStatus("returned"),
      ALLOCATION_STATUS_RETURNED,
    );
    // `returned` is already a recognised non-payable allocation status.
    assert.equal(canAcceptPaymentForAllocationStatus(ALLOCATION_STATUS_RETURNED), false);
  });

  it("does not reopen a terminal order", () => {
    // `canTransitionOrderStatus` already blocks these; the predicate is also
    // safe standalone.
    assert.equal(shouldCloseAllocationsOnStatusChange("cancelled", "returned"), false);
    assert.equal(shouldCloseAllocationsOnStatusChange("returned", "cancelled"), false);
    assert.equal(shouldCloseAllocationsOnStatusChange("returned", "returned"), false);
    assert.equal(shouldCloseAllocationsOnStatusChange("completed", "cancelled"), false);
  });

  it("ignores non-terminal transitions", () => {
    assert.equal(shouldCloseAllocationsOnStatusChange("placed", "shipped"), false);
    assert.equal(shouldCloseAllocationsOnStatusChange("placed", undefined), false);
    assert.equal(shouldCloseAllocationsOnStatusChange("placed", null), false);
    assert.equal(allocationTerminalStatusForOrderStatus("shipped"), null);
    assert.equal(allocationTerminalStatusForOrderStatus(undefined), null);
  });

  it("closes allocations for every restockable status the UI allows", () => {
    // If the admin UI offers cancellation, allocations must close too.
    for (const status of CANCEL_RESTOCKABLE_STATUSES) {
      assert.equal(shouldCloseAllocationsOnStatusChange(status, "cancelled"), true, status);
    }
  });
});

describe("order cancel — closeOrderAllocations", () => {
  it("writes only the terminal fulfillment status", async () => {
    const tx = createFakeTx([
      { id: "fo-1", orderId: "order-1", fulfillmentStatus: "pending" },
      { id: "fo-2", orderId: "order-1", fulfillmentStatus: "pending" },
    ]);

    const result = await closeOrderAllocations(tx, "order-1", "cancelled");

    assert.equal(result.closedAllocations, 2);
    assert.equal(result.allocationStatus, "cancelled");
    assert.equal(tx.updates.length, 1);
    const payload = tx.updates[0];
    assert.equal(payload.fulfillmentStatus, "cancelled");
    // Never touches money.
    assert.equal("paymentStatus" in payload, false);
    assert.equal("paymentAccountingReference" in payload, false);
    assert.equal("amountPaise" in payload, false);
  });

  it("never rewrites an already-cancelled allocation", async () => {
    const tx = createFakeTx([
      { id: "fo-1", orderId: "order-1", fulfillmentStatus: "cancelled" },
    ]);

    const result = await closeOrderAllocations(tx, "order-1", "cancelled");

    assert.equal(result.closedAllocations, 0);
    assert.equal(result.allocationStatus, null);
  });

  it("closes a returned allocation separately from a cancelled one", async () => {
    const tx = createFakeTx([
      { id: "fo-1", orderId: "order-1", fulfillmentStatus: "pending" },
    ]);

    const result = await closeOrderAllocations(tx, "order-1", "returned");

    assert.equal(result.closedAllocations, 1);
    assert.equal(result.allocationStatus, "returned");
    assert.equal(tx.updates[0].fulfillmentStatus, "returned");
  });

  it("is a no-op without an order id or status", async () => {
    const tx = createFakeTx([]);
    assert.deepEqual(await closeOrderAllocations(tx, "", "cancelled"), {
      closedAllocations: 0,
      allocationStatus: null,
    });
    assert.deepEqual(await closeOrderAllocations(tx, "order-1", ""), {
      closedAllocations: 0,
      allocationStatus: null,
    });
    assert.equal(tx.updates.length, 0);
  });
});
