import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dealerListing, part, wishlist } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { denyIfMustChangePassword } from "@/lib/require-role";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { publicListingPrice } from "@/lib/party-pricing";
import { isPensolProduct } from "@/lib/pensol-pricing";
import { catalogueImagePublicPath } from "@/lib/catalogue-image-index";

function resolveWishlistImageUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = catalogueImagePublicPath(candidate);
    if (url) return url;
  }
  return null;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const db = getDb();
  const items = await db
    .select({
      id: wishlist.id,
      partId: wishlist.partId,
      partNumber: part.partNumber,
      partName: part.name,
      brand: part.brand,
      description: part.description,
      createdAt: wishlist.createdAt,
    })
    .from(wishlist)
    .innerJoin(part, eq(wishlist.partId, part.id))
    .where(eq(wishlist.userId, session.user.id))
    .orderBy(desc(wishlist.createdAt));

  const partIds = items.map((item) => item.partId);
  const listings =
    partIds.length === 0
      ? []
      : await db
          .select({
            id: dealerListing.id,
            partId: dealerListing.partId,
            pricePaise: dealerListing.pricePaise,
            mrpPaise: dealerListing.mrpPaise,
            sku: dealerListing.sku,
          })
          .from(dealerListing)
          .where(
            and(
              inArray(dealerListing.partId, partIds),
              eq(dealerListing.status, "active"),
            ),
          );

  const listingByPart = new Map<string, (typeof listings)[number]>();
  for (const listing of listings) {
    if (!listingByPart.has(listing.partId)) {
      listingByPart.set(listing.partId, listing);
    }
  }

  const pricing = await resolveStorefrontPricing(session);

  return NextResponse.json({
    items: items.map((item) => {
      const listing = listingByPart.get(item.partId);
      const gstRate = extractGSTRate(item.description);
      const pensol = isPensolProduct({ brand: item.brand, name: item.partName });
      const priced = listing
        ? publicListingPrice(
            listing.pricePaise,
            gstRate,
            pensol ? 0 : pricing.effectiveDiscountPercent,
          )
        : null;
      return {
        id: item.id,
        partId: item.partId,
        partNumber: item.partNumber,
        partName: item.partName,
        brand: item.brand,
        createdAt: item.createdAt,
        listingId: listing?.id ?? null,
        pricePaise: listing?.pricePaise ?? null,
        mrpPaise: listing?.mrpPaise ?? null,
        listInclusivePaise: priced?.listInclusivePaise ?? null,
        netInclusivePaise: priced?.netInclusivePaise ?? null,
        discountPercent: priced?.discountPercent ?? null,
        gstRate: priced?.gstRate ?? gstRate,
        imageUrl: resolveWishlistImageUrl(listing?.sku, item.partNumber),
      };
    }),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const partId = typeof body?.partId === "string" ? body.partId.trim() : "";
  if (!partId) {
    return NextResponse.json({ error: "partId is required" }, { status: 400 });
  }

  const db = getDb();
  const existingPart = await db.query.part.findFirst({
    where: eq(part.id, partId),
  });
  if (!existingPart) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 });
  }

  const existing = await db.query.wishlist.findFirst({
    where: and(
      eq(wishlist.userId, session.user.id),
      eq(wishlist.partId, partId),
    ),
  });
  if (existing) {
    return NextResponse.json({ success: true, id: existing.id });
  }

  const id = randomUUID();
  await db.insert(wishlist).values({
    id,
    userId: session.user.id,
    partId,
  });

  return NextResponse.json({ success: true, id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const partId = typeof body?.partId === "string" ? body.partId.trim() : "";

  if (!id && !partId) {
    return NextResponse.json(
      { error: "id or partId is required" },
      { status: 400 },
    );
  }

  const db = getDb();

  if (id) {
    const existing = await db.query.wishlist.findFirst({
      where: and(eq(wishlist.id, id), eq(wishlist.userId, session.user.id)),
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    await db.delete(wishlist).where(eq(wishlist.id, id));
  } else {
    await db
      .delete(wishlist)
      .where(
        and(
          eq(wishlist.userId, session.user.id),
          eq(wishlist.partId, partId),
        ),
      );
  }

  return NextResponse.json({ success: true });
}
