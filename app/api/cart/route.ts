import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth-server";
import {
  cart,
  cartItem,
  dealer,
  dealerListing,
  firm,
  inventory,
  part,
} from "@/drizzle/schema";
import { calculateLineItemGST, calculateCartTotals } from "@/lib/gst";

async function getBuyerSession() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  if (session.user.role !== "buyer") {
    return null;
  }

  return session;
}

export async function GET() {
  const session = await getBuyerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const existingCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });

  if (!existingCart) {
    return NextResponse.json({
      id: null,
      items: [],
      subtotalPaise: 0,
      gstPaise: 0,
      shippingPaise: 0,
      totalPaise: 0,
      itemCount: 0,
    });
  }

  const rawItems = await db
    .select({
      id: cartItem.id,
      dealerListingId: cartItem.dealerListingId,
      quantity: cartItem.quantity,
      pricePaise: dealerListing.pricePaise,
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.name,
      partDescription: part.description,
      partBrand: part.brand,
      dealerId: dealer.id,
      dealerName: dealer.businessName,
      firmId: firm.id,
      firmName: firm.name,
      firmCode: firm.code,
      mrpPaise: dealerListing.mrpPaise,
      stock: inventory.quantity,
      listingStatus: dealerListing.status,
    })
    .from(cartItem)
    .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(dealer, eq(dealerListing.dealerId, dealer.id))
    .leftJoin(firm, eq(dealerListing.firmId, firm.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(cartItem.cartId, existingCart.id));

  const items = rawItems.map((item) => {
    const tax = calculateLineItemGST(
      item.pricePaise,
      item.quantity,
      item.partDescription,
    );
    return {
      ...item,
      gstRate: tax.gstRate,
      itemSubtotalPaise: tax.itemSubtotalPaise,
      itemGstPaise: tax.itemGstPaise,
      itemTotalPaise: tax.itemTotalPaise,
    };
  });

  const totals = calculateCartTotals(
    rawItems.map((i) => ({
      pricePaise: i.pricePaise,
      quantity: i.quantity,
      partDescription: i.partDescription,
    })),
    0,
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return NextResponse.json({
    id: existingCart.id,
    items,
    subtotalPaise: totals.subtotalPaise,
    gstPaise: totals.gstPaise,
    shippingPaise: totals.shippingPaise,
    totalPaise: totals.totalPaise,
    itemCount,
  });
}

export async function POST(request: Request) {
  const session = await getBuyerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const dealerListingId = body?.dealerListingId;
  const quantity = body?.quantity;

  if (
    typeof dealerListingId !== "string" ||
    !dealerListingId ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      { error: "dealerListingId and positive integer quantity are required" },
      { status: 400 },
    );
  }

  const db = getDb();

  const listing = await db
    .select({
      id: dealerListing.id,
      pricePaise: dealerListing.pricePaise,
      status: dealerListing.status,
      firmId: dealerListing.firmId,
      stock: inventory.quantity,
    })
    .from(dealerListing)
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(dealerListing.id, dealerListingId))
    .limit(1);

  const selectedListing = listing[0];

  if (
    !selectedListing ||
    selectedListing.status !== "active" ||
    !selectedListing.firmId
  ) {
    return NextResponse.json(
      {
        error:
          !selectedListing || selectedListing.status !== "active"
            ? "Dealer listing not found or inactive"
            : "This listing is not assigned to a fulfillment partner. Please select another option.",
      },
      { status: 404 },
    );
  }

  const stock = selectedListing.stock ?? 0;

  if (quantity > stock) {
    return NextResponse.json(
      { error: `Requested quantity (${quantity}) exceeds available stock (${stock})` },
      { status: 400 },
    );
  }

  let existingCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });

  if (!existingCart) {
    existingCart = {
      id: randomUUID(),
      buyerId: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(cart).values(existingCart);
  }

  const existingItem = await db.query.cartItem.findFirst({
    where: and(
      eq(cartItem.cartId, existingCart.id),
      eq(cartItem.dealerListingId, dealerListingId),
    ),
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (newQuantity > stock) {
      return NextResponse.json(
        { error: `Total cart quantity (${newQuantity}) exceeds available stock (${stock})` },
        { status: 400 },
      );
    }

    await db
      .update(cartItem)
      .set({
        quantity: newQuantity,
        pricePaise: selectedListing.pricePaise,
        updatedAt: new Date(),
      })
      .where(eq(cartItem.id, existingItem.id));

    return NextResponse.json({
      id: existingItem.id,
      quantity: newQuantity,
      pricePaise: selectedListing.pricePaise,
    });
  }

  const item = {
    id: randomUUID(),
    cartId: existingCart.id,
    dealerListingId,
    quantity,
    pricePaise: selectedListing.pricePaise,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(cartItem).values(item);

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getBuyerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cartItemId = body?.cartItemId || body?.id;
  const quantity = body?.quantity;

  if (
    typeof cartItemId !== "string" ||
    !cartItemId ||
    !Number.isInteger(quantity)
  ) {
    return NextResponse.json(
      { error: "cartItemId and integer quantity are required" },
      { status: 400 },
    );
  }

  if (quantity < 1) {
    return NextResponse.json(
      { error: "Quantity must be at least 1. Use remove to delete item." },
      { status: 400 },
    );
  }

  const db = getDb();

  const buyerCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });

  if (!buyerCart) {
    return NextResponse.json({ error: "Cart not found" }, { status: 404 });
  }

  const targetItems = await db
    .select({
      id: cartItem.id,
      cartId: cartItem.cartId,
      dealerListingId: cartItem.dealerListingId,
      quantity: cartItem.quantity,
      listingStatus: dealerListing.status,
      listingPricePaise: dealerListing.pricePaise,
      firmId: dealerListing.firmId,
      stock: inventory.quantity,
      partName: part.name,
    })
    .from(cartItem)
    .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(and(eq(cartItem.id, cartItemId), eq(cartItem.cartId, buyerCart.id)))
    .limit(1);

  const target = targetItems[0];
  if (!target) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  if (target.listingStatus !== "active" || !target.firmId) {
    return NextResponse.json(
      { error: "This item is no longer available." },
      { status: 400 },
    );
  }

  const stock = target.stock ?? 0;
  if (quantity > stock) {
    return NextResponse.json(
      {
        error: `Only ${stock} unit${stock === 1 ? "" : "s"} available in stock for ${target.partName || "this item"}.`,
        availableStock: stock,
      },
      { status: 400 },
    );
  }

  await db
    .update(cartItem)
    .set({
      quantity,
      pricePaise: target.listingPricePaise,
      updatedAt: new Date(),
    })
    .where(eq(cartItem.id, target.id));

  return NextResponse.json({
    success: true,
    id: target.id,
    quantity,
    pricePaise: target.listingPricePaise,
  });
}

export async function DELETE(request: Request) {
  const session = await getBuyerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let cartItemId =
    url.searchParams.get("cartItemId") || url.searchParams.get("id");

  if (!cartItemId) {
    const body = await request.json().catch(() => null);
    cartItemId = body?.cartItemId || body?.id;
  }

  if (typeof cartItemId !== "string" || !cartItemId) {
    return NextResponse.json(
      { error: "cartItemId is required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const buyerCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });

  if (!buyerCart) {
    return NextResponse.json({ error: "Cart not found" }, { status: 404 });
  }

  const deleted = await db
    .delete(cartItem)
    .where(and(eq(cartItem.id, cartItemId), eq(cartItem.cartId, buyerCart.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Cart item not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    deletedId: cartItemId,
  });
}
