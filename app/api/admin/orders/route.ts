import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { count, desc, eq, inArray } from "drizzle-orm";
import { firm, firmOrder, order, orderItem, user } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";

const ALLOWED_STATUSES = new Set([
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "placed",
]);

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

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

    const orderIds = ordersData.map((o) => o.id);
    const itemCounts = orderIds.length
      ? await db
          .select({
            orderId: orderItem.orderId,
            count: count(),
          })
          .from(orderItem)
          .where(inArray(orderItem.orderId, orderIds))
          .groupBy(orderItem.orderId)
      : [];
    const allocations = orderIds.length
      ? await db
          .select({
            orderId: firmOrder.orderId,
            id: firmOrder.id,
            firmId: firmOrder.firmId,
            firmName: firm.name,
            allocationNumber: firmOrder.allocationNumber,
            subtotalPaise: firmOrder.subtotalPaise,
            gstPaise: firmOrder.gstPaise,
            totalPaise: firmOrder.amountPaise,
            fulfillmentStatus: firmOrder.fulfillmentStatus,
            paymentStatus: firmOrder.paymentStatus,
            paymentMethod: firmOrder.paymentMethod,
            invoiceReference: firmOrder.invoiceReference,
          })
          .from(firmOrder)
          .innerJoin(firm, eq(firmOrder.firmId, firm.id))
          .where(inArray(firmOrder.orderId, orderIds))
      : [];
    const countByOrder = new Map(
      itemCounts.map((row) => [row.orderId, row.count]),
    );
    const orderWithCounts = ordersData.map((o) => ({
      ...o,
      itemCount: countByOrder.get(o.id) ?? 0,
      allocations: allocations.filter((row) => row.orderId === o.id),
    }));

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
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

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

  const db = getDb();
  const existing = await db.query.order.findFirst({
    where: eq(order.id, orderId),
  });

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updates: {
    status?: string;
    paymentStatus?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (status) updates.status = status;
  if (paymentStatus) updates.paymentStatus = paymentStatus;

  await db.update(order).set(updates).where(eq(order.id, orderId));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "order.status_update",
    entityType: "order",
    entityId: orderId,
    metadata: {
      previousStatus: existing.status,
      previousPaymentStatus: existing.paymentStatus,
      status,
      paymentStatus,
    },
  });

  return NextResponse.json({ success: true });
}
