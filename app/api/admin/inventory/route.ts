import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { inventory, dealerListing, part, dealer } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const inventoryData = await db
      .select({
        id: inventory.id,
        partName: part.name,
        dealerName: dealer.businessName,
        quantity: inventory.quantity,
        price: dealerListing.pricePaise,
        lastUpdated: inventory.updatedAt,
      })
      .from(inventory)
      .innerJoin(dealerListing, eq(inventory.dealerListingId, dealerListing.id))
      .innerJoin(part, eq(dealerListing.partId, part.id))
      .innerJoin(dealer, eq(dealerListing.dealerId, dealer.id))
      .orderBy(desc(inventory.updatedAt));

    return NextResponse.json({ inventory: inventoryData });
  } catch (error) {
    console.error("Inventory fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load inventory" },
      { status: 500 },
    );
  }
}
