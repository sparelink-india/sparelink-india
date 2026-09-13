import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { enquiry, part } from "@/drizzle/schema";

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (session.user.role !== "buyer") {
    return NextResponse.json(
      { error: "Only buyers can create enquiries" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const partId = String(body.partId ?? "").trim();
    const quantity = Number(body.quantity);
    const message =
      typeof body.message === "string" ? body.message.trim() : null;

    if (!partId) {
      return NextResponse.json(
        { error: "partId is required" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive integer" },
        { status: 400 },
      );
    }

    const db = getDb();

    const [created] = await db
      .insert(enquiry)
      .values({
        id: crypto.randomUUID(),
        buyerId: session.user.id,
        partId,
        quantity,
        message,
      })
      .returning();

    return NextResponse.json(
      { enquiry: created },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create enquiry failed:", error);

    return NextResponse.json(
      { error: "Failed to create enquiry" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (session.user.role !== "buyer") {
    return NextResponse.json(
      { error: "Only buyers can view buyer enquiries" },
      { status: 403 },
    );
  }

  try {
    const db = getDb();

    const enquiries = await db
      .select({
        id: enquiry.id,
        partId: enquiry.partId,
        partNumber: part.partNumber,
        partName: part.name,
        quantity: enquiry.quantity,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        updatedAt: enquiry.updatedAt,
      })
      .from(enquiry)
      .innerJoin(part, eq(enquiry.partId, part.id))
      .where(eq(enquiry.buyerId, session.user.id));

    return NextResponse.json({ enquiries });
  } catch (error) {
    console.error("Get enquiries failed:", error);

    return NextResponse.json(
      { error: "Failed to fetch enquiries" },
      { status: 500 },
    );
  }
}