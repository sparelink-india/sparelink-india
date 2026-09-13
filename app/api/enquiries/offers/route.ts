import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { dealer, enquiry, enquiryOffer } from "@/drizzle/schema";

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (session.user.role !== "dealer") {
    return NextResponse.json(
      { error: "Only dealers can submit offers" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const enquiryId = String(body.enquiryId ?? "").trim();
    const pricePaise = Number(body.pricePaise);
    const quantity = Number(body.quantity);
    const message =
      typeof body.message === "string" ? body.message.trim() : null;

    if (!enquiryId) {
      return NextResponse.json(
        { error: "enquiryId is required" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(pricePaise) || pricePaise <= 0) {
      return NextResponse.json(
        { error: "pricePaise must be a positive integer" },
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

    const [dealerProfile] = await db
      .select({ id: dealer.id })
      .from(dealer)
      .where(eq(dealer.userId, session.user.id))
      .limit(1);

    if (!dealerProfile) {
      return NextResponse.json(
        { error: "Dealer profile not found" },
        { status: 404 },
      );
    }

    const [existingEnquiry] = await db
      .select({ id: enquiry.id, status: enquiry.status })
      .from(enquiry)
      .where(eq(enquiry.id, enquiryId))
      .limit(1);

    if (!existingEnquiry) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 },
      );
    }

    if (existingEnquiry.status !== "open") {
      return NextResponse.json(
        { error: "Enquiry is not open for offers" },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(enquiryOffer)
      .values({
        id: crypto.randomUUID(),
        enquiryId,
        dealerId: dealerProfile.id,
        pricePaise,
        quantity,
        message,
      })
      .returning();

    return NextResponse.json(
      { offer: created },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create enquiry offer failed:", error);

    return NextResponse.json(
      { error: "Failed to create enquiry offer" },
      { status: 500 },
    );
  }
}