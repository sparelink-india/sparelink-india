import { NextResponse } from "next/server";
import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { firm, firmOrder, order, orderItem, user } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  restockInventoryForCancelledOrder,
  shouldRestockOnStatusChange,
} from "@/lib/order-cancel-restock";
import {
  allocationTerminalStatusForOrderStatus,
  closeOrderAllocations,
  shouldCloseAllocationsOnStatusChange,
} from "@/lib/order-cancel-allocation";
import { canTransitionOrderStatus } from "@/lib/payment-security";

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

    const orderIds = ordersData.map((o) => o.id);
    const firmAllocations =
      orderIds.length === 0
        ? []
        : await db
            .select({
              orderId: firmOrder.orderId,
              firmOrderId: firmOrder.id,
              firmName: firm.name,
              firmCode: firm.code,
              amountPaise: firmOrder.amountPaise,
            })
            .from(firmOrder)
            .innerJoin(firm, eq(firmOrder.firmId, firm.id))
            .where(inArray(firmOrder.orderId, orderIds));

    const allocationsByOrder = new Map<string, typeof firmAllocations>();
    for (const row of firmAllocations) {
      const list = allocationsByOrder.get(row.orderId) ?? [];
      list.push(row);
      allocationsByOrder.set(row.orderId, list);
    }

    const orderWithCounts = await Promise.all(
      ordersData.map(async (o) => {
        const itemResult = await db
          .select({ count: count() })
          .from(orderItem)
          .where(eq(orderItem.orderId, o.id));
        return {
          ...o,
          itemCount: itemResult[0]?.count ?? 0,
          firmAllocations: (allocationsByOrder.get(o.id) ?? []).map((row) => ({
            firmOrderId: row.firmOrderId,
            firmName: row.firmName,
            firmCode: row.firmCode,
            amountPaise: row.amountPaise,
          })),
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
  if (paymentStatus) {
    return NextResponse.json(
      {
        error:
          "Payment status must be changed through the verified payment or manual bank-transfer workflow.",
      },
      { status: 400 },
    );
  }
  if (status && !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
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
  let creditedUnits = 0;
  let indeterminateLines = 0;
  let previousStatus = "";
  let previousPaymentStatus = "";
  let didRestock = false;
  let closedAllocations = 0;
  let allocationStatus: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const locked = await tx
        .select({
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
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
      if (
        status &&
        !canTransitionOrderStatus(existing.status, status)
      ) {
        throw new Error("INVALID_STATUS_TRANSITION");
      }
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

        const result = await restockInventoryForCancelledOrder(
          tx,
          orderId,
          existing.createdAt,
        );
        restockedLines = result.restockedLines;
        creditedUnits = result.creditedUnits;
        indeterminateLines = result.indeterminateLines;

        // Close the allocations in the SAME transaction, so a cancelled order
        // can never be left with an open `pending` firm allocation.
        const allocation = await closeOrderAllocations(
          tx,
          orderId,
          allocationTerminalStatusForOrderStatus(status) ?? "cancelled",
        );
        closedAllocations = allocation.closedAllocations;
        allocationStatus = allocation.allocationStatus;
        return;
      }

      await tx.update(order).set(updates).where(eq(order.id, orderId));

      // `returned` (and any other terminal allocation status) does not restock
      // — the goods are physically coming back — but the allocation must still
      // close so it stops being reported and paid as open work.
      if (shouldCloseAllocationsOnStatusChange(existing.status, status)) {
        const allocation = await closeOrderAllocations(
          tx,
          orderId,
          allocationTerminalStatusForOrderStatus(status) as string,
        );
        closedAllocations = allocation.closedAllocations;
        allocationStatus = allocation.allocationStatus;
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_STATUS_TRANSITION") {
      return NextResponse.json(
        { error: "This order cannot move to the requested status." },
        { status: 409 },
      );
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
      // Added for allocation propagation. Existing fields above are unchanged.
      creditedUnits: didRestock ? creditedUnits : 0,
      indeterminateRestockLines: didRestock ? indeterminateLines : 0,
      closedAllocations,
      allocationStatus,
    },
  });

  return NextResponse.json({
    success: true,
    restockedLines: didRestock ? restockedLines : 0,
    creditedUnits: didRestock ? creditedUnits : 0,
    indeterminateRestockLines: didRestock ? indeterminateLines : 0,
    closedAllocations,
    allocationStatus,
  });
}
