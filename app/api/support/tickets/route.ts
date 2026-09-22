import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { order, supportTicket } from "@/drizzle/schema";
import { generateTicketNumber, writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { denyIfMustChangePassword } from "@/lib/require-role";

const CATEGORIES = new Set([
  "wrong_part",
  "damaged_item",
  "missing_item",
  "late_delivery",
  "warranty",
  "payment_issue",
  "other",
]);

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
          .from(supportTicket)
          .orderBy(desc(supportTicket.createdAt))
      : await db
          .select()
          .from(supportTicket)
          .where(eq(supportTicket.userId, session.user.id))
          .orderBy(desc(supportTicket.createdAt));

    return NextResponse.json({ tickets: rows });
  } catch (error) {
    console.error("Support tickets fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load support tickets" },
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

  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() || null : null;

  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 },
    );
  }

  const db = getDb();

  if (orderId && session.user.role !== "admin") {
    const owned = await db.query.order.findFirst({
      where: eq(order.id, orderId),
      columns: { id: true, buyerId: true },
    });
    if (!owned || owned.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: "orderId must refer to one of your orders" },
        { status: 400 },
      );
    }
  }

  const id = randomUUID();
  const ticketNumber = generateTicketNumber("SUP");

  await db.insert(supportTicket).values({
    id,
    ticketNumber,
    userId: session.user.id,
    orderId,
    category,
    subject,
    description,
    status: "open",
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "support.create",
    entityType: "support_ticket",
    entityId: id,
    metadata: { ticketNumber, category },
  });

  return NextResponse.json(
    { success: true, id, ticketNumber },
    { status: 201 },
  );
}
