import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { typesense } from "@/lib/typesense";
import { getDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth-server";
import {
  dealer,
  dealerListing,
  firm,
  inventory,
  partVehicleCompatibility,
  vehicle,
} from "@/drizzle/schema";

type PartDocument = {
  id?: string;
  part_number?: string;
  name?: string;
  description?: string;
  brand?: string;
  category?: string;
};

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  const isAdmin = session?.user?.role === "admin";

  if (
    session?.user &&
    session.user.role !== "buyer" &&
    session.user.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Catalog access denied" },
      { status: 403 },
    );
  }
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const vehicleId = request.nextUrl.searchParams.get("vehicleId")?.trim();

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

    const db = getDb();
    const compatiblePartIds =
      vehicleId && partIds.length
        ? await db
            .select({ partId: partVehicleCompatibility.partId })
            .from(partVehicleCompatibility)
            .where(eq(partVehicleCompatibility.vehicleId, vehicleId))
        : null;
    const compatibleIdSet = compatiblePartIds
      ? new Set(compatiblePartIds.map((item) => item.partId))
      : null;
    const matchedPartIds = compatibleIdSet
      ? partIds.filter((partId) => compatibleIdSet.has(partId))
      : partIds;

    const listings =
      matchedPartIds.length > 0
        ? await db
            .select({
              id: dealerListing.id,
              partId: dealerListing.partId,
              dealerId: dealerListing.dealerId,
              dealerName: dealer.businessName,
              firmId: dealerListing.firmId,
              firmName: firm.name,
              firmCode: firm.code,
              sku: dealerListing.sku,
              pricePaise: dealerListing.pricePaise,
              mrpPaise: dealerListing.mrpPaise,
              status: dealerListing.status,
              stock: inventory.quantity,
            })
            .from(dealerListing)
            .innerJoin(dealer, eq(dealerListing.dealerId, dealer.id))
            .leftJoin(firm, eq(dealerListing.firmId, firm.id))
            .leftJoin(
              inventory,
              eq(dealerListing.id, inventory.dealerListingId),
            )
            .where(
              isAdmin
                ? inArray(dealerListing.partId, matchedPartIds)
                : and(
                    inArray(dealerListing.partId, matchedPartIds),
                    eq(dealerListing.status, "active"),
                  ),
            )
        : [];

    const compatibility =
      matchedPartIds.length > 0
        ? await db
            .select({
              partId: partVehicleCompatibility.partId,
              vehicleId: vehicle.id,
              make: vehicle.make,
              model: vehicle.model,
              variant: vehicle.variant,
            })
            .from(partVehicleCompatibility)
            .innerJoin(
              vehicle,
              eq(partVehicleCompatibility.vehicleId, vehicle.id),
            )
            .where(inArray(partVehicleCompatibility.partId, matchedPartIds))
        : [];

    const listingsByPartId = new Map<string, typeof listings>();
    const compatibilityByPartId = new Map<string, typeof compatibility>();

    for (const listing of listings) {
      const existing = listingsByPartId.get(listing.partId) ?? [];
      existing.push(listing);
      listingsByPartId.set(listing.partId, existing);
    }

    for (const item of compatibility) {
      const existing = compatibilityByPartId.get(item.partId) ?? [];
      existing.push(item);
      compatibilityByPartId.set(item.partId, existing);
    }

    const results = hits
      .filter((hit) => {
        const part = (hit.document as PartDocument | undefined) ?? {};
        return !compatibleIdSet || compatibleIdSet.has(part.id ?? "");
      })
      .map((hit) => {
        const part = (hit.document as PartDocument | undefined) ?? {};

        return {
          ...hit,
          listings: listingsByPartId.get(part.id ?? "") ?? [],
          compatibleVehicles: compatibilityByPartId.get(part.id ?? "") ?? [],
        };
      });

    return NextResponse.json({
      results,
      found: results.length,
    });
  } catch {
    console.error("Parts search failed");

    return NextResponse.json(
      { error: "Unable to search parts right now. Please try again." },
      { status: 500 },
    );
  }
}
