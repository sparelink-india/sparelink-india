import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  dealer,
  dealerListing,
  inventory,
  order,
  orderItem,
  part,
} from "@/drizzle/schema";
import { requireDealerApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";

async function getDealerId() {
  const auth = await requireDealerApi();
  if (auth.error) return { error: auth.error };
  const session = auth.session;
  const profile = await getDb().query.dealer.findFirst({
    where: eq(dealer.userId, session.user.id),
  });
  return profile
    ? { dealerId: profile.id, businessName: profile.businessName }
    : {
        error: NextResponse.json(
          { error: "Dealer profile not found" },
          { status: 404 },
        ),
      };
}

export async function GET() {
  const access = await getDealerId();
  if ("error" in access) return access.error;
  const db = getDb();
  const listings = await db
    .select({
      id: dealerListing.id,
      partName: part.name,
      partNumber: part.partNumber,
      sku: dealerListing.sku,
      pricePaise: dealerListing.pricePaise,
      status: dealerListing.status,
      stock: inventory.quantity,
    })
    .from(dealerListing)
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(dealerListing.dealerId, access.dealerId));
  const recentOrders = await db
    .select({
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      partName: orderItem.partName,
      quantity: orderItem.quantity,
      totalPaise: orderItem.totalPaise,
      createdAt: order.createdAt,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(eq(orderItem.dealerId, access.dealerId))
    .orderBy(desc(order.createdAt))
    .limit(10);
  return NextResponse.json({
    businessName: access.businessName,
    listings,
    recentOrders,
  });
}

export async function PATCH(request: Request) {
  const access = await getDealerId();
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const pricePaise = Number(body?.pricePaise);
  const stock = Number(body?.stock);
  const status = body?.status;
  if (
    !id ||
    !Number.isInteger(pricePaise) ||
    pricePaise <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    !["active", "inactive"].includes(status)
  )
    return NextResponse.json(
      { error: "Invalid listing update." },
      { status: 400 },
    );
  const db = getDb();
  const listing = await db.query.dealerListing.findFirst({
    where: and(
      eq(dealerListing.id, id),
      eq(dealerListing.dealerId, access.dealerId),
    ),
  });
  if (!listing)
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx
      .update(dealerListing)
      .set({ pricePaise, status, updatedAt: new Date() })
      .where(eq(dealerListing.id, id));
    await tx
      .update(inventory)
      .set({ quantity: stock, updatedAt: new Date() })
      .where(eq(inventory.dealerListingId, id));
  });
  return NextResponse.json({ ok: true });
}
