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
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { isCashfreeConfiguredForFirm } from "@/lib/cashfree";
import { requireBuyerApi } from "@/lib/require-role";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { ignoreCheckoutClientOverrides } from "@/lib/party-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import {
  authorizedPensolSettlement,
  priceStorefrontLines,
} from "@/lib/storefront-line-price";
import {
  buildParentOrderPlan,
  CheckoutError,
  isUniqueConstraintError,
  parseCheckoutIdempotencyKey,
  type CheckoutCartLine,
} from "@/lib/checkout-order";
import type { ParentPaymentMethod } from "@/lib/firms";

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

function checkoutErrorResponse(error: unknown) {
  if (error instanceof CheckoutError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const known =
    error instanceof Error &&
    (error.message.endsWith("is no longer available.") ||
      error.message.endsWith("requested quantity.") ||
      error.message === "This listing is not assigned to a fulfillment firm." ||
      error.message.endsWith("fulfillment firm.") ||
      error.message === "Your cart is empty." ||
      error.message === "Your cart changed. Please review and try again.");
  console.error("Checkout failed");
  return NextResponse.json(
    {
      error: known
        ? error.message
        : "Unable to place your order. Please try again.",
    },
    { status: 409 },
  );
}

export async function GET() {
  const auth = await requireBuyerApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getDb();
  const orders = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotalPaise: order.subtotalPaise,
      gstPaise: order.gstPaise,
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
  const items = await db
    .select({
      orderId: orderItem.orderId,
      id: orderItem.id,
      partName: orderItem.partName,
      partNumber: orderItem.partNumber,
      partBrand: orderItem.partBrand,
      sku: orderItem.sku,
      firmId: orderItem.firmId,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      gstRate: orderItem.gstRate,
      gstPaise: orderItem.lineGstPaise,
      totalPaise: orderItem.totalPaise,
    })
    .from(orderItem)
    .where(inArray(orderItem.orderId, orderIds));

  const allocations = await db
    .select({
      orderId: firmOrder.orderId,
      id: firmOrder.id,
      firmId: firmOrder.firmId,
      firmName: firm.name,
      firmCode: firm.code,
      allocationNumber: firmOrder.allocationNumber,
      subtotalPaise: firmOrder.subtotalPaise,
      gstPaise: firmOrder.gstPaise,
      totalPaise: firmOrder.amountPaise,
      fulfillmentStatus: firmOrder.fulfillmentStatus,
      paymentStatus: firmOrder.paymentStatus,
      paymentMethod: firmOrder.paymentMethod,
      invoiceReference: firmOrder.invoiceReference,
      paymentReference: firmOrder.paymentAccountingReference,
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .where(inArray(firmOrder.orderId, orderIds));

  const allocationItemRows = allocations.length
    ? await db
        .select({
          firmOrderId: firmOrderItem.firmOrderId,
          orderItemId: firmOrderItem.orderItemId,
        })
        .from(firmOrderItem)
        .where(
          inArray(
            firmOrderItem.firmOrderId,
            allocations.map((item) => item.id),
          ),
        )
    : [];

  return NextResponse.json({
    orders: orders.map((item) => {
      const gstPaise =
        item.gstPaise ||
        Math.max(
          0,
          item.totalPaise - item.subtotalPaise - (item.shippingPaise ?? 0),
        );
      const orderAllocations = allocations.filter(
        (allocation) => allocation.orderId === item.id,
      );
      return {
        ...item,
        gstPaise,
        items: items.filter((orderLine) => orderLine.orderId === item.id),
        allocations: orderAllocations.map((allocation) => ({
          ...allocation,
          itemIds: allocationItemRows
            .filter((row) => row.firmOrderId === allocation.id)
            .map((row) => row.orderItemId),
        })),
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireBuyerApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const rawBody = await request.json().catch(() => null);
  const body = ignoreCheckoutClientOverrides(
    (rawBody && typeof rawBody !== "object"
      ? {}
      : ((rawBody as Record<string, unknown> | null) ?? {})) as Record<
      string,
      unknown
    >,
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
  const idempotencyKey = parseCheckoutIdempotencyKey(
    request.headers.get("idempotency-key") ?? body?.idempotencyKey,
  );

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
  const parentPaymentMethod = paymentMethod as ParentPaymentMethod;

  const db = getDb();

  if (idempotencyKey) {
    const existing = await db.query.order.findFirst({
      where: and(
        eq(order.buyerId, session.user.id),
        eq(order.checkoutIdempotencyKey, idempotencyKey),
      ),
    });
    if (existing) {
      return NextResponse.json(
        {
          id: existing.id,
          orderNumber: existing.orderNumber,
          subtotalPaise: existing.subtotalPaise,
          gstPaise: existing.gstPaise,
          shippingPaise: existing.shippingPaise,
          totalPaise: existing.totalPaise,
          status: existing.status,
          duplicate: true,
        },
        { status: 200 },
      );
    }
  }

  const buyerCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });

  if (!buyerCart) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const settlementResult = authorizedPensolSettlement(body.pensolSettlement);
  if (settlementResult.error) {
    return NextResponse.json({ error: settlementResult.error }, { status: 400 });
  }

  const pricing = await resolveStorefrontPricing(session);
  const pensolConfigs = await resolvePensolConfigsForUser(session.user.id);

  const orderId = randomUUID();
  const orderNumber = `SL-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 6).toUpperCase()}`;

  const requestedShippingMethod =
    typeof body.shippingMethod === "string" ? body.shippingMethod : "";
  const shippingMethod = ["self_pickup", "transport", "courier"].includes(
    requestedShippingMethod,
  )
    ? requestedShippingMethod
    : "courier";
  const transportName =
    typeof body?.transportName === "string" ? body.transportName.trim() : null;
  const transportPhone =
    typeof body?.transportPhone === "string" ? body.transportPhone.trim() : null;
  const transportGstin =
    typeof body?.transportGstin === "string"
      ? body.transportGstin.trim().toUpperCase()
      : null;

  let createdTotals = {
    subtotalPaise: 0,
    gstPaise: 0,
    shippingPaise: 0,
    totalPaise: 0,
  };

  try {
    await db.transaction(async (tx) => {
      const lockedCart = await tx
        .select({ id: cart.id })
        .from(cart)
        .where(eq(cart.id, buyerCart.id))
        .for("update");
      if (!lockedCart.length) {
        throw new CheckoutError("Your cart is empty.", 400);
      }

      const lockedItems = await tx
        .select({
          id: cartItem.id,
          dealerListingId: cartItem.dealerListingId,
        })
        .from(cartItem)
        .where(eq(cartItem.cartId, buyerCart.id))
        .for("update");

      if (!lockedItems.length) {
        throw new CheckoutError("Your cart is empty.", 400);
      }

      const listingIds = lockedItems.map((item) => item.dealerListingId);
      await tx
        .select({ id: inventory.id })
        .from(inventory)
        .where(inArray(inventory.dealerListingId, listingIds))
        .for("update");

      const liveCartItems = await tx
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
          partBrand: part.brand,
          sku: dealerListing.sku,
          partDescription: part.description,
          partSpecifications: part.specifications,
        })
        .from(cartItem)
        .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
        .innerJoin(part, eq(dealerListing.partId, part.id))
        .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
        .where(eq(cartItem.cartId, buyerCart.id));

      const cartLines: CheckoutCartLine[] = liveCartItems.map((item) => ({
        dealerListingId: item.dealerListingId,
        dealerId: item.dealerId,
        firmId: item.firmId,
        quantity: item.quantity,
        pricePaise: item.pricePaise,
        listingStatus: item.listingStatus,
        stock: item.stock,
        partId: item.partId,
        partNumber: item.partNumber,
        partName: item.partName,
        partBrand: item.partBrand,
        sku: item.sku,
      }));

      if (parentPaymentMethod === "online_payment") {
        const hasOnlineCapableFirm = cartLines.some(
          (item) =>
            typeof item.firmId === "string" &&
            isCashfreeConfiguredForFirm(item.firmId),
        );
        if (!hasOnlineCapableFirm) {
          throw new CheckoutError(
            "Online payment is not available for these firms yet. Please choose Cash on Delivery.",
            400,
          );
        }
      }

      const storefront = priceStorefrontLines(
        liveCartItems.map((item) => ({
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

      const plan = buildParentOrderPlan(
        cartLines.map((line, index) => ({
          line,
          gstRate: storefront.priced[index].gstRate,
          priced: storefront.priced[index],
        })),
        parentPaymentMethod,
        orderNumber,
        storefront.totals.shippingPaise,
      );

      createdTotals = {
        subtotalPaise: plan.subtotalPaise,
        gstPaise: plan.gstPaise,
        shippingPaise: plan.shippingPaise,
        totalPaise: plan.totalPaise,
      };

      for (const item of cartLines) {
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
          throw new CheckoutError(`${item.partName} is no longer available.`, 409);
        }
      }

      await tx.insert(order).values({
        id: orderId,
        orderNumber,
        buyerId: session.user.id,
        status: "placed",
        paymentMethod: parentPaymentMethod,
        subtotalPaise: plan.subtotalPaise,
        gstPaise: plan.gstPaise,
        shippingPaise: plan.shippingPaise,
        totalPaise: plan.totalPaise,
        checkoutIdempotencyKey: idempotencyKey,
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

      const createdItems = plan.allocations.flatMap((allocation) =>
        allocation.items.map((item) => ({
          id: randomUUID(),
          orderId,
          dealerListingId: item.dealerListingId,
          dealerId: item.dealerId,
          partId: item.partId,
          partNumber: item.partNumber,
          partName: item.partName,
          partBrand: item.partBrand,
          sku: item.sku,
          firmId: item.firmId,
          quantity: item.quantity,
          listInclusivePaise: item.listInclusivePaise,
          discountPercent: item.discountPercent,
          discountPaise: item.discountPaise,
          unitPricePaise: item.unitPricePaise,
          gstRate: item.gstRate,
          basePaise: item.basePaise,
          gstPaise: item.gstPaise,
          lineDiscountPaise: item.lineDiscountPaise,
          lineBasePaise: item.lineBasePaise,
          lineGstPaise: item.lineGstPaise,
          totalPaise: item.totalPaise,
        })),
      );
      await tx.insert(orderItem).values(createdItems);

      for (const allocation of plan.allocations) {
        const firmOrderId = randomUUID();
        const allocationNumber = `SLA-${orderNumber}-${allocation.firmId.slice(0, 6).toUpperCase()}`;
        await tx.insert(firmOrder).values({
          id: firmOrderId,
          orderId,
          firmId: allocation.firmId,
          allocationNumber,
          amountPaise: allocation.totalPaise,
          subtotalPaise: allocation.subtotalPaise,
          gstPaise: allocation.gstPaise,
          paymentMethod: allocation.paymentMethod,
          invoiceReference: allocation.invoiceReference,
          paymentAccountingReference: `SPL-${orderNumber}-${allocation.firmId.slice(0, 8).toUpperCase()}`,
        });
        const allocationItemIds = createdItems
          .filter((item) => item.firmId === allocation.firmId)
          .map((item) => item.id);
        await tx.insert(firmOrderItem).values(
          allocationItemIds.map((orderItemId) => ({
            id: randomUUID(),
            firmOrderId,
            orderItemId,
          })),
        );
      }

      await tx.delete(cartItem).where(eq(cartItem.cartId, buyerCart.id));
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      const existing = await db.query.order.findFirst({
        where: and(
          eq(order.buyerId, session.user.id),
          eq(order.checkoutIdempotencyKey, idempotencyKey),
        ),
      });
      if (existing) {
        return NextResponse.json(
          {
            id: existing.id,
            orderNumber: existing.orderNumber,
            subtotalPaise: existing.subtotalPaise,
            gstPaise: existing.gstPaise,
            shippingPaise: existing.shippingPaise,
            totalPaise: existing.totalPaise,
            status: existing.status,
            duplicate: true,
          },
          { status: 200 },
        );
      }
    }
    return checkoutErrorResponse(error);
  }

  return NextResponse.json(
    {
      id: orderId,
      orderNumber,
      subtotalPaise: createdTotals.subtotalPaise,
      gstPaise: createdTotals.gstPaise,
      shippingPaise: createdTotals.shippingPaise,
      totalPaise: createdTotals.totalPaise,
      status: "placed",
    },
    { status: 201 },
  );
}
