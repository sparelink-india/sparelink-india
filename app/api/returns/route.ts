import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { order, orderItem, returnRequest } from "@/drizzle/schema";
import { generateTicketNumber, writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { denyIfMustChangePassword } from "@/lib/require-role";

const REQUEST_TYPES = new Set(["return", "replacement"]);
const REASONS = new Set(["wrong_part", "damaged", "missing", "other"]);
const ADMIN_STATUSES = new Set([
  "submitted",
  "approved",
  "rejected",
  "received",
  "closed",
]);

const BUYER_RETURN_COLUMNS = {
  id: returnRequest.id,
  requestNumber: returnRequest.requestNumber,
  orderId: returnRequest.orderId,
  orderItemId: returnRequest.orderItemId,
  requestType: returnRequest.requestType,
  reason: returnRequest.reason,
  description: returnRequest.description,
  status: returnRequest.status,
  resolutionNote: returnRequest.resolutionNote,
  createdAt: returnRequest.createdAt,
  updatedAt: returnRequest.updatedAt,
  resolvedAt: returnRequest.resolvedAt,
};

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const db = getDb();
  const isAdmin = session.user.role === "admin";

  try {
    const rows = isAdmin
      ? await db
          .select()
          .from(returnRequest)
          .orderBy(desc(returnRequest.createdAt))
      : await db
          .select(BUYER_RETURN_COLUMNS)
          .from(returnRequest)
          .where(eq(returnRequest.buyerId, session.user.id))
          .orderBy(desc(returnRequest.createdAt));

    return NextResponse.json({ returns: rows });
  } catch (error) {
    console.error("Returns fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load return requests" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const requestType =
    typeof body.requestType === "string" ? body.requestType.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const orderItemId =
    typeof body.orderItemId === "string" ? body.orderItemId.trim() || null : null;
  const description =
    typeof body.description === "string"
      ? body.description.trim() || null
      : null;

  if (!REQUEST_TYPES.has(requestType)) {
    return NextResponse.json(
      { error: "requestType must be return or replacement" },
      { status: 400 },
    );
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json(
      { error: "Invalid reason" },
      { status: 400 },
    );
  }
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  const db = getDb();
  const buyerOrder = await db.query.order.findFirst({
    where: eq(order.id, orderId),
  });

  if (!buyerOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (
    session.user.role !== "admin" &&
    buyerOrder.buyerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (orderItemId) {
    const line = await db.query.orderItem.findFirst({
      where: and(eq(orderItem.id, orderItemId), eq(orderItem.orderId, orderId)),
      columns: { id: true },
    });
    if (!line) {
      return NextResponse.json(
        { error: "orderItemId does not belong to this order" },
        { status: 400 },
      );
    }
  }

  const id = randomUUID();
  const requestNumber = generateTicketNumber("RET");

  await db.insert(returnRequest).values({
    id,
    requestNumber,
    orderId,
    orderItemId,
    buyerId: buyerOrder.buyerId,
    requestType,
    reason,
    description,
    status: "submitted",
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "return.create",
    entityType: "return_request",
    entityId: id,
    metadata: { requestNumber, orderId, requestType, reason },
  });

  return NextResponse.json(
    { success: true, id, requestNumber },
    { status: 201 },
  );
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

  const returnId =
    typeof body.returnId === "string" ? body.returnId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const adminNote =
    typeof body.adminNote === "string" ? body.adminNote.trim() || null : null;
  const resolutionNote =
    typeof body.resolutionNote === "string"
      ? body.resolutionNote.trim() || null
      : null;

  if (!returnId) {
    return NextResponse.json({ error: "returnId is required" }, { status: 400 });
  }
  if (!ADMIN_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.query.returnRequest.findFirst({
    where: eq(returnRequest.id, returnId),
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Return request not found" },
      { status: 404 },
    );
  }

  const resolved =
    status === "approved" ||
    status === "rejected" ||
    status === "closed" ||
    status === "received";

  await db
    .update(returnRequest)
    .set({
      status,
      adminNote: adminNote ?? existing.adminNote,
      resolutionNote: resolutionNote ?? existing.resolutionNote,
      resolvedAt: resolved ? new Date() : existing.resolvedAt,
      resolvedBy: resolved ? session.user.id : existing.resolvedBy,
      updatedAt: new Date(),
    })
    .where(eq(returnRequest.id, returnId));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "return.status_update",
    entityType: "return_request",
    entityId: returnId,
    metadata: {
      previousStatus: existing.status,
      status,
    },
  });

  return NextResponse.json({ success: true });
}
