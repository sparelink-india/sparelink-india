import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  cart,
  cartItem,
  dealerListing,
  firmOrder,
  firmOrderItem,
  inventory,
  order,
  orderItem,
  part,
} from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { calculateCartTotals, extractGSTRate } from "@/lib/gst";

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

export async function GET() {
  const session = await getServerSession();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const orders = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotalPaise: order.subtotalPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(eq(order.buyerId, session.user.id))
    .orderBy(desc(order.createdAt));

  if (!orders.length) {
    return NextResponse.json({ orders: [] });
  }

  const items = await db
    .select({
      orderId: orderItem.orderId,
      id: orderItem.id,
      partName: orderItem.partName,
      partNumber: orderItem.partNumber,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      totalPaise: orderItem.totalPaise,
    })
    .from(orderItem)
    .where(
      inArray(
        orderItem.orderId,
        orders.map((item) => item.id),
      ),
    );

  return NextResponse.json({
    orders: orders.map((item) => {
      const gstPaise = Math.max(
        0,
        item.totalPaise - item.subtotalPaise - (item.shippingPaise ?? 0),
      );
      return {
        ...item,
        gstPaise,
        items: items.filter((orderItem) => orderItem.orderId === item.id),
      };
    }),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const shippingAddress = parseShippingAddress(body?.shippingAddress);
  const paymentMethod = body?.paymentMethod;
  const buyerGstin =
    typeof body?.buyerGstin === "string" && body.buyerGstin.trim()
      ? body.buyerGstin.trim().toUpperCase()
      : undefined;
  const buyerBusinessName =
    typeof body?.buyerBusinessName === "string" && body.buyerBusinessName.trim()
      ? body.buyerBusinessName.trim()
      : undefined;

  if (!shippingAddress) {
    return NextResponse.json(
      { error: "Please provide a complete Indian delivery address." },
      { status: 400 },
    );
  }

  let formattedAddressLine2 = shippingAddress.addressLine2;
  if (buyerGstin) {
    const gstinTag = `GSTIN: ${buyerGstin}${buyerBusinessName ? ` | ${buyerBusinessName}` : ""}`;
    formattedAddressLine2 = formattedAddressLine2
      ? `${formattedAddressLine2} (${gstinTag})`
      : gstinTag;
  }

  if (paymentMethod !== "cash_on_delivery" && paymentMethod !== "razorpay") {
    return NextResponse.json(
      { error: "Please choose a valid payment method." },
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
      firmId: dealerListing.firmId,
      quantity: cartItem.quantity,
      pricePaise: dealerListing.pricePaise,
      listingStatus: dealerListing.status,
      stock: inventory.quantity,
      partId: part.id,
      partNumber: part.partNumber,
      partName: part.name,
      partDescription: part.description,
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
      item.listingStatus !== "active" ||
      !item.firmId ||
      (item.stock ?? 0) < item.quantity,
  );

  if (unavailableItem) {
    return NextResponse.json(
      {
        error: `${unavailableItem.partName} is no longer available in the requested quantity.`,
      },
      { status: 409 },
    );
  }

  const totals = calculateCartTotals(
    cartItems.map((i) => ({
      pricePaise: i.pricePaise,
      quantity: i.quantity,
      partDescription: i.partDescription,
    })),
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

      const shippingMethod = ["self_pickup", "transport", "courier"].includes(body?.shippingMethod)
        ? body.shippingMethod
        : "courier";
      const transportName = typeof body?.transportName === "string" ? body.transportName.trim() : null;
      const transportPhone = typeof body?.transportPhone === "string" ? body.transportPhone.trim() : null;
      const transportGstin = typeof body?.transportGstin === "string" ? body.transportGstin.trim().toUpperCase() : null;

      await tx.insert(order).values({
        id: orderId,
        orderNumber,
        buyerId: session.user.id,
        status: paymentMethod === "razorpay" ? "payment_pending" : "placed",
        paymentMethod,
        subtotalPaise: totals.subtotalPaise,
        shippingPaise: totals.shippingPaise,
        totalPaise: totals.totalPaise,
        shippingName: buyerBusinessName
          ? `${shippingAddress.name} (${buyerBusinessName})`
          : shippingAddress.name,
        shippingPhone: shippingAddress.phone,
        shippingAddressLine1: shippingAddress.addressLine1,
        shippingAddressLine2: formattedAddressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingPincode: shippingAddress.pincode,
        buyerBusinessName: buyerBusinessName || null,
        buyerGstin: buyerGstin || null,
        customerType: buyerGstin ? "b2b" : "b2c",
        shippingMethod,
        transportName,
        transportPhone,
        transportGstin,
        billingAddressLine1: shippingAddress.addressLine1,
        billingAddressLine2: formattedAddressLine2,
        billingCity: shippingAddress.city,
        billingState: shippingAddress.state,
        billingPincode: shippingAddress.pincode,
      });

      const createdItems = cartItems.map((item) => {
        const gstRate = extractGSTRate(item.partDescription);
        const itemSubtotal = item.pricePaise * item.quantity;
        const itemGst = Math.round((itemSubtotal * gstRate) / 100);
        return {
          id: randomUUID(),
          orderId,
          dealerListingId: item.dealerListingId,
          dealerId: item.dealerId,
          partId: item.partId,
          partNumber: item.partNumber,
          partName: item.partName,
          quantity: item.quantity,
          unitPricePaise: item.pricePaise,
          totalPaise: itemSubtotal + itemGst,
        };
      });
      await tx.insert(orderItem).values(createdItems);

      const byFirm = new Map<string, typeof createdItems>();
      for (const item of createdItems) {
        const firmId = cartItems.find(
          (cartItem) => cartItem.dealerListingId === item.dealerListingId,
        )?.firmId;
        if (!firmId)
          throw new Error(
            "This listing is not assigned to a fulfillment firm.",
          );
        byFirm.set(firmId, [...(byFirm.get(firmId) ?? []), item]);
      }
      for (const [firmId, items] of byFirm) {
        const firmOrderId = randomUUID();
        const allocationNumber = `SLA-${orderNumber}-${firmId.slice(0, 6).toUpperCase()}`;
        await tx
          .insert(firmOrder)
          .values({
            id: firmOrderId,
            orderId,
            firmId,
            allocationNumber,
            amountPaise: items.reduce(
              (total, item) => total + item.totalPaise,
              0,
            ),
            paymentAccountingReference: `SPL-${orderNumber}-${firmId.slice(0, 8).toUpperCase()}`,
          });
        await tx
          .insert(firmOrderItem)
          .values(
            items.map((item) => ({
              id: randomUUID(),
              firmOrderId,
              orderItemId: item.id,
            })),
          );
      }

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
    {
      id: orderId,
      orderNumber,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      shippingPaise: totals.shippingPaise,
      totalPaise: totals.totalPaise,
      status: "placed",
    },
    { status: 201 },
  );
}
