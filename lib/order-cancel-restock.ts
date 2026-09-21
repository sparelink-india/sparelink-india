import { eq, sql } from "drizzle-orm";

import { inventory, orderItem } from "@/drizzle/schema";

/**
 * Restore MAIN warehouse stock for all items on a cancelled parent order.
 * Call only when transitioning INTO cancelled (see shouldRestockOnStatusChange).
 */
export async function restockInventoryForCancelledOrder(
  // Transaction or db handle from drizzle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx: any,
  orderId: string,
): Promise<{ restockedLines: number }> {
  const items = await dbOrTx
    .select({
      dealerListingId: orderItem.dealerListingId,
      quantity: orderItem.quantity,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));

  let restockedLines = 0;
  for (const item of items as Array<{
    dealerListingId: string | null;
    quantity: number;
  }>) {
    if (!item.dealerListingId || item.quantity < 1) continue;
    const updated = await dbOrTx
      .update(inventory)
      .set({
        quantity: sql`${inventory.quantity} + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.dealerListingId, item.dealerListingId))
      .returning({ id: inventory.id });
    if (updated.length) restockedLines += 1;
  }

  return { restockedLines };
}

export function shouldRestockOnStatusChange(
  previousStatus: string,
  nextStatus: string | undefined,
): boolean {
  if (!nextStatus || nextStatus !== "cancelled") return false;
  if (previousStatus === "cancelled" || previousStatus === "returned") {
    return false;
  }
  return true;
}
