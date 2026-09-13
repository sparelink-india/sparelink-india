import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  firm,
  dealer,
  part,
  dealerListing,
  order,
} from "@/drizzle/schema";
import { count, eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();

  try {
    const [
      firmStats,
      dealerStats,
      partStats,
      listingStats,
      orderStats,
      revenueStats,
    ] = await Promise.all([
      db.select({ value: count() }).from(firm),
      db.select({ value: count() }).from(dealer),
      db.select({ value: count() }).from(part),
      db
        .select({ value: count() })
        .from(dealerListing)
        .where(eq(dealerListing.status, "active")),
      db.select({ value: count() }).from(order),
      db
        .select({
          total: count(),
          revenue: count(), // Will calculate from order totals
        })
        .from(order),
    ]);

    // Get total revenue
    const revenueData = await db
      .select({ totalPaise: order.totalPaise })
      .from(order);

    const totalRevenue = revenueData.reduce(
      (sum, o) => sum + o.totalPaise,
      0,
    );

    return NextResponse.json({
      totalFirms: firmStats[0]?.value ?? 0,
      totalDealers: dealerStats[0]?.value ?? 0,
      totalParts: partStats[0]?.value ?? 0,
      activeListings: listingStats[0]?.value ?? 0,
      totalOrders: orderStats[0]?.value ?? 0,
      totalRevenue,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to load statistics" },
      { status: 500 },
    );
  }
}
