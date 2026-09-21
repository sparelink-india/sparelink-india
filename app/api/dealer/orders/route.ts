import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
  dealer,
  order,
  orderItem,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { requireDealerApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireDealerApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const profile = await db.query.dealer.findFirst({
    where: eq(dealer.userId, access.session.user.id),
  });
  if (!profile) {
    return NextResponse.json({ error: "Dealer profile not found" }, { status: 404 });
  }

  const lines = await db
    .select({
      orderItemId: orderItem.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      partNumber: orderItem.partNumber,
      partName: orderItem.partName,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      totalPaise: orderItem.totalPaise,
      createdAt: order.createdAt,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(eq(orderItem.dealerId, profile.id))
    .orderBy(desc(order.createdAt))
    .limit(200);

  return NextResponse.json({ orders: lines });
}
