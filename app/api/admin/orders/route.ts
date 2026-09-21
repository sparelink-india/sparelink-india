import { NextResponse } from "next/server";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { order, orderItem, user } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  restockInventoryForCancelledOrder,
  shouldRestockOnStatusChange,
} from "@/lib/order-cancel-restock";
import { canMutateOrderPaymentStatus } from "@/lib/order-architecture";

const ALLOWED_STATUSES = new Set([
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
]);

const ALLOWED_PAYMENT_STATUSES = new Set([
  "pending",
  "paid",
  "failed",
  "unpaid",
]);

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
        paymentMethod: order.paymentMethod,
        totalPaise: order.totalPaise,
        createdAt: order.createdAt,
      })
      .from(order)
      .innerJoin(user, eq(order.buyerId, user.id))
      .orderBy(desc(order.createdAt));

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

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const status =
    typeof body.status === "string" ? body.status.trim() : undefined;
  const paymentStatus =
    typeof body.paymentStatus === "string"
      ? body.paymentStatus.trim()
      : undefined;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }
  if (!status && !paymentStatus) {
    return NextResponse.json(
      { error: "status or paymentStatus is required" },
      { status: 400 },
    );
  }
  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (paymentStatus) {
    if (!canMutateOrderPaymentStatus(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) {
      return NextResponse.json(
        { error: "Invalid payment status" },
        { status: 400 },
      );
    }
  }

  const db = getDb();

  const updates: {
    status?: string;
    paymentStatus?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (status) updates.status = status;
  if (paymentStatus) updates.paymentStatus = paymentStatus;

  let restockedLines = 0;
  let previousStatus = "";
  let previousPaymentStatus = "";
  let didRestock = false;

  try {
    await db.transaction(async (tx) => {
      const locked = await tx
        .select({
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        })
        .from(order)
        .where(eq(order.id, orderId))
        .for("update");

      const existing = locked[0];
      if (!existing) {
        throw new Error("ORDER_NOT_FOUND");
      }

      previousStatus = existing.status;
      previousPaymentStatus = existing.paymentStatus;
      const doRestock = shouldRestockOnStatusChange(existing.status, status);
      didRestock = doRestock;

      if (status === "cancelled" && doRestock) {
        // Conditional update: only the first cancel wins restock under concurrency.
        const cancelled = await tx
          .update(order)
          .set(updates)
          .where(
            and(
              eq(order.id, orderId),
              ne(order.status, "cancelled"),
              sql`${order.status} IN ('placed','pending','confirmed','processing','packed')`,
            ),
          )
          .returning({ id: order.id });

        if (!cancelled.length) {
          // Already cancelled or not restockable — still apply non-restock updates if needed.
          await tx.update(order).set(updates).where(eq(order.id, orderId));
          didRestock = false;
          return;
        }

        const result = await restockInventoryForCancelledOrder(tx, orderId);
        restockedLines = result.restockedLines;
        return;
      }

      await tx.update(order).set(updates).where(eq(order.id, orderId));
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "order.status_update",
    entityType: "order",
    entityId: orderId,
    metadata: {
      previousStatus,
      previousPaymentStatus,
      status,
      paymentStatus,
      restockedLines: didRestock ? restockedLines : 0,
    },
  });

  return NextResponse.json({ success: true, restockedLines: didRestock ? restockedLines : 0 });
}
