import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { dealer, dealerListing } from "@/drizzle/schema";
import { count, eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const dealers = await db
      .select({
        id: dealer.id,
        businessName: dealer.businessName,
        gstin: dealer.gstin,
        city: dealer.city,
        state: dealer.state,
        email: dealer.email,
        createdAt: dealer.createdAt,
      })
      .from(dealer)
      .orderBy(desc(dealer.createdAt));

    // Get listing count for each dealer
    const dealerIds = dealers.map((d) => d.id);

    const listingCounts = await Promise.all(
      dealerIds.map(async (dealerId) => {
        const result = await db
          .select({ count: count() })
          .from(dealerListing)
          .where(eq(dealerListing.dealerId, dealerId));
        return { dealerId, count: result[0]?.count ?? 0 };
      }),
    );

    const countMap = new Map(listingCounts.map((item) => [item.dealerId, item.count]));

    const dealersWithCounts = dealers.map((d) => ({
      ...d,
      listingCount: countMap.get(d.id) ?? 0,
    }));

    return NextResponse.json({ dealers: dealersWithCounts });
  } catch (error) {
    console.error("Dealers fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load dealers" },
      { status: 500 },
    );
  }
}
