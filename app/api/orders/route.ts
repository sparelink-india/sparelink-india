import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  cart,
  cartItem,
  dealerListing,
  inventory,
  order,
  orderItem,
  part,
} from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";

type ShippingAddress = {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

function parseShippingAddress(value: unknown): ShippingAddress | null {
  if (!value || typeof value !== "object") return null;

  const address = value as Record<string, unknown>;
  const requiredFields = [
    "name",
    "phone",
    "addressLine1",
    "city",
    "state",
    "pincode",
  ] as const;

  if (
    requiredFields.some(
      (field) => typeof address[field] !== "string" || !address[field].trim(),
    )
  ) {
    return null;
  }

  const phone = String(address.phone).replace(/[\s-]/g, "");
  const pincode = String(address.pincode).trim();

  if (!/^(?:\+91)?[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(pincode)) {
    return null;
  }

  return {
    name: String(address.name).trim(),
    phone,
    addressLine1: String(address.addressLine1).trim(),
    addressLine2:
      typeof address.addressLine2 === "string" && address.addressLine2.trim()
        ? address.addressLine2.trim()
        : undefined,
    city: String(address.city).trim(),
    state: String(address.state).trim(),
    pincode,
  };
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const shippingAddress = parseShippingAddress(body?.shippingAddress);

  if (!shippingAddress) {
    return NextResponse.json(
      { error: "Please provide a complete Indian delivery address." },
      { status: 400 },
    );
  }

  const db = getDb();
  const buyerCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });

  if (!buyerCart) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const cartItems = await db
    .select({
      id: cartItem.id,
      dealerListingId: dealerListing.id,
      dealerId: dealerListing.dealerId,
      quantity: cartItem.quantity,
      pricePaise: dealerListing.pricePaise,
      listingStatus: dealerListing.status,
      stock: inventory.quantity,
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.name,
    })
    .from(cartItem)
    .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(cartItem.cartId, buyerCart.id));

  if (!cartItems.length) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const unavailableItem = cartItems.find(
    (item) =>
      item.listingStatus !== "active" || (item.stock ?? 0) < item.quantity,
  );

  if (unavailableItem) {
    return NextResponse.json(
      {
        error: `${unavailableItem.partName} is no longer available in the requested quantity.`,
      },
      { status: 409 },
    );
  }

  const subtotalPaise = cartItems.reduce(
    (total, item) => total + item.pricePaise * item.quantity,
    0,
  );
  const orderId = randomUUID();
  const orderNumber = `SL-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 6).toUpperCase()}`;

  try {
    await db.transaction(async (tx) => {
      for (const item of cartItems) {
        const updated = await tx
          .update(inventory)
          .set({
            quantity: sql`${inventory.quantity} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(inventory.dealerListingId, item.dealerListingId),
              gte(inventory.quantity, item.quantity),
            ),
          )
          .returning({ id: inventory.id });

        if (!updated.length) {
          throw new Error(`${item.partName} is no longer available.`);
        }
      }

      await tx.insert(order).values({
        id: orderId,
        orderNumber,
        buyerId: session.user.id,
        subtotalPaise,
        shippingPaise: 0,
        totalPaise: subtotalPaise,
        shippingName: shippingAddress.name,
        shippingPhone: shippingAddress.phone,
        shippingAddressLine1: shippingAddress.addressLine1,
        shippingAddressLine2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingPincode: shippingAddress.pincode,
      });

      await tx.insert(orderItem).values(
        cartItems.map((item) => ({
          id: randomUUID(),
          orderId,
          dealerListingId: item.dealerListingId,
          dealerId: item.dealerId,
          partId: item.partId,
          partNumber: item.partNumber,
          partName: item.partName,
          quantity: item.quantity,
          unitPricePaise: item.pricePaise,
          totalPaise: item.pricePaise * item.quantity,
        })),
      );

      await tx.delete(cartItem).where(eq(cartItem.cartId, buyerCart.id));
    });
  } catch (error) {
    console.error("Checkout failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to place your order. Please try again.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { id: orderId, orderNumber, totalPaise: subtotalPaise, status: "placed" },
    { status: 201 },
  );
}
