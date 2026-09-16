import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { order, returnRequest } from "@/drizzle/schema";
import { generateTicketNumber, writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";

const REQUEST_TYPES = new Set(["return", "replacement"]);
const REASONS = new Set(["wrong_part", "damaged", "missing", "other"]);

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const isAdmin = session.user.role === "admin";

  try {
    const rows = isAdmin
      ? await db
          .select()
          .from(returnRequest)
          .orderBy(desc(returnRequest.createdAt))
      : await db
          .select()
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
