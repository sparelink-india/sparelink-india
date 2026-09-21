import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { purchaseOrder, purchaseOrderItem, supplier } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

const PATCH_STATUSES = new Set(["draft", "submitted", "cancelled", "received"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const db = getDb();
  const header = await db.query.purchaseOrder.findFirst({
    where: eq(purchaseOrder.id, id),
  });
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const supplierRow = await db.query.supplier.findFirst({
    where: eq(supplier.id, header.supplierId),
  });
  const items = await db
    .select()
    .from(purchaseOrderItem)
    .where(eq(purchaseOrderItem.purchaseOrderId, id));
  return NextResponse.json({
    purchaseOrder: header,
    supplier: supplierRow,
    items,
  });
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
      { error: "status must be draft|submitted|cancelled|received" },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db.query.purchaseOrder.findFirst({
    where: eq(purchaseOrder.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Status only — never increase stock on received.
  await db
    .update(purchaseOrder)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, id));

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "purchase_order.status_update",
    entityType: "purchase_order",
    entityId: id,
    metadata: { previous: existing.status, status, stockChanged: false },
  });

  return NextResponse.json({ id, status });
}
