import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { dealerListing, part, dealer, firm } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { isAllowedFirmId } from "@/lib/firms";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getDb();

  try {
    const listings = await db
      .select({
        id: dealerListing.id,
        partNumber: part.partNumber,
        partName: part.name,
        dealerName: dealer.businessName,
        firmName: firm.name,
        firmId: dealerListing.firmId,
        sku: dealerListing.sku,
        price: dealerListing.pricePaise,
        status: dealerListing.status,
        createdAt: dealerListing.createdAt,
      })
      .from(dealerListing)
      .innerJoin(part, eq(dealerListing.partId, part.id))
      .innerJoin(dealer, eq(dealerListing.dealerId, dealer.id))
      .leftJoin(firm, eq(dealerListing.firmId, firm.id))
      .orderBy(desc(dealerListing.createdAt));

    return NextResponse.json({ listings });
  } catch (error) {
    console.error("Listings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load listings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  const { listingId, firmId } = body || {};

  if (!listingId || typeof listingId !== "string") {
    return NextResponse.json(
      { error: "listingId is required" },
      { status: 400 },
    );
  }

  if (firmId !== null && typeof firmId !== "string") {
    return NextResponse.json(
      { error: "firmId must be a string or null" },
      { status: 400 },
    );
  }

  if (firmId !== null && !isAllowedFirmId(firmId)) {
    return NextResponse.json({ error: "Invalid firmId" }, { status: 400 });
  }

  const db = getDb();

  try {
    const existing = await db
      .select({ id: dealerListing.id })
      .from(dealerListing)
      .where(eq(dealerListing.id, listingId))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 },
      );
    }

    await db
      .update(dealerListing)
      .set({
        firmId,
        updatedAt: new Date(),
      })
      .where(eq(dealerListing.id, listingId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Listing update error:", error);
    return NextResponse.json(
      { error: "Failed to update listing" },
      { status: 500 },
    );
  }
}
