import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CANCEL_RESTOCKABLE_STATUSES } from "./order-cancel-restock";
import {
  applyCancelledStatus,
  buildOrderCancellationConfirmation,
  buildOrderCancellationPayload,
  isOrderCancellationAllowed,
  isTerminalOrderStatus,
  ORDER_CANCELLATION_CONFIRMATION,
  ORDER_CANCELLATION_PATH,
  ORDER_CANCELLATION_STATUS,
  orderCancellationErrorMessage,
  orderCancellationSuccessMessage,
  readRestockedLines,
  TERMINAL_ORDER_STATUSES,
} from "./admin-order-cancellation";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const page = () => source("app/admin/orders/page.tsx");

describe("cancellation availability", () => {
  it("offers cancellation for cancellable order states", () => {
    for (const status of ["placed", "pending", "confirmed", "processing", "packed"]) {
      assert.equal(
        isOrderCancellationAllowed({ id: "order-1", status }),
        true,
        `${status} must be cancellable`,
      );
    }
  });

  it("hides the action for terminal orders", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      assert.equal(
        isOrderCancellationAllowed({ id: "order-1", status }),
        false,
        `${status} must not be cancellable`,
      );
    }
  });

  it("hides the action for shipped and delivered orders", () => {
    // The backend would accept these transitions but deliberately does NOT
    // restock them, so the UI must not offer a cancellation the restock path
    // cannot honour.
    for (const status of ["shipped", "delivered"]) {
      assert.equal(
        isOrderCancellationAllowed({ id: "order-1", status }),
        false,
        `${status} must not be cancellable from the UI`,
      );
    }
  });

  it("offers the action only for statuses the restock path supports", () => {
    for (const status of ["placed", "pending", "confirmed", "processing", "packed"]) {
      assert.equal(CANCEL_RESTOCKABLE_STATUSES.has(status), true, `${status} should be restockable`);
      assert.equal(
        isOrderCancellationAllowed({ id: "order-1", status }),
        true,
        `${status} should offer the action`,
      );
    }
  });

  it("hides the action when the order row is incomplete", () => {
    assert.equal(isOrderCancellationAllowed({ id: "", status: "placed" }), false);
    assert.equal(isOrderCancellationAllowed({ id: "order-1", status: "" }), false);
  });

  it("detects terminal statuses case-insensitively", () => {
    assert.equal(isTerminalOrderStatus("CANCELLED"), true);
    assert.equal(isTerminalOrderStatus("  Cancelled "), true);
    assert.equal(isTerminalOrderStatus("placed"), false);
    assert.equal(isTerminalOrderStatus(null), false);
    assert.equal(isTerminalOrderStatus(undefined), false);
  });
});

describe("request payload contract", () => {
  it("sends only orderId and status", () => {
    assert.deepEqual(buildOrderCancellationPayload("order-1"), {
      orderId: "order-1",
      status: "cancelled",
    });
  });

  it("never includes paymentStatus", () => {
    const payload = buildOrderCancellationPayload("order-1") as Record<string, unknown>;
    assert.equal("paymentStatus" in payload, false);
    assert.deepEqual(Object.keys(payload).sort(), ["orderId", "status"]);
  });

  it("only ever sends the cancelled status", () => {
    for (const id of ["a", "b", "c"]) {
      assert.equal(buildOrderCancellationPayload(id).status, ORDER_CANCELLATION_STATUS);
    }
  });

  it("targets the existing PATCH endpoint", () => {
    assert.equal(ORDER_CANCELLATION_PATH, "/api/admin/orders");
  });
});

describe("confirmation copy", () => {
  it("uses the required confirmation text", () => {
    assert.equal(
      ORDER_CANCELLATION_CONFIRMATION,
      "Cancel this order? The reserved inventory will be restored.",
    );
    assert.equal(
      buildOrderCancellationConfirmation({ paymentStatus: "pending" }),
      "Cancel this order? The reserved inventory will be restored.",
    );
  });

  it("warns extra when the order is already paid", () => {
    const paid = buildOrderCancellationConfirmation({ paymentStatus: "paid" });
    assert.notEqual(paid, ORDER_CANCELLATION_CONFIRMATION);
    assert.match(paid, /already marked paid/i);
    assert.match(paid, /does not refund/i);
  });
});

describe("error and success messaging", () => {
  it("prefers the server message", () => {
    assert.equal(
      orderCancellationErrorMessage(409, { error: "This order cannot be cancelled." }),
      "This order cannot be cancelled.",
    );
  });

  it("maps known status codes to clear messages", () => {
    assert.match(orderCancellationErrorMessage(401, null), /session/i);
    assert.match(orderCancellationErrorMessage(403, null), /not allowed/i);
    assert.match(orderCancellationErrorMessage(404, null), /no longer exists/i);
    assert.match(orderCancellationErrorMessage(409, null), /current state/i);
    assert.match(orderCancellationErrorMessage(500, null), /try again/i);
  });

  it("ignores a non-string error body safely", () => {
    assert.equal(
      orderCancellationErrorMessage(400, { error: { nested: true } } as never),
      "Unable to cancel the order. Please try again.",
    );
  });

  it("reports whether inventory was restored", () => {
    assert.match(orderCancellationSuccessMessage("SL-1", true), /inventory was restored/i);
    assert.match(orderCancellationSuccessMessage("SL-1", false), /cancelled/i);
    assert.doesNotMatch(orderCancellationSuccessMessage("SL-1", false), /restored/i);
  });

  it("reads restockedLines defensively", () => {
    assert.equal(readRestockedLines({ restockedLines: 1 }), 1);
    assert.equal(readRestockedLines({ restockedLines: 0 }), 0);
    assert.equal(readRestockedLines({}), 0);
    assert.equal(readRestockedLines(null), 0);
    assert.equal(readRestockedLines("nope"), 0);
  });
});

describe("list update after cancellation", () => {
  it("changes only the cancelled order", () => {
    const orders = [
      { id: "a", status: "placed" },
      { id: "b", status: "placed" },
      { id: "c", status: "cancelled" },
    ];
    const next = applyCancelledStatus(orders, "a");
    assert.equal(next[0].status, "cancelled");
    assert.equal(next[1].status, "placed", "other orders must be untouched");
    assert.equal(next[2].status, "cancelled");
    assert.equal(orders[0].status, "placed", "input must not be mutated");
  });

  it("is a no-op for an unknown id", () => {
    const orders = [{ id: "a", status: "placed" }];
    assert.deepEqual(applyCancelledStatus(orders, "missing"), orders);
  });
});

describe("admin orders page wiring", () => {
  it("uses the existing endpoint with PATCH", () => {
    const p = page();
    assert.match(p, /fetch\(\s*ORDER_CANCELLATION_PATH/);
    assert.match(p, /method:\s*"PATCH"/);
  });

  it("builds the body from the shared payload helper", () => {
    const p = page();
    assert.match(p, /JSON\.stringify\(buildOrderCancellationPayload\(order\.id\)\)/);
  });

  it("never sends a paymentStatus from the page", () => {
    const p = page();
    // The request body is produced solely by the shared helper, which is
    // asserted elsewhere to contain only orderId and status. The cancel
    // handler itself must not mention payment state at all.
    const handler = p.slice(p.indexOf("const handleCancelOrder"), p.indexOf("return ("));
    assert.equal(/paymentStatus/.test(handler), false);
    assert.equal(/payment_status/.test(handler), false);
  });

  it("confirms before cancelling", () => {
    const p = page();
    assert.match(p, /window\.confirm\(buildOrderCancellationConfirmation\(order\)\)/);
  });

  it("prevents a double submit while cancelling", () => {
    const p = page();
    assert.match(p, /if \(cancellingId\) return;/);
    assert.match(p, /disabled=\{cancellingId !== null\}/);
    assert.match(p, /cancellingId === o\.id \? "Cancelling…"/);
  });

  it("refreshes the order list after a successful cancellation", () => {
    const p = page();
    assert.match(p, /setOrders\(\(current\) => applyCancelledStatus\(current, order\.id\)\)/);
    assert.match(p, /await loadOrders\(\)/);
  });

  it("surfaces a clear error when the API rejects the cancellation", () => {
    const p = page();
    assert.match(p, /orderCancellationErrorMessage\(response\.status, data\)/);
    assert.match(p, /role="alert"/);
  });

  it("shows the outcome after a successful cancellation", () => {
    const p = page();
    assert.match(p, /orderCancellationSuccessMessage\(/);
    assert.match(p, /role="status"/);
  });

  it("gates the action through the shared policy helper", () => {
    const p = page();
    assert.match(p, /isOrderCancellationAllowed\(o\)/);
    assert.match(p, /isOrderCancellationAllowed\(order\)/);
  });

  it("does not introduce a new cancellation endpoint", () => {
    const p = page();
    assert.equal(/api\/admin\/orders\/cancel/.test(p), false);
    assert.equal(/api\/admin\/order-cancel/.test(p), false);
  });

  it("keeps the existing table columns, invoice links and export", () => {
    const p = page();
    for (const label of ["Order #", "Buyer", "Items", "Status", "Payment", "Amount", "Date", "Invoice"]) {
      assert.ok(p.includes(label), `missing column ${label}`);
    }
    assert.match(p, /InvoiceDownloadLinks/);
    assert.match(p, /\/api\/admin\/orders\/export/);
  });

  it("keeps the table horizontally scrollable for small screens", () => {
    const p = page();
    assert.match(p, /overflow-x-auto/);
  });
});
