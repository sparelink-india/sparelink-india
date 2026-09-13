import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { order, user, orderItem } from "@/drizzle/schema";
import { desc, eq, count, sql } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const ordersData = await db
      .select({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerEmail: user.email,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalPaise: order.totalPaise,
        createdAt: order.createdAt,
      })
      .from(order)
      .innerJoin(user, eq(order.buyerId, user.id))
      .orderBy(desc(order.createdAt));

    // Get item count for each order
    const orderWithCounts = await Promise.all(
      ordersData.map(async (o) => {
        const itemResult = await db
          .select({ count: count() })
          .from(orderItem)
          .where(eq(orderItem.orderId, o.id));
        return {
          ...o,
          itemCount: itemResult[0]?.count ?? 0,
        };
      }),
    );

    return NextResponse.json({ orders: orderWithCounts });
  } catch (error) {
    console.error("Orders fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 },
    );
  }
}
