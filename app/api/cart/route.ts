import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth-server";
import { isBuyerRole } from "@/lib/auth-policy";
import { denyIfMustChangePassword } from "@/lib/require-role";
import {
  cart,
  cartItem,
  dealer,
  dealerListing,
  firm,
  inventory,
  part,
} from "@/drizzle/schema";
import { extractGSTRate } from "@/lib/gst";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import { isAllowedFirmId } from "@/lib/firms";
import {
  validateAvailableStock,
  validateCartQuantity,
} from "@/lib/order-architecture";
import { ignoreClientPricing } from "@/lib/party-pricing";
import { priceStorefrontLines } from "@/lib/storefront-line-price";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { catalogueImagePublicPath } from "@/lib/catalogue-image-index";

function resolveCartImageUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = catalogueImagePublicPath(candidate);
    if (url) return url;
  }
  return null;
}

async function getBuyerSession() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  if (!isBuyerRole(session.user.role)) {
    return null;
  }

  return session;
}

async function rejectUnreadyBuyer() {
  const session = await getBuyerSession();
  if (!session) return { session: null as Awaited<ReturnType<typeof getBuyerSession>>, blocked: null };
  const blocked = await denyIfMustChangePassword(session.user.id);
  return { session: blocked ? null : session, blocked };
}

export async function GET() {
  const { session, blocked } = await rejectUnreadyBuyer();
  if (blocked) return blocked;

  if (!session) {
    return NextResponse.json({
      id: null,
      items: [],
      subtotalPaise: 0,
      gstPaise: 0,
      shippingPaise: 0,
      totalPaise: 0,
      itemCount: 0,
      requiresLogin: true,
    });
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
      partSpecifications: part.specifications,
      sku: dealerListing.sku,
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

  const pricing = await resolveStorefrontPricing(session);
  const pensolConfigs = await resolvePensolConfigsForUser(session.user.id);
  const lineRefs = rawItems.map((item) => ({
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
  }));
  const cash = priceStorefrontLines(
    lineRefs,
    pricing.effectiveDiscountPercent,
    "cash",
    pensolConfigs.commonConfig,
    pensolConfigs.customerConfig,
  );
  const credit = priceStorefrontLines(
    lineRefs,
    pricing.effectiveDiscountPercent,
    "credit",
    pensolConfigs.commonConfig,
    pensolConfigs.customerConfig,
  );
  const totals = cash.totals;
  const items = rawItems.map((item, index) => {
    const line = cash.priced[index];
    const creditLine = credit.priced[index];
    return {
      ...item,
      imageUrl: resolveCartImageUrl(item.sku, item.partNumber),
      gstRate: line.gstRate,
      listInclusivePaise: line.listInclusivePaise,
      netInclusivePaise: line.netInclusivePaise,
      discountPercent: line.discountPercent,
      discountPaise: line.discountPaise,
      itemSubtotalPaise: line.lineBasePaise,
      itemGstPaise: line.lineGstPaise,
      itemTotalPaise: line.lineNetPaise,
      isPensol: line.pensol,
      pensolCategory: line.resolved.category,
      pensolUnit: line.resolved.unit,
      pensolPackUnits: line.resolved.packUnits,
      pensolCashDiscountPaisePerUnit: line.resolved.cashDiscountPaisePerUnit,
      pensolCreditDiscountPaisePerUnit: line.resolved.creditDiscountPaisePerUnit,
      pensolCashNetInclusivePaise: line.netInclusivePaise,
      pensolCreditNetInclusivePaise: creditLine.netInclusivePaise,
    };
  });

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return NextResponse.json({
    id: existingCart.id,
    items,
    subtotalPaise: totals.subtotalPaise,
    gstPaise: totals.gstPaise,
    shippingPaise: totals.shippingPaise,
    totalPaise: totals.totalPaise,
    listPaise: totals.listPaise,
    discountPaise: totals.discountPaise,
    discountPercent: pricing.effectiveDiscountPercent,
    itemCount,
    hasPensol: cash.hasPensol,
    pensolCashTotalPaise: cash.totals.totalPaise,
    pensolCreditTotalPaise: credit.totals.totalPaise,
  });
}

export async function POST(request: Request) {
  const { session, blocked } = await rejectUnreadyBuyer();
  if (blocked) return blocked;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = ignoreClientPricing(
    ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {},
  );

  const dealerListingId = body?.dealerListingId;
  const quantityResult = validateCartQuantity(body?.quantity);

  if (typeof dealerListingId !== "string" || !dealerListingId || !quantityResult.ok) {
    return NextResponse.json(
      { error: "dealerListingId and positive integer quantity are required" },
      { status: 400 },
    );
  }
  const quantity = quantityResult.quantity;

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
    !selectedListing.firmId ||
    !isAllowedFirmId(selectedListing.firmId)
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

  if (!isAuthoritativeSellingPricePaise(selectedListing.pricePaise)) {
    return NextResponse.json(
      {
        error:
          "This product is available on request and cannot be added to the cart.",
      },
      { status: 400 },
    );
  }

  const stockCheck = validateAvailableStock(quantity, selectedListing.stock);
  if (!stockCheck.ok) {
    return NextResponse.json({ error: stockCheck.error }, { status: 400 });
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

    const combinedStock = validateAvailableStock(newQuantity, selectedListing.stock);
    if (!combinedStock.ok) {
      return NextResponse.json({ error: combinedStock.error }, { status: 400 });
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
  const { session, blocked } = await rejectUnreadyBuyer();
  if (blocked) return blocked;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = ignoreClientPricing(
    ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {},
  );
  const cartItemId = body?.cartItemId || body?.id;
  const quantityResult = validateCartQuantity(body?.quantity);

  if (typeof cartItemId !== "string" || !cartItemId || !quantityResult.ok) {
    return NextResponse.json(
      {
        error: quantityResult.ok
          ? "cartItemId and integer quantity are required"
          : quantityResult.error,
      },
      { status: 400 },
    );
  }
  const quantity = quantityResult.quantity;

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

  if (
    target.listingStatus !== "active" ||
    !target.firmId ||
    !isAllowedFirmId(target.firmId)
  ) {
    return NextResponse.json(
      { error: "This item is no longer available." },
      { status: 400 },
    );
  }

  if (!isAuthoritativeSellingPricePaise(target.listingPricePaise)) {
    return NextResponse.json(
      {
        error:
          "This product is available on request and cannot be purchased online.",
      },
      { status: 400 },
    );
  }

  const stockCheck = validateAvailableStock(quantity, target.stock);
  if (!stockCheck.ok) {
    return NextResponse.json(
      {
        error: `Only ${target.stock ?? 0} unit${(target.stock ?? 0) === 1 ? "" : "s"} available in stock for ${target.partName || "this item"}.`,
        availableStock: target.stock ?? 0,
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
  const { session, blocked } = await rejectUnreadyBuyer();
  if (blocked) return blocked;

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
