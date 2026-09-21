import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { salesOrder, salesOrderItem } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

const PATCH_STATUSES = new Set(["draft", "submitted", "cancelled"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const db = getDb();
  const header = await db.query.salesOrder.findFirst({
    where: eq(salesOrder.id, id),
  });
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = await db
    .select()
    .from(salesOrderItem)
    .where(eq(salesOrderItem.salesOrderId, id));
  return NextResponse.json({ salesOrder: header, items });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status =
    body && typeof body.status === "string" ? body.status.trim() : "";
  if (!PATCH_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "status must be draft|submitted|cancelled" },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db.query.salesOrder.findFirst({
    where: eq(salesOrder.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(salesOrder)
    .set({ status, updatedAt: new Date() })
    .where(eq(salesOrder.id, id));

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "sales_order.status_update",
    entityType: "sales_order",
    entityId: id,
    metadata: { previous: existing.status, status },
  });

  return NextResponse.json({ id, status });
}
