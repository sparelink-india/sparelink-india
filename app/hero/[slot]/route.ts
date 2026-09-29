import { NextResponse } from "next/server";

import { isHeroCollectionSlot } from "@/lib/hero-collections";
import { createHeroCollectionDeps } from "@/lib/hero-collection-repository";
import { getDb } from "@/lib/db";
import { asc, eq, inArray } from "drizzle-orm";
import { dealerListing, part } from "@/drizzle/schema";

/**
 * GET /hero/[slot] — the curated product set for one hero class.
 *
 * PUBLIC, and deliberately so: a hero hotspot must land on something a customer
 * can read, and an admin-only page behind a 307 would be a dead homepage dot.
 * The route returns 404 for a slot with nothing curated, which the hero turns
 * into a fallback link to /vehicle-fitment rather than a broken page.
 *
 * READ-ONLY AND NARROW. It selects from `hero_vehicle_collection_item` and the
 * listing tables needed to render a product card. It never reads
 * `part_vehicle_compatibility`: what a hero class shows is a merchandising
 * decision, and a customer seeing a curated shortlist must not read it as a
 * statement that those parts fit a specific vehicle.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slot: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { slot } = await ctx.params;
  if (!isHeroCollectionSlot(slot)) {
    return NextResponse.json({ error: "Unknown hero collection." }, { status: 404 });
  }

  const deps = createHeroCollectionDeps();
  const counts = await deps.listSlotCounts();
  const row = counts.get(slot);
  if (!row?.isEnabled || row.count < 1) {
    return NextResponse.json({ error: "This collection has nothing curated yet." }, { status: 404 });
  }

  const partIds = await deps.listItemPartIds(slot);

  /* Paged rather than unbounded: a curated set is a shortlist, but an admin
     could add 500 parts and a single unbounded join would render all of them. */
  const LIMIT = 24;
  const listings = await getDb()
    .select({
      partId: dealerListing.partId,
      listingId: dealerListing.id,
      title: part.name,
      partNumber: part.partNumber,
      brand: part.brand,
      pricePaise: dealerListing.pricePaise,
      mrpPaise: dealerListing.mrpPaise,
    })
    .from(dealerListing)
    .innerJoin(part, eq(part.id, dealerListing.partId))
    .where(inArray(dealerListing.partId, partIds))
    .orderBy(asc(dealerListing.partId))
    .limit(LIMIT);

  return NextResponse.json({
    slot,
    total: row.count,
    shown: listings.length,
    products: listings.map((l) => ({
      partId: l.partId,
      title: l.title,
      partNumber: l.partNumber,
      brand: l.brand,
      pricePaise: l.pricePaise,
      mrpPaise: l.mrpPaise,
      href: `/part/${encodeURIComponent(l.partId)}`,
    })),
  });
}
