import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  activeOrderCount,
  buildOrderCancellationPayload,
  cancelledOrderCount,
  filterOrders,
  formatInr,
  formatOrderStatus,
  formatPaymentMethod,
  formatPaymentStatus,
  hasActiveFilters,
  isActiveOrder,
  isCancelledOrder,
  isOrderCancellationAllowed,
  matchesOrderFilter,
  matchesOrderQuery,
  ORDER_CANCELLATION_PATH,
  ORDER_FILTERS,
  ORDER_FILTER_LABELS,
  summarizeOrders,
  type AdminOrder,
} from "./admin-orders-dashboard";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "order-1",
    orderNumber: "SL-MUH3ZZEA-40468E",
    buyerEmail: "buyer@example.com",
    status: "placed",
    paymentStatus: "pending",
    paymentMethod: "cash_on_delivery",
    totalPaise: 2500,
    itemCount: 1,
    createdAt: "2026-09-25T15:22:02.868Z",
    firmAllocations: [{ firmOrderId: "fo-1", firmName: "Ambaji Traders", firmCode: "AMB" }],
    ...overrides,
  };
}

const page = () => source("app/admin/orders/page.tsx");

describe("status counts derive from loaded data", () => {
  const orders = [
    order({ id: "1", status: "placed" }),
    order({ id: "2", status: "processing" }),
    order({ id: "3", status: "shipped" }),
    order({ id: "4", status: "delivered" }),
    order({ id: "5", status: "cancelled" }),
    order({ id: "6", status: "packed" }),
  ];
  const summary = summarizeOrders(orders);

  it("counts every status bucket from the real list", () => {
    assert.equal(summary.total, 6);
    assert.equal(summary.active, 5, "cancelled is excluded from active");
    assert.equal(summary.pending, 1);
    assert.equal(summary.processing, 2, "processing + packed");
    assert.equal(summary.shipped, 1);
    assert.equal(summary.delivered, 1);
    assert.equal(summary.cancelled, 1);
  });

  it("never fabricates: an empty list counts zero everywhere", () => {
    const empty = summarizeOrders([]);
    for (const key of ORDER_FILTERS) assert.equal(empty[key], 0, key);
    assert.equal(empty.total, 0);
  });

  it("counts exactly what is passed in", () => {
    assert.equal(summarizeOrders([order()]).total, 1);
    assert.equal(
      summarizeOrders([order({ status: "cancelled" }), order({ status: "cancelled" })]).cancelled,
      2,
    );
  });

  it("treats confirmed and packed as processing", () => {
    assert.equal(matchesOrderFilter({ status: "confirmed" }, "processing"), true);
    assert.equal(matchesOrderFilter({ status: "packed" }, "processing"), true);
  });

  it("treats placed and pending as one bucket", () => {
    assert.equal(matchesOrderFilter({ status: "placed" }, "pending"), true);
    assert.equal(matchesOrderFilter({ status: "pending" }, "pending"), true);
    assert.equal(matchesOrderFilter({ status: "shipped" }, "pending"), false);
  });

  it("treats completed as delivered", () => {
    assert.equal(matchesOrderFilter({ status: "completed" }, "delivered"), true);
  });

  it("counts cancelled orders for the bin", () => {
    assert.equal(cancelledOrderCount(orders), 1);
    assert.equal(activeOrderCount(orders), 5);
    assert.equal(cancelledOrderCount([]), 0);
  });
});

describe("cancelled orders leave the active view", () => {
  const orders = [
    order({ id: "1", status: "placed" }),
    order({ id: "2", status: "cancelled" }),
  ];

  it("the active filter excludes cancelled orders", () => {
    const active = filterOrders(orders, { filter: "active" });
    assert.deepEqual(active.map((o) => o.id), ["1"]);
  });

  it("the cancelled filter returns only cancelled orders", () => {
    const cancelled = filterOrders(orders, { filter: "cancelled" });
    assert.deepEqual(cancelled.map((o) => o.id), ["2"]);
  });

  it("identifies cancelled orders case-insensitively", () => {
    assert.equal(isCancelledOrder({ status: "Cancelled" }), true);
    assert.equal(isCancelledOrder({ status: "CANCELLED" }), true);
    assert.equal(isCancelledOrder({ status: "placed" }), false);
    assert.equal(isActiveOrder({ status: "cancelled" }), false);
  });

  it("a cancelled order cannot be cancelled again", () => {
    for (const status of ["cancelled", "completed", "returned"]) {
      assert.equal(isOrderCancellationAllowed({ id: "order-1", status }), false, status);
    }
  });

  it("a cancelled order still offers no cancel action but keeps its data", () => {
    const cancelled = order({ id: "2", status: "cancelled" });
    assert.equal(isOrderCancellationAllowed(cancelled), false);
    assert.equal(cancelled.orderNumber, "SL-MUH3ZZEA-40468E");
    assert.equal(cancelled.totalPaise, 2500);
  });
});

describe("cancellation visibility and payload", () => {
  it("shows cancel for restockable orders only", () => {
    for (const status of ["placed", "pending", "confirmed", "processing", "packed"]) {
      assert.equal(isOrderCancellationAllowed({ id: "o", status }), true, status);
    }
    for (const status of ["shipped", "delivered", "completed", "returned", "cancelled"]) {
      assert.equal(isOrderCancellationAllowed({ id: "o", status }), false, status);
    }
  });

  it("sends only orderId and status", () => {
    const payload = buildOrderCancellationPayload("o-1") as Record<string, unknown>;
    assert.deepEqual(payload, { orderId: "o-1", status: "cancelled" });
    assert.equal("paymentStatus" in payload, false);
  });

  it("still targets the one existing endpoint", () => {
    assert.equal(ORDER_CANCELLATION_PATH, "/api/admin/orders");
  });

  it("the dashboard does not re-implement the cancellation policy", () => {
    const dash = source("lib/admin-orders-dashboard.ts");
    assert.match(dash, /from "\.\/admin-order-cancellation"/);
    // Re-exported, not duplicated.
    assert.match(dash, /isOrderCancellationAllowed/);
  });
});

describe("search", () => {
  const target = order({
    orderNumber: "SL-MUH41Z28-F77FD1",
    buyerEmail: "owner@sparelink.in",
    firmAllocations: [{ firmOrderId: "fo-9", firmName: "Ambaji Traders", firmCode: "AMB" }],
  });

  it("matches on order number", () => {
    assert.equal(matchesOrderQuery(target, "41Z28"), true);
    assert.equal(matchesOrderQuery(target, "sl-muh41z28"), true, "case-insensitive");
    assert.equal(matchesOrderQuery(target, "NOPE"), false);
  });

  it("matches on buyer email", () => {
    assert.equal(matchesOrderQuery(target, "sparelink.in"), true);
  });

  it("matches on firm name and code", () => {
    assert.equal(matchesOrderQuery(target, "ambaji"), true);
    assert.equal(matchesOrderQuery(target, "AMB"), true);
  });

  it("matches on status and payment", () => {
    assert.equal(matchesOrderQuery(target, "placed"), true);
    assert.equal(matchesOrderQuery(target, "cash_on_delivery"), true);
  });

  it("an empty query matches everything", () => {
    assert.equal(matchesOrderQuery(target, ""), true);
    assert.equal(matchesOrderQuery(target, "   "), true);
  });

  it("combines search with the active filter", () => {
    const orders = [
      order({ id: "1", orderNumber: "SL-AAA", status: "placed" }),
      order({ id: "2", orderNumber: "SL-BBB", status: "cancelled" }),
    ];
    assert.deepEqual(
      filterOrders(orders, { filter: "active", query: "bbb" }).map((o) => o.id),
      [],
      "a cancelled order is never returned by the active view even if it matches",
    );
    assert.deepEqual(
      filterOrders(orders, { filter: "cancelled", query: "bbb" }).map((o) => o.id),
      ["2"],
    );
  });

  it("reports whether filters are active for the empty state", () => {
    assert.equal(hasActiveFilters({ filter: "active", query: "" }), false);
    assert.equal(hasActiveFilters({ filter: "active", query: "x" }), true);
    assert.equal(hasActiveFilters({ filter: "shipped", query: "" }), true);
  });
});

describe("presentation helpers", () => {
  it("formats status for display", () => {
    assert.equal(formatOrderStatus("placed"), "Placed");
    assert.equal(formatOrderStatus("cash_on_delivery"), "Cash_on_delivery");
    assert.equal(formatOrderStatus(""), "Unknown");
  });

  it("formats payment status and method", () => {
    assert.equal(formatPaymentStatus("unpaid"), "Unpaid");
    assert.equal(formatPaymentStatus("pending"), "Pending");
    assert.equal(formatPaymentStatus("paid"), "Paid");
    assert.equal(formatPaymentStatus(null), "Unknown");
    assert.equal(formatPaymentMethod("cash_on_delivery"), "Cash on Delivery");
    assert.equal(formatPaymentMethod("bank_transfer"), "Bank Transfer");
    assert.equal(formatPaymentMethod("online_payment"), "Online (Cashfree)");
  });

  it("formats paise as rupees", () => {
    assert.equal(formatInr(2500), "₹25.00");
    assert.equal(formatInr(0), "₹0.00");
    assert.equal(formatInr(undefined), "₹0.00");
    assert.equal(formatInr(123456), "₹1,234.56");
  });

  it("labels every filter", () => {
    for (const filter of ORDER_FILTERS) {
      assert.equal(typeof ORDER_FILTER_LABELS[filter], "string", filter);
      assert.ok(ORDER_FILTER_LABELS[filter].length > 0, filter);
    }
  });
});

describe("page structure", () => {
  it("uses only the existing orders endpoint", () => {
    const p = page();
    assert.match(p, /fetch\("\/api\/admin\/orders", \{ cache: "no-store" \}\)/);
    // The only permitted sub-path is the pre-existing Excel export.
    const subPaths = [...p.matchAll(/\/api\/admin\/orders\/([a-z-]+)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(subPaths)], ["export"]);
  });

  it("introduces no new cancellation endpoint", () => {
    const p = page();
    for (const forbidden of [
      "/api/admin/orders/cancel",
      "/api/admin/order-cancel",
      "/api/admin/orders/refund",
      "/api/admin/cancel",
    ]) {
      assert.equal(p.includes(forbidden), false, forbidden);
    }
  });

  it("cancels through the existing PATCH endpoint with a safe body", () => {
    const p = page();
    assert.match(p, /method:\s*"PATCH"/);
    assert.match(p, /JSON\.stringify\(buildOrderCancellationPayload\(order\.id\)\)/);
    const handler = p.slice(p.indexOf("const handleCancelOrder"), p.indexOf("return ("));
    assert.equal(/paymentStatus/.test(handler), false);
    assert.equal(/payment_status/.test(handler), false);
  });

  it("keeps confirmation, double-submit protection and refresh", () => {
    const p = page();
    assert.match(p, /window\.confirm\(buildOrderCancellationConfirmation\(order\)\)/);
    assert.match(p, /if \(cancellingId\) return;/);
    assert.match(p, /disabled=\{cancellingId !== null\}/);
    assert.match(p, /setOrders\(\(current\) => applyCancelledStatus\(current, order\.id\)\)/);
    assert.match(p, /await loadOrders\(\)/);
  });

  it("keeps error and success banners", () => {
    const p = page();
    assert.match(p, /role="alert"/);
    assert.match(p, /role="status"/);
    assert.match(p, /orderCancellationErrorMessage\(response\.status, data\)/);
    assert.match(p, /orderCancellationSuccessMessage\(/);
  });

  it("renders the cancelled bin with a live count", () => {
    const p = page();
    assert.match(p, /Cancelled Orders/);
    assert.match(p, /🗑️/);
    assert.match(p, /cancelledOrderCount\(orders\)/);
    assert.match(p, /setFilter\("cancelled"\)/);
  });

  it("derives every summary card from summarizeOrders", () => {
    const p = page();
    assert.match(p, /summarizeOrders\(orders\)/);
    // No hard-coded counts in the card values.
    assert.equal(/value=\{\d+\}/.test(p), false);
  });

  it("has loading, empty and filtered-empty states", () => {
    const p = page();
    assert.match(p, /Loading orders…/);
    assert.match(p, /No cancelled orders/);
    assert.match(p, /No orders match your search/);
    assert.match(p, /No orders found/);
  });

  it("provides view details and keeps invoice links and export", () => {
    const p = page();
    assert.match(p, /View Details/);
    assert.match(p, /aria-expanded=\{isExpanded\}/);
    assert.match(p, /Firm allocations/);
    assert.match(p, /InvoiceDownloadLinks/);
    assert.match(p, /\/api\/admin\/orders\/export/);
  });

  it("keeps every required table column", () => {
    const p = page();
    for (const label of [
      "Order #",
      "Buyer",
      "Items",
      "Status",
      "Payment",
      "Amount",
      "Date",
      "Invoice",
      "Actions",
    ]) {
      assert.ok(p.includes(label), `missing column ${label}`);
    }
  });

  it("is mobile safe", () => {
    const p = page();
    assert.match(p, /overflow-x-auto/);
    assert.match(p, /min-w-\[64rem\]/);
    assert.match(p, /grid-cols-2/);
    assert.match(p, /sm:px-6/);
    // The bin control stays in the header, visible on small screens.
    assert.match(p, /flex flex-wrap items-center gap-2/);
  });

  it("uses the existing SpareLink burgundy brand colour", () => {
    const p = page();
    assert.match(p, /#7a1233/);
  });
});
