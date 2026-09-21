import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { order, orderItem, warrantyClaim } from "@/drizzle/schema";
import { generateTicketNumber, writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { denyIfMustChangePassword } from "@/lib/require-role";

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
          .from(warrantyClaim)
          .orderBy(desc(warrantyClaim.createdAt))
      : await db
          .select({
            id: warrantyClaim.id,
            claimNumber: warrantyClaim.claimNumber,
            orderId: warrantyClaim.orderId,
            orderItemId: warrantyClaim.orderItemId,
            partId: warrantyClaim.partId,
            issueDescription: warrantyClaim.issueDescription,
            status: warrantyClaim.status,
            resolutionNote: warrantyClaim.resolutionNote,
            createdAt: warrantyClaim.createdAt,
            updatedAt: warrantyClaim.updatedAt,
            resolvedAt: warrantyClaim.resolvedAt,
          })
          .from(warrantyClaim)
          .where(eq(warrantyClaim.buyerId, session.user.id))
          .orderBy(desc(warrantyClaim.createdAt));

    return NextResponse.json({ claims: rows });
  } catch (error) {
    console.error("Warranty claims fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load warranty claims" },
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

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const orderItemId =
    typeof body.orderItemId === "string" ? body.orderItemId.trim() || null : null;
  const partId =
    typeof body.partId === "string" ? body.partId.trim() || null : null;
  const issueDescription =
    typeof body.issueDescription === "string"
      ? body.issueDescription.trim()
      : typeof body.description === "string"
        ? body.description.trim()
        : "";

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }
  if (!issueDescription) {
    return NextResponse.json(
      { error: "issueDescription is required" },
      { status: 400 },
    );
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
  const claimNumber = generateTicketNumber("WRN");

  await db.insert(warrantyClaim).values({
    id,
    claimNumber,
    orderId,
    orderItemId,
    buyerId: buyerOrder.buyerId,
    partId,
    issueDescription,
    status: "submitted",
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "warranty.create",
    entityType: "warranty_claim",
    entityId: id,
    metadata: { claimNumber, orderId },
  });

  return NextResponse.json(
    { success: true, id, claimNumber },
    { status: 201 },
  );
}
