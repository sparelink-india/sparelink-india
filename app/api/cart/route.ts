import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth-server";
import {
  cart,
  cartItem,
  dealerListing,
  inventory,
  part,
} from "@/drizzle/schema";

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
      totalPaise: 0,
    });
  }

  const items = await db
    .select({
      id: cartItem.id,
      dealerListingId: cartItem.dealerListingId,
      quantity: cartItem.quantity,
      pricePaise: cartItem.pricePaise,
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.name,
    })
    .from(cartItem)
    .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .where(eq(cartItem.cartId, existingCart.id));

  const totalPaise = items.reduce(
    (total, item) => total + item.pricePaise * item.quantity,
    0,
  );

  return NextResponse.json({
    id: existingCart.id,
    items,
    totalPaise,
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
      stock: inventory.quantity,
    })
    .from(dealerListing)
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(dealerListing.id, dealerListingId))
    .limit(1);

  const selectedListing = listing[0];

  if (!selectedListing || selectedListing.status !== "active") {
    return NextResponse.json(
      { error: "Dealer listing not found or inactive" },
      { status: 404 },
    );
  }

  const stock = selectedListing.stock ?? 0;

  if (quantity > stock) {
    return NextResponse.json(
      { error: "Requested quantity exceeds available stock" },
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
        { error: "Total cart quantity exceeds available stock" },
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
