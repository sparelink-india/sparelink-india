/**
 * Propagate a terminal PARENT order status to its FIRM ORDER allocations.
 *
 * Why this exists
 * ---------------
 * `PATCH /api/admin/orders` cancels the parent `order` row and restores
 * inventory, but it never touched `firm_order`. That left allocations in
 * `fulfillment_status = 'pending'` for orders that were already `cancelled`,
 * so the Admin Allocations screen and the allocation Excel export reported
 * them as open work, and the allocation-level payment guard
 * (`canAcceptPaymentForAllocationStatus`) had nothing to act on.
 *
 * This is a propagation OMISSION, not a missing feature. The value
 * `'cancelled'` is already in the allocations API allow-list, already has
 * terminal semantics ("Cancelled allocations cannot be reopened."), and is
 * already rendered and exported. Nothing new is invented here.
 *
 * Deliberate asymmetry with restocking
 * ------------------------------------
 * `shouldRestockOnStatusChange` refuses to restock `shipped` / `delivered`
 * because the goods have left the warehouse. Closing the ALLOCATION is a
 * different act: an allocation for shipped goods is still open work, and if
 * the order is cancelled the allocation must close too, otherwise goods in
 * transit keep an open allocation and a payable amount. So allocations close
 * for every transition INTO a terminal status, including out of `shipped`.
 *
 * The admin UI gate is unchanged: `isOrderCancellationAllowed` still requires
 * `CANCEL_RESTOCKABLE_STATUSES`, so a shipped order is still not cancellable
 * from the dashboard. This only makes the backend consistent when a shipped
 * order IS cancelled through an authorized admin API call.
 */

import { and, eq, ne } from "drizzle-orm";

import { firmOrder } from "@/drizzle/schema";

/** Allocation status written when the parent order is cancelled. */
export const ALLOCATION_STATUS_CANCELLED = "cancelled";

/** Allocation status written when the parent order is returned. */
export const ALLOCATION_STATUS_RETURNED = "returned";

/**
 * Terminal parent order status -> terminal allocation status.
 *
 * Both values already exist in the current status model: `'cancelled'` is in
 * the allocations API allow-list, and `'returned'` is already recognised as
 * non-payable by `canAcceptPaymentForAllocationStatus` and by the manual
 * bank-transfer payment guard. Neither value is invented here.
 */
const TERMINAL_ALLOCATION_STATUS_BY_ORDER_STATUS: Readonly<
  Record<string, string>
> = Object.freeze({
  cancelled: ALLOCATION_STATUS_CANCELLED,
  returned: ALLOCATION_STATUS_RETURNED,
});

/** Parent order statuses that must never be reopened by a transition. */
const TERMINAL_ORDER_STATUSES: ReadonlySet<string> = new Set([
  ALLOCATION_STATUS_CANCELLED,
  "completed",
  ALLOCATION_STATUS_RETURNED,
]);

/**
 * The allocation status a parent order status maps to, or `null` when the
 * parent status is not terminal for allocations.
 */
export function allocationTerminalStatusForOrderStatus(
  status: string | null | undefined,
): string | null {
  const value = (status ?? "").trim().toLowerCase();
  return TERMINAL_ALLOCATION_STATUS_BY_ORDER_STATUS[value] ?? null;
}

/**
 * Whether a status change should close this order's allocations.
 *
 * True only for a genuine transition INTO a terminal allocation status.
 * A no-op re-cancel (`cancelled` -> `cancelled`) returns false so an already
 * cancelled allocation is never needlessly rewritten.
 */
export function shouldCloseAllocationsOnStatusChange(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  const target = allocationTerminalStatusForOrderStatus(nextStatus);
  if (!target) return false;

  const previous = (previousStatus ?? "").trim().toLowerCase();
  // Already in the target state: nothing to do, do not rewrite the row.
  if (previous === target) return false;
  // A terminal order is never reopened, and `canTransitionOrderStatus`
  // already blocks this. Guarded here so the helper is safe standalone.
  if (TERMINAL_ORDER_STATUSES.has(previous)) return false;
  return true;
}

export type CloseAllocationsResult = {
  /** Allocations actually written to the terminal status. */
  closedAllocations: number;
  /** The allocation status written, or null when nothing was written. */
  allocationStatus: string | null;
};

/**
 * Close every allocation of `orderId` at `allocationStatus`.
 *
 * Concurrency: the `ne(fulfillmentStatus, target)` guard means only the first
 * writer actually changes a row, so a retried or duplicated cancellation
 * reports 0 and cannot rewrite an already-terminal allocation.
 *
 * `paymentStatus` is deliberately never touched. Payment state may only change
 * through the verified payment or manual bank-transfer workflows.
 */
export async function closeOrderAllocations(
  // Transaction or db handle from drizzle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx: any,
  orderId: string,
  allocationStatus: string,
): Promise<CloseAllocationsResult> {
  if (!orderId || !allocationStatus) {
    return { closedAllocations: 0, allocationStatus: null };
  }

  const closed = await dbOrTx
    .update(firmOrder)
    .set({ fulfillmentStatus: allocationStatus, updatedAt: new Date() })
    .where(
      and(
        eq(firmOrder.orderId, orderId),
        ne(firmOrder.fulfillmentStatus, allocationStatus),
      ),
    )
    .returning({ id: firmOrder.id });

  return {
    closedAllocations: closed.length,
    allocationStatus: closed.length > 0 ? allocationStatus : null,
  };
}
