import { canTransitionOrderStatus } from "./payment-security";
import { CANCEL_RESTOCKABLE_STATUSES } from "./order-cancel-restock";

/**
 * Policy and request construction for the Admin Orders cancellation control.
 *
 * The UI reuses the EXISTING `PATCH /api/admin/orders` endpoint. No new
 * endpoint is introduced and no backend logic is duplicated here: this module
 * only decides whether the action should be offered and builds the exact body.
 *
 * Two invariants are enforced and asserted by the tests:
 *
 *  1. The request body NEVER contains `paymentStatus`. Payment state may only
 *     be changed through the verified payment or manual bank-transfer
 *     workflows, and the API rejects it outright.
 *  2. The only status ever sent is `cancelled`.
 */

export const ORDER_CANCELLATION_PATH = "/api/admin/orders";

export const ORDER_CANCELLATION_STATUS = "cancelled" as const;

export const ORDER_CANCELLATION_CONFIRMATION =
  "Cancel this order? The reserved inventory will be restored.";

export const ORDER_CANCELLATION_CONFIRMATION_PAID =
  "Cancel this order? The reserved inventory will be restored. This order is already marked paid — cancelling does not refund it.";

export const ORDER_CANCELLATION_ERROR_FALLBACK =
  "Unable to cancel the order. Please try again.";

/** Statuses from which the backend refuses any further transition. */
export const TERMINAL_ORDER_STATUSES = ["cancelled", "completed", "returned"] as const;

export type CancellableOrder = {
  id: string;
  status: string;
  paymentStatus?: string | null;
};

export function isTerminalOrderStatus(status: string | null | undefined): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(
    (status ?? "").trim().toLowerCase(),
  );
}

/**
 * The action is offered only when cancelling is BOTH:
 *
 *  - permitted by the shared backend transition rule
 *    (`canTransitionOrderStatus`), and
 *  - restorable through the existing restock path
 *    (`CANCEL_RESTOCKABLE_STATUSES`).
 *
 * The second condition matters. The backend will accept a transition out of
 * `shipped` or `delivered`, but `shouldRestockOnStatusChange` deliberately does
 * NOT restock those, because the goods have already left the warehouse. Showing
 * the action there would produce a cancelled order with no inventory restored
 * and the stock in transit. The UI therefore never offers a cancellation the
 * restock flow cannot honour. No backend logic is changed.
 */
export function isOrderCancellationAllowed(order: {
  id: string;
  status: string;
}): boolean {
  if (!order.id || !order.status) return false;
  if (isTerminalOrderStatus(order.status)) return false;
  if (!CANCEL_RESTOCKABLE_STATUSES.has(order.status)) return false;
  return canTransitionOrderStatus(order.status, ORDER_CANCELLATION_STATUS);
}

/**
 * Exact body for the existing endpoint. Contains `orderId` and `status` only —
 * never `paymentStatus`, and `status` is always `cancelled`.
 */
export function buildOrderCancellationPayload(
  orderId: string,
): { orderId: string; status: typeof ORDER_CANCELLATION_STATUS } {
  return { orderId, status: ORDER_CANCELLATION_STATUS };
}

export function buildOrderCancellationConfirmation(order: {
  paymentStatus?: string | null;
}): string {
  return (order.paymentStatus ?? "").toLowerCase() === "paid"
    ? ORDER_CANCELLATION_CONFIRMATION_PAID
    : ORDER_CANCELLATION_CONFIRMATION;
}

/**
 * Map a rejected cancellation to a clear, safe message. The server's own
 * message is preferred because it is already written to be user safe.
 */
export function orderCancellationErrorMessage(
  status: number,
  body: { error?: unknown } | null | undefined,
): string {
  const serverMessage =
    typeof body?.error === "string" ? body.error.trim() : "";
  if (serverMessage) return serverMessage;

  if (status === 401) return "Your admin session has expired. Sign in again.";
  if (status === 403) return "You are not allowed to cancel orders.";
  if (status === 404) return "That order no longer exists.";
  if (status === 409) return "This order cannot be cancelled in its current state.";
  return ORDER_CANCELLATION_ERROR_FALLBACK;
}

export function orderCancellationSuccessMessage(orderNumber: string, restocked: boolean): string {
  return restocked
    ? `Order ${orderNumber} cancelled. Reserved inventory was restored.`
    : `Order ${orderNumber} cancelled.`;
}

/** Read `restockedLines` from a successful response without trusting its shape. */
export function readRestockedLines(body: unknown): number {
  if (!body || typeof body !== "object") return 0;
  const value = (body as { restockedLines?: unknown }).restockedLines;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Apply a confirmed cancellation to the loaded list so the table reflects the
 * new state immediately. Only the target order is touched.
 */
export function applyCancelledStatus<T extends { id: string; status: string }>(
  orders: readonly T[],
  orderId: string,
): T[] {
  return orders.map((order) =>
    order.id === orderId ? { ...order, status: ORDER_CANCELLATION_STATUS } : order,
  );
}
