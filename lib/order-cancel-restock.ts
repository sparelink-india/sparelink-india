/**
 * Restore MAIN warehouse stock for all items on a cancelled parent order.
 * Call only when transitioning INTO cancelled (see shouldRestockOnStatusChange).
 *
 * Why this reconciles instead of adding blindly
 * ----------------------------------------------
 * The previous implementation ran `quantity = quantity + orderedQuantity`.
 * That silently assumed the current quantity already excluded this order's
 * units, i.e. it assumed NO administrator had touched the listing between
 * checkout and cancellation.
 *
 * That assumption is false in production. Checkout decrements stock with no
 * durable record, and `PATCH /api/admin/inventory` sets an ABSOLUTE quantity
 * without consulting open order lines. So an admin who legitimately topped the
 * stock back up after checkout would be credited a second time by the
 * cancellation restock.
 *
 * Observed in production on `listing-amb-P10605`:
 *   checkout 10 -> 0, admin set 0 -> 10, cancel restock +10 -> 20 (expected 10).
 *
 * The fix is to reconcile against the recorded movement rather than guess:
 *
 *   - Checkout now writes a `stock_adjustment` (reason CHECKOUT) in the same
 *     transaction as the decrement, giving the exact post-checkout quantity.
 *   - On cancel we credit only the shortfall between that baseline and the
 *     current quantity, never more than the ordered quantity, never negative.
 *
 * Legacy orders (created before the CHECKOUT record existed) have no baseline.
 * For those we do NOT over-credit: if any other adjustment touched the listing
 * after the order was created, the correct credit is genuinely unknowable, so
 * we credit 0 and report the line as `indeterminate` for human review. If
 * nothing touched the listing, the current quantity IS provably the
 * post-checkout quantity, so crediting the full ordered quantity is correct.
 */

import { randomUUID } from "node:crypto";

import { and, asc, eq, gt } from "drizzle-orm";

import { inventory, orderItem, stockAdjustment } from "@/drizzle/schema";

/** Stable, machine-matchable reason for the checkout decrement record. */
export const CHECKOUT_STOCK_ADJUSTMENT_REASON = "CHECKOUT";

/** Stable, machine-matchable reason for a cancellation restock record. */
export const CANCEL_RESTOCK_STOCK_ADJUSTMENT_REASON = "CANCEL_RESTOCK";

/** `stock_adjustment.reference_type` used for both reasons. */
export const ORDER_STOCK_REFERENCE_TYPE = "order";

export type RestockReconciliationMode =
  /** A CHECKOUT record gave us an exact baseline. */
  | "recorded"
  /** No CHECKOUT record, and provably nothing else touched the listing. */
  | "unchanged_since_checkout"
  /** No CHECKOUT record and an unexplained adjustment: unknowable, credit 0. */
  | "indeterminate"
  /** Nothing to credit (non-positive quantity, or already fully credited). */
  | "no_credit";

export type RestockReconciliationInput = {
  /** Quantity on the order line. */
  orderedQuantity: number;
  /** Current `inventory.quantity` for the listing, read under a row lock. */
  currentQuantity: number;
  /**
   * `stock_adjustment.newQuantity` from this order's CHECKOUT record, i.e. the
   * quantity immediately after checkout removed the units. `null` for legacy
   * orders created before checkout tracking existed.
   */
  checkoutPostQuantity: number | null;
  /**
   * True when a stock adjustment other than this order's CHECKOUT record and
   * non-CANCEL_RESTOCK rows touched the listing after the order was created.
   */
  hasInterveningAdjustment: boolean;
};

export type RestockReconciliation = {
  /** Units to actually credit back. Always 0..orderedQuantity. */
  credit: number;
  mode: RestockReconciliationMode;
  /** Human-readable explanation, written into the audit trail. */
  reason: string;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * Pure reconciliation decision. Exported so the exact production scenario can
 * be pinned by tests without a database.
 */
export function computeRestockCredit(
  input: RestockReconciliationInput,
): RestockReconciliation {
  const ordered = Math.trunc(input.orderedQuantity ?? 0);
  if (ordered < 1) {
    return { credit: 0, mode: "no_credit", reason: "Order line quantity is not positive." };
  }

  const current = Math.trunc(input.currentQuantity ?? 0);

  // Preferred path: we know exactly what checkout left behind.
  if (input.checkoutPostQuantity !== null && input.checkoutPostQuantity !== undefined) {
    const baseline = Math.trunc(input.checkoutPostQuantity);
    // Stock level this order should return to if its units come back.
    const target = baseline + ordered;
    const credit = clamp(target - current, 0, ordered);
    if (credit === 0) {
      return {
        credit: 0,
        mode: "no_credit",
        reason: `Stock already at or above the expected post-cancel level (${current} >= ${target}); no credit needed.`,
      };
    }
    return {
      credit,
      mode: "recorded",
      reason: `Reconciled against the recorded checkout movement: expected ${target} (checkout left ${baseline} + ordered ${ordered}), current ${current}.`,
    };
  }

  // Legacy order: no checkout record. Never over-credit on a guess.
  if (input.hasInterveningAdjustment) {
    return {
      credit: 0,
      mode: "indeterminate",
      reason:
        "No checkout stock record exists for this legacy order and the listing was adjusted afterwards, so the correct restock cannot be determined. Credited 0; needs manual review.",
    };
  }

  // No checkout record and provably nothing else touched the listing, so the
  // current quantity IS the post-checkout quantity. Full credit is correct.
  return {
    credit: ordered,
    mode: "unchanged_since_checkout",
    reason: `Legacy order with no checkout record, but no adjustment touched the listing afterwards; current ${current} is the post-checkout quantity.`,
  };
}

export type RestockInventoryResult = {
  /** Lines that actually received a credit. Same meaning as before. */
  restockedLines: number;
  /** Total units credited back across all lines. */
  creditedUnits: number;
  /**
   * Lines where the credit was unknowable and 0 was credited. Non-zero means a
   * human must review these lines; it is never silently "fixed".
   */
  indeterminateLines: number;
};

/**
 * Restore MAIN warehouse stock for all items on a cancelled parent order.
 * Call only when transitioning INTO cancelled (see shouldRestockOnStatusChange).
 *
 * Runs inside the caller's transaction so the parent status change, the
 * allocation closure and the inventory movement commit or roll back together.
 */
export async function restockInventoryForCancelledOrder(
  // Transaction or db handle from drizzle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx: any,
  orderId: string,
  /** `order.created_at`, used to detect adjustments made after checkout. */
  orderCreatedAt: Date,
): Promise<RestockInventoryResult> {
  const items = (await dbOrTx
    .select({
      dealerListingId: orderItem.dealerListingId,
      quantity: orderItem.quantity,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))) as Array<{
    dealerListingId: string | null;
    quantity: number;
  }>;

  let restockedLines = 0;
  let creditedUnits = 0;
  let indeterminateLines = 0;

  for (const item of items) {
    if (!item.dealerListingId || item.quantity < 1) continue;

    // Lock the inventory row so two concurrent cancellations touching the same
    // listing serialise here instead of both reading the same quantity.
    const inventoryRows = await dbOrTx
      .select({
        id: inventory.id,
        quantity: inventory.quantity,
        warehouseCode: inventory.warehouseCode,
      })
      .from(inventory)
      .where(eq(inventory.dealerListingId, item.dealerListingId))
      .for("update");

    const inventoryRow = inventoryRows[0];
    if (!inventoryRow) continue;

    // Everything that moved this listing after the order was created.
    const adjustments = (await dbOrTx
      .select({
        reason: stockAdjustment.reason,
        referenceType: stockAdjustment.referenceType,
        referenceId: stockAdjustment.referenceId,
        newQuantity: stockAdjustment.newQuantity,
      })
      .from(stockAdjustment)
      .where(
        and(
          eq(stockAdjustment.dealerListingId, item.dealerListingId),
          gt(stockAdjustment.createdAt, orderCreatedAt),
        ),
      )
      .orderBy(asc(stockAdjustment.createdAt))) as Array<{
      reason: string;
      referenceType: string | null;
      referenceId: string | null;
      newQuantity: number;
    }>;

    const isOwnCheckout = (row: (typeof adjustments)[number]) =>
      row.reason === CHECKOUT_STOCK_ADJUSTMENT_REASON &&
      row.referenceType === ORDER_STOCK_REFERENCE_TYPE &&
      row.referenceId === orderId;

    const checkoutRows = adjustments.filter(isOwnCheckout);
    const checkoutPostQuantity =
      checkoutRows.length > 0
        ? checkoutRows[checkoutRows.length - 1].newQuantity
        : null;

    const hasInterveningAdjustment = adjustments.some(
      (row) => !isOwnCheckout(row) && row.reason !== CANCEL_RESTOCK_STOCK_ADJUSTMENT_REASON,
    );

    const decision = computeRestockCredit({
      orderedQuantity: item.quantity,
      currentQuantity: inventoryRow.quantity,
      checkoutPostQuantity,
      hasInterveningAdjustment,
    });

    if (decision.credit < 1) {
      if (decision.mode === "indeterminate") indeterminateLines += 1;
      continue;
    }

    const previousQuantity = inventoryRow.quantity;
    const newQuantity = previousQuantity + decision.credit;

    await dbOrTx
      .update(inventory)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(inventory.id, inventoryRow.id));

    // Record the movement so the restock itself is auditable and detectable on
    // a retry, rather than being an invisible quantity increase.
    await dbOrTx.insert(stockAdjustment).values({
      id: randomUUID(),
      inventoryId: inventoryRow.id,
      dealerListingId: item.dealerListingId,
      previousQuantity,
      newQuantity,
      delta: decision.credit,
      reason: CANCEL_RESTOCK_STOCK_ADJUSTMENT_REASON,
      warehouseCode: inventoryRow.warehouseCode || "MAIN",
      referenceType: ORDER_STOCK_REFERENCE_TYPE,
      referenceId: orderId,
    });

    restockedLines += 1;
    creditedUnits += decision.credit;
  }

  return { restockedLines, creditedUnits, indeterminateLines };
}

/** Statuses where inventory is still considered held / not yet shipped. */
export const CANCEL_RESTOCKABLE_STATUSES = new Set([
  "placed",
  "pending",
  "confirmed",
  "processing",
  "packed",
]);

/**
 * Restock only on first transition into cancelled from a pre-ship status.
 * Shipped / delivered / completed / returned never auto-restock.
 */
export function shouldRestockOnStatusChange(
  previousStatus: string,
  nextStatus: string | undefined,
): boolean {
  if (!nextStatus || nextStatus !== "cancelled") return false;
  if (previousStatus === "cancelled" || previousStatus === "returned") {
    return false;
  }
  return CANCEL_RESTOCKABLE_STATUSES.has(previousStatus);
}
