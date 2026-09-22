import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  cart,
  cartItem,
  dealerListing,
  firm,
  firmOrder,
  firmOrderItem,
  inventory,
  order,
  orderItem,
  part,
} from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { isCodEnabledForFirm } from "@/lib/bank-payment-config";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { isCashfreeConfiguredForFirm } from "@/lib/cashfree";
import { SPARELINK_FIRMS, cartSupportsParentOnlinePayment, isAllowedFirmId } from "@/lib/firms";
import {
  splitLinesByFirm,
  validateAvailableStock,
  validateCartQuantity,
} from "@/lib/order-architecture";
import { denyIfMustChangePassword } from "@/lib/require-role";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { ignoreClientPricing } from "@/lib/party-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import {
  authorizedPensolSettlement,
  priceStorefrontLines,
} from "@/lib/storefront-line-price";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

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

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

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

  const orderIds = orders.map((item) => item.id);

  const allocations = await db
    .select({
      orderId: firmOrder.orderId,
      id: firmOrder.id,
      firmId: firmOrder.firmId,
      firmName: firm.name,
      firmCode: firm.code,
      allocationNumber: firmOrder.allocationNumber,
      amountPaise: firmOrder.amountPaise,
      fulfillmentStatus: firmOrder.fulfillmentStatus,
      paymentStatus: firmOrder.paymentStatus,
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .where(inArray(firmOrder.orderId, orderIds));

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
        orderIds,
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
        firmAllocations: allocations.filter(
          (allocation) => allocation.orderId === item.id,
        ),
      };
    }),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const rawBody = await request.json().catch(() => null);
  const body = ignoreClientPricing(
    (rawBody && typeof rawBody === "object"
      ? (rawBody as Record<string, unknown>)
      : {}) as Record<string, unknown>,
  );
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

  if (
    typeof paymentMethod !== "string" ||
    (paymentMethod !== "cash_on_delivery" &&
      paymentMethod !== "bank_transfer" &&
      paymentMethod !== "online_payment")
  ) {
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
      partBrand: part.brand,
      partSpecifications: part.specifications,
      sku: dealerListing.sku,
    })
    .from(cartItem)
    .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(cartItem.cartId, buyerCart.id));

  if (!cartItems.length) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const invalidQuantity = cartItems.find(
    (item) => !validateCartQuantity(item.quantity).ok,
  );
  if (invalidQuantity) {
    return NextResponse.json(
      { error: `${invalidQuantity.partName} has an invalid quantity.` },
      { status: 400 },
    );
  }

  const unavailableItem = cartItems.find(
    (item) =>
      item.listingStatus !== "active" ||
      !item.firmId ||
      !isAllowedFirmId(item.firmId) ||
      !validateAvailableStock(item.quantity, item.stock).ok,
  );

  if (unavailableItem) {
    return NextResponse.json(
      {
        error: `${unavailableItem.partName} is no longer available in the requested quantity.`,
      },
      { status: 409 },
    );
  }

  const unpricedItem = cartItems.find(
    (item) => !isAuthoritativeSellingPricePaise(item.pricePaise),
  );
  if (unpricedItem) {
    return NextResponse.json(
      {
        error: `${unpricedItem.partName} is available on request and cannot be purchased online.`,
      },
      { status: 400 },
    );
  }

  if (paymentMethod === "cash_on_delivery") {
    const firmMeta = new Map(
      SPARELINK_FIRMS.map((row) => [row.id, row] as const),
    );
    const codBlocked = cartItems.find((item) => {
      if (typeof item.firmId !== "string") return true;
      const meta = firmMeta.get(item.firmId);
      if (!meta) return true;
      return !isCodEnabledForFirm(meta.id, meta.name, meta.code);
    });
    if (codBlocked) {
      const meta =
        typeof codBlocked.firmId === "string"
          ? firmMeta.get(codBlocked.firmId)
          : undefined;
      return NextResponse.json(
        {
          error: `Cash on delivery is not available for ${meta?.name ?? "one of the firms"} in your cart.`,
        },
        { status: 400 },
      );
    }
  }

  if (paymentMethod === "online_payment") {
    const firmIds = [
      ...new Set(
        cartItems
          .map((item) => item.firmId)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];
    if (!cartSupportsParentOnlinePayment(firmIds, isCashfreeConfiguredForFirm)) {
      return NextResponse.json(
        {
          error:
            "Online payment is only available when every firm in your cart can accept Cashfree. Please choose Cash on Delivery or bank transfer, or remove items from firms that cannot take online payment.",
        },
        { status: 400 },
      );
    }
  }

  const settlementResult = authorizedPensolSettlement(body.pensolSettlement);
  if (settlementResult.error) {
    return NextResponse.json({ error: settlementResult.error }, { status: 400 });
  }

  const pricing = await resolveStorefrontPricing(session);
  const pensolConfigs = await resolvePensolConfigsForUser(session.user.id);
  const storefront = priceStorefrontLines(
    cartItems.map((item) => ({
      product: {
        brand: item.partBrand,
        name: item.partName,
        sku: item.sku,
        uom: item.partSpecifications,
        specifications: item.partSpecifications,
      },
      listInclusivePaise: item.pricePaise,
      quantity: item.quantity,
      gstRate: extractGSTRate(item.partDescription),
    })),
    pricing.effectiveDiscountPercent,
    settlementResult.settlement,
    pensolConfigs.commonConfig,
    pensolConfigs.customerConfig,
  );
  const pricedLines = cartItems.map((item, index) => ({
    item,
    gstRate: storefront.priced[index].gstRate,
    priced: storefront.priced[index],
  }));
  const totals = storefront.totals;

  const firmSplit = splitLinesByFirm(
    pricedLines.map(({ item, priced }) => ({
      listingId: item.dealerListingId,
      firmId: item.firmId as string,
      quantity: item.quantity,
      unitNetInclusivePaise: priced.netInclusivePaise,
      lineNetInclusivePaise: priced.lineNetPaise,
      lineGstPaise: priced.lineGstPaise,
    })),
  );
  if (!firmSplit.ok) {
    return NextResponse.json({ error: firmSplit.error }, { status: 400 });
  }

  const orderId = randomUUID();
  const orderNumber = `SL-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 6).toUpperCase()}`;

  try {
    await db.transaction(async (tx) => {
      const lockedCart = await tx
        .select({ id: cart.id })
        .from(cart)
        .where(eq(cart.id, buyerCart.id))
        .for("update");
      if (!lockedCart.length) {
        throw new Error("Your cart is empty.");
      }

      const liveCartItems = await tx
        .select({
          id: cartItem.id,
          quantity: cartItem.quantity,
          dealerListingId: dealerListing.id,
          listingStatus: dealerListing.status,
          firmId: dealerListing.firmId,
          stock: inventory.quantity,
          partName: part.name,
        })
        .from(cartItem)
        .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
        .innerJoin(part, eq(dealerListing.partId, part.id))
        .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
        .where(eq(cartItem.cartId, buyerCart.id))
        .for("update");
      if (!liveCartItems.length) {
        throw new Error("Your cart is empty.");
      }
      if (liveCartItems.length !== cartItems.length) {
        throw new Error("Your cart changed. Please review and try again.");
      }

      const liveById = new Map(liveCartItems.map((row) => [row.id, row]));
      for (const item of cartItems) {
        const live = liveById.get(item.id);
        if (
          !live ||
          live.quantity !== item.quantity ||
          live.dealerListingId !== item.dealerListingId ||
          live.listingStatus !== "active" ||
          !live.firmId ||
          !isAllowedFirmId(live.firmId)
        ) {
          throw new Error("Your cart changed. Please review and try again.");
        }
      }

      // Existing checkout decrements live stock in this transaction.
      // This is not a separate reservation system; do not invent one here.
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

      const requestedShippingMethod =
        typeof body.shippingMethod === "string" ? body.shippingMethod : "";
      const shippingMethod = ["self_pickup", "transport", "courier"].includes(
        requestedShippingMethod,
      )
        ? requestedShippingMethod
        : "courier";
      const transportName = typeof body?.transportName === "string" ? body.transportName.trim() : null;
      const transportPhone = typeof body?.transportPhone === "string" ? body.transportPhone.trim() : null;
      const transportGstin = typeof body?.transportGstin === "string" ? body.transportGstin.trim().toUpperCase() : null;

      await tx.insert(order).values({
        id: orderId,
        orderNumber,
        buyerId: session.user.id,
        status: "placed",
        paymentStatus: "pending",
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

      const createdItems = pricedLines.map(({ item, priced }) => {
        return {
          id: randomUUID(),
          orderId,
          dealerListingId: item.dealerListingId,
          dealerId: item.dealerId,
          partId: item.partId,
          partNumber: item.partNumber,
          partName: item.partName,
          quantity: item.quantity,
          unitPricePaise: priced.netInclusivePaise,
          totalPaise: priced.lineNetPaise,
        };
      });
      await tx.insert(orderItem).values(createdItems);

      const createdByListing = new Map(
        createdItems.map((item) => [item.dealerListingId, item]),
      );
      for (const allocation of firmSplit.allocations) {
        const items = allocation.items.map((line) => {
          const created = createdByListing.get(line.listingId);
          if (!created) {
            throw new Error(
              "This listing is not assigned to a fulfillment firm.",
            );
          }
          return created;
        });
        const firmOrderId = randomUUID();
        const allocationNumber = `SLA-${orderNumber}-${allocation.firmId.slice(0, 6).toUpperCase()}`;
        await tx.insert(firmOrder).values({
          id: firmOrderId,
          orderId,
          firmId: allocation.firmId,
          allocationNumber,
          amountPaise: allocation.amountPaise,
          fulfillmentStatus: "pending",
          paymentStatus: "unpaid",
          paymentAccountingReference: `SPL-${orderNumber}-${allocation.firmId.slice(0, 8).toUpperCase()}`,
        });
        await tx.insert(firmOrderItem).values(
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
    console.error("Checkout failed");
    const known =
      error instanceof Error &&
      (error.message.endsWith("is no longer available.") ||
        error.message === "This listing is not assigned to a fulfillment firm." ||
        error.message === "Your cart is empty." ||
        error.message === "Your cart changed. Please review and try again.");
    return NextResponse.json(
      {
        error: known
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
      paymentStatus: "pending",
      firmAllocations: firmSplit.allocations.map((allocation) => ({
        firmId: allocation.firmId,
        firmName: allocation.firmName,
        amountPaise: allocation.amountPaise,
        gstPaise: allocation.gstPaise,
        itemCount: allocation.items.length,
      })),
    },
    { status: 201 },
  );
}
