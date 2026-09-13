import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { firmOrder, order, firm, firmOrderItem } from "@/drizzle/schema";
import { desc, eq, count } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const allocationsData = await db
      .select({
        id: firmOrder.id,
        orderNumber: order.orderNumber,
        firmName: firm.name,
        allocationNumber: firmOrder.allocationNumber,
        amountPaise: firmOrder.amountPaise,
        fulfillmentStatus: firmOrder.fulfillmentStatus,
        createdAt: firmOrder.createdAt,
      })
      .from(firmOrder)
      .innerJoin(order, eq(firmOrder.orderId, order.id))
      .innerJoin(firm, eq(firmOrder.firmId, firm.id))
      .orderBy(desc(firmOrder.createdAt));

    // Get item count for each allocation
    const allocationsWithCounts = await Promise.all(
      allocationsData.map(async (a) => {
        const itemResult = await db
          .select({ count: count() })
          .from(firmOrderItem)
          .where(eq(firmOrderItem.firmOrderId, a.id));
        return {
          ...a,
          itemCount: itemResult[0]?.count ?? 0,
        };
      }),
    );

    return NextResponse.json({ allocations: allocationsWithCounts });
  } catch (error) {
    console.error("Allocations fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load allocations" },
      { status: 500 },
    );
  }
}
