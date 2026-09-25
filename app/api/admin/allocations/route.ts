import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { count, desc, eq } from "drizzle-orm";
import { firm, firmOrder, firmOrderItem, order } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";

// Mirrors the parent order status model. `cancelled` and `returned` are both
// already treated as terminal/non-payable by `canAcceptPaymentForAllocationStatus`
// and by the manual bank-transfer guard, and `returned` can now be written
// automatically when a parent order transitions to `returned`.
const ALLOWED_STATUSES = new Set([
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

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

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const firmOrderId =
    typeof body.firmOrderId === "string" ? body.firmOrderId.trim() : "";
  const fulfillmentStatus =
    typeof body.fulfillmentStatus === "string"
      ? body.fulfillmentStatus.trim()
      : "";

  if (!firmOrderId) {
    return NextResponse.json(
      { error: "firmOrderId is required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_STATUSES.has(fulfillmentStatus)) {
    return NextResponse.json(
      { error: "Invalid fulfillmentStatus" },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db.query.firmOrder.findFirst({
    where: eq(firmOrder.id, firmOrderId),
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Allocation not found" },
      { status: 404 },
    );
  }

  // Terminal allocations are never reopened, matching the payment guards that
  // treat both `cancelled` and `returned` as non-payable.
  const TERMINAL_FULFILLMENT_STATUSES = new Set(["cancelled", "returned"]);
  if (
    TERMINAL_FULFILLMENT_STATUSES.has(existing.fulfillmentStatus) &&
    fulfillmentStatus !== existing.fulfillmentStatus
  ) {
    return NextResponse.json(
      {
        error: `${existing.fulfillmentStatus === "cancelled" ? "Cancelled" : "Returned"} allocations cannot be reopened.`,
      },
      { status: 409 },
    );
  }

  await db
    .update(firmOrder)
    .set({
      fulfillmentStatus,
      updatedAt: new Date(),
    })
    .where(eq(firmOrder.id, firmOrderId));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "allocation.status_update",
    entityType: "firm_order",
    entityId: firmOrderId,
    metadata: {
      previousStatus: existing.fulfillmentStatus,
      fulfillmentStatus,
    },
  });

  return NextResponse.json({ success: true, fulfillmentStatus });
}
