import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { part, partCategory, dealerListing } from "@/drizzle/schema";
import { count, eq, desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getDb();

  try {
    const products = await db
      .select({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        description: part.description,
        brand: part.brand,
        category: partCategory.name,
        createdAt: part.createdAt,
      })
      .from(part)
      .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
      .orderBy(desc(part.createdAt));

    // Get listing count for each product
    const productIds = products.map((p) => p.id);

    const listingCounts = await Promise.all(
      productIds.map(async (partId) => {
        const result = await db
          .select({ count: count() })
          .from(dealerListing)
          .where(eq(dealerListing.partId, partId));
        return { partId, count: result[0]?.count ?? 0 };
      }),
    );

    const countMap = new Map(
      listingCounts.map((item) => [item.partId, item.count]),
    );

    const productsWithCounts = products.map((p) => ({
      ...p,
      listingCount: countMap.get(p.id) ?? 0,
    }));

    return NextResponse.json({ products: productsWithCounts });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}
