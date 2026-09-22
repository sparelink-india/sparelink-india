import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";

import { order, orderItem } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to track an order." }, { status: 401 });
  }
  if (session.user.role !== "buyer") {
    return NextResponse.json(
      { error: "Order tracking is available for customer accounts." },
      { status: 403 },
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ order: null });
  }

  const db = getDb();
  const match = await db.query.order.findFirst({
    where: and(
      eq(order.buyerId, session.user.id),
      or(eq(order.orderNumber, q), eq(order.id, q)),
    ),
  });

  if (!match) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const items = await db
    .select({
      id: orderItem.id,
      partName: orderItem.partName,
      partNumber: orderItem.partNumber,
      quantity: orderItem.quantity,
      totalPaise: orderItem.totalPaise,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, match.id));

  return NextResponse.json({
    order: {
      id: match.id,
      orderNumber: match.orderNumber,
      status: match.status,
      paymentStatus: match.paymentStatus,
      totalPaise: match.totalPaise,
      createdAt: match.createdAt,
      items,
    },
  });
}
