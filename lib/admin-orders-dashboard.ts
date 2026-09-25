/**
 * View model for the Admin Orders dashboard.
 *
 * Everything here is pure and derives ONLY from the order list already loaded
 * from `GET /api/admin/orders`. No count, total or order is fabricated, and no
 * new backend search or filter endpoint is required.
 *
 * The cancellation policy and request body are NOT re-implemented here. They are
 * re-exported from `lib/admin-order-cancellation.ts` so there is exactly one
 * source of truth and the same `PATCH /api/admin/orders` contract.
 */

export {
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

/** Shape returned by `GET /api/admin/orders`. */
export type AdminOrderFirmAllocation = {
  firmOrderId: string;
  firmName: string;
  firmCode?: string;
  amountPaise?: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  buyerEmail: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPaise: number;
  itemCount: number;
  createdAt: string;
  firmAllocations?: AdminOrderFirmAllocation[];
};

export const ORDER_FILTERS = [
  "active",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderFilter = (typeof ORDER_FILTERS)[number];

export const ORDER_FILTER_LABELS: Record<OrderFilter, string> = {
  active: "All Orders",
  pending: "Placed / Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type OrderSummary = Record<OrderFilter, number> & { total: number };

function normalize(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

export function isCancelledOrder(order: { status: string }): boolean {
  return normalize(order.status) === "cancelled";
}

/**
 * The active view never contains cancelled orders. A cancelled order moves to
 * the bin and is no longer actionable there.
 */
export function isActiveOrder(order: { status: string }): boolean {
  return !isCancelledOrder(order);
}

export function matchesOrderFilter(
  order: { status: string },
  filter: OrderFilter,
): boolean {
  const status = normalize(order.status);
  switch (filter) {
    case "active":
      return status !== "cancelled";
    case "pending":
      // Checkout writes `placed`; older rows may be `pending`. One bucket.
      return status === "placed" || status === "pending";
    case "processing":
      return status === "processing" || status === "confirmed" || status === "packed";
    case "shipped":
      return status === "shipped";
    case "delivered":
      return status === "delivered" || status === "completed";
    case "cancelled":
      return status === "cancelled";
    default:
      return true;
  }
}

/**
 * Live counts, derived strictly from the loaded orders.
 * `total` is every loaded order; each filter count is independent, so the
 * filter chips do not sum to the total (a cancelled order is only in one).
 */
export function summarizeOrders(orders: readonly AdminOrder[]): OrderSummary {
  const summary: OrderSummary = {
    total: orders.length,
    active: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const order of orders) {
    for (const filter of ORDER_FILTERS) {
      if (matchesOrderFilter(order, filter)) summary[filter] += 1;
    }
  }
  return summary;
}

export function cancelledOrderCount(orders: readonly AdminOrder[]): number {
  return orders.reduce((count, order) => (isCancelledOrder(order) ? count + 1 : count), 0);
}

export function activeOrderCount(orders: readonly AdminOrder[]): number {
  return orders.length - cancelledOrderCount(orders);
}

/**
 * Search across the fields the admin orders API actually returns. Part numbers
 * and buyer names are not part of that payload, so they are not searchable here
 * and no new endpoint is introduced to obtain them.
 */
export function matchesOrderQuery(
  order: AdminOrder,
  query: string,
): boolean {
  const term = (query ?? "").trim().toLowerCase();
  if (!term) return true;

  if (order.orderNumber?.toLowerCase().includes(term)) return true;
  if (order.buyerEmail?.toLowerCase().includes(term)) return true;
  if (order.status?.toLowerCase().includes(term)) return true;
  if (order.paymentStatus?.toLowerCase().includes(term)) return true;
  if (order.paymentMethod?.toLowerCase().includes(term)) return true;

  return (order.firmAllocations ?? []).some(
    (allocation) =>
      allocation?.firmName?.toLowerCase().includes(term) ||
      allocation?.firmCode?.toLowerCase().includes(term),
  );
}

export function filterOrders(
  orders: readonly AdminOrder[],
  options: { filter: OrderFilter; query?: string },
): AdminOrder[] {
  return orders.filter(
    (order) =>
      matchesOrderFilter(order, options.filter) &&
      matchesOrderQuery(order, options.query ?? ""),
  );
}

export function hasActiveFilters(options: { filter: OrderFilter; query?: string }): boolean {
  return options.filter !== "active" || (options.query ?? "").trim().length > 0;
}

/** Statuses the backend lists in `ALLOWED_STATUSES` for the admin PATCH. */
export const KNOWN_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "placed",
  "processing",
  "completed",
] as const;

export function formatOrderStatus(status: string | null | undefined): string {
  const value = normalize(status);
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatPaymentStatus(status: string | null | undefined): string {
  const value = normalize(status);
  if (!value) return "Unknown";
  if (value === "unpaid") return "Unpaid";
  if (value === "pending") return "Pending";
  if (value === "paid") return "Paid";
  if (value === "failed") return "Failed";
  if (value === "refunded") return "Refunded";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatPaymentMethod(method: string | null | undefined): string {
  const value = normalize(method);
  if (value === "cash_on_delivery") return "Cash on Delivery";
  if (value === "bank_transfer") return "Bank Transfer";
  if (value === "online_payment") return "Online (Cashfree)";
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Minor-unit paise to a rupee string, matching the existing admin table. */
export function formatInr(paise: number | null | undefined): string {
  const value = typeof paise === "number" && Number.isFinite(paise) ? paise : 0;
  return `₹${(value / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
