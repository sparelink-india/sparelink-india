import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { typesense } from "@/lib/typesense";
import { getDb } from "@/lib/db";
import { dealer, dealerListing, inventory } from "@/drizzle/schema";

type PartDocument = {
  id?: string;
  part_number?: string;
  name?: string;
  description?: string;
  brand?: string;
  category?: string;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  if (!typesense) {
    return NextResponse.json(
      { error: "Search service is not configured" },
      { status: 503 },
    );
  }

  try {
    const searchResults = await typesense
      .collections("parts")
      .documents()
      .search({
        q: query,
        query_by: "part_number,name,description,brand,category",
        query_by_weights: "5,4,2,3,2",
        per_page: 20,
      });

    const hits = searchResults.hits ?? [];

    const partIds = hits
      .map((hit) => (hit.document as PartDocument | undefined)?.id)
      .filter((id): id is string => Boolean(id));

    const listings =
      partIds.length > 0
        ? await getDb()
            .select({
              id: dealerListing.id,
              partId: dealerListing.partId,
              dealerId: dealerListing.dealerId,
              dealerName: dealer.businessName,
              sku: dealerListing.sku,
              pricePaise: dealerListing.pricePaise,
              mrpPaise: dealerListing.mrpPaise,
              status: dealerListing.status,
              stock: inventory.quantity,
            })
            .from(dealerListing)
            .innerJoin(dealer, eq(dealerListing.dealerId, dealer.id))
            .leftJoin(
              inventory,
              eq(dealerListing.id, inventory.dealerListingId),
            )
            .where(inArray(dealerListing.partId, partIds))
        : [];

    const listingsByPartId = new Map<string, typeof listings>();

    for (const listing of listings) {
      const existing = listingsByPartId.get(listing.partId) ?? [];
      existing.push(listing);
      listingsByPartId.set(listing.partId, existing);
    }

    const results = hits.map((hit) => {
      const part = (hit.document as PartDocument | undefined) ?? {};

      return {
        ...hit,
        listings: listingsByPartId.get(part.id ?? "") ?? [],
      };
    });

    return NextResponse.json({
      results,
      found: searchResults.found,
    });
  } catch (error) {
    console.error("Parts search failed:", error);

    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 },
    );
  }
}
