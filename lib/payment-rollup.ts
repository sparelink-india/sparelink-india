import { eq } from "drizzle-orm";

import { firmOrder, order } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

export type ParentPaymentStatus = "pending" | "partial" | "paid";

type DbClient = ReturnType<typeof getDb>;
export type PaymentRollupExecutor =
  | DbClient
  | Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const PAID_ALLOCATION_STATUS = "paid";
const COD_PAYMENT_METHOD = "cash_on_delivery";

/**
 * Derive parent order.payment_status from firm_order.payment_status values.
 * Only "paid" counts as paid. failed / expired / user_dropped / pending / unpaid do not.
 */
export function deriveParentPaymentStatus(
  firmOrderPaymentStatuses: readonly string[],
): ParentPaymentStatus {
  if (firmOrderPaymentStatuses.length === 0) {
    return "pending";
  }

  const paidCount = firmOrderPaymentStatuses.filter(
    (status) => status === PAID_ALLOCATION_STATUS,
  ).length;

  if (paidCount === firmOrderPaymentStatuses.length) {
    return "paid";
  }

  if (paidCount > 0) {
    return "partial";
  }

  return "pending";
}

/**
 * Lock the parent order, read ALL firm_orders from the database, and write
 * the derived payment_status onto that parent only.
 *
 * COD orders keep an independent parent payment_status and are not rewritten.
 */
export async function syncParentOrderPaymentStatus(
  executor: PaymentRollupExecutor,
  orderId: string,
): Promise<ParentPaymentStatus> {
  const parentRows = await executor
    .select({
      id: order.id,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .for("update");

  const parent = parentRows[0];
  if (!parent) {
    return "pending";
  }

  if (parent.paymentMethod === COD_PAYMENT_METHOD) {
    return normalizeParentPaymentStatus(parent.paymentStatus);
  }

  const allocations = await executor
    .select({ paymentStatus: firmOrder.paymentStatus })
    .from(firmOrder)
    .where(eq(firmOrder.orderId, orderId));

  const nextStatus = deriveParentPaymentStatus(
    allocations.map((row) => row.paymentStatus),
  );

  await executor
    .update(order)
    .set({
      paymentStatus: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(order.id, orderId));

  return nextStatus;
}

function normalizeParentPaymentStatus(value: string): ParentPaymentStatus {
  if (value === "paid" || value === "partial" || value === "pending") {
    return value;
  }
  return "pending";
}
