import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { recordOrderEvent } from "@/lib/analytics/commerce";
import { writeAuditLog } from "@/lib/audit";

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
  stockAdjustment,
} from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { isCodEnabledForFirm } from "@/lib/bank-payment-config";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { isCashfreeConfiguredForFirm } from "@/lib/cashfree";
import {
  SPARELINK_FIRMS,
  cartSupportsParentOnlinePayment,
  isAllowedFirmId,
  type ParentPaymentMethod,
} from "@/lib/firms";
import { orderableFirmIds } from "@/lib/firm-availability";
import { resolveCreditSettlementEntitlement } from "@/lib/credit-entitlement";
import { validateGSTIN } from "@/lib/gst";
import { resolveGstSplit, stateCodeFromName } from "@/lib/gst-split";
import { resolveFirmStateCodes } from "@/lib/firm-availability";
import {
  buildCheckoutIdempotencyStorageKey,
  buildParentOrderPlan,
  checkoutIdempotencyStorageMatches,
  checkoutIdempotencyStoragePattern,
  CheckoutError,
  parseCheckoutIdempotencyKey,
} from "@/lib/checkout-order";
import {
  validateAvailableStock,
  validateCartQuantity,
} from "@/lib/order-architecture";
import { CHECKOUT_STOCK_ADJUSTMENT_REASON } from "@/lib/order-cancel-restock";
import { denyIfMustChangePassword } from "@/lib/require-role";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { ignoreClientPricing } from "@/lib/party-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import {
  authorizedPensolSettlement,
  priceStorefrontLines,
} from "@/lib/storefront-line-price";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { throttleRoute } from "@/lib/throttle-route";

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

type OrderDb = ReturnType<typeof getDb>;

async function findIdempotentOrder(
  db: OrderDb,
  buyerId: string,
  rawKey: string,
) {
  return db.query.order.findFirst({
    where: and(
      eq(order.buyerId, buyerId),
      or(
        eq(order.checkoutIdempotencyKey, rawKey),
        like(
          order.checkoutIdempotencyKey,
          checkoutIdempotencyStoragePattern(buyerId, rawKey),
        ),
      ),
    ),
  });
}

/**
 * Read the order's own lines and hand them to the analytics writer.
 *
 * The line snapshot (part number, name, brand, listing id) is read from the order's
 * own rows rather than reconstructed from the request body, so what is recorded is
 * what was actually bought.
 */
async function recordOrderAnalytics(db: OrderDb, orderId: string): Promise<void> {
  const orderRecord = await db.query.order.findFirst({ where: eq(order.id, orderId) });
  if (!orderRecord) return;

  const lines = await db
    .select({
      partId: orderItem.partId,
      partNumber: orderItem.partNumber,
      partName: orderItem.partName,
      dealerListingId: orderItem.dealerListingId,
      quantity: orderItem.quantity,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));

  const partIds = [...new Set(lines.map((line) => line.partId).filter(Boolean))];
  const brands = partIds.length
    ? await db
        .select({ id: part.id, brand: part.brand })
        .from(part)
        .where(inArray(part.id, partIds))
    : [];
  const brandById = new Map(brands.map((row) => [row.id, row.brand]));

  await recordOrderEvent({
    orderId,
    buyerId: orderRecord.buyerId,
    lines: lines.map((line) => ({
      partId: line.partId,
      partNumber: line.partNumber,
      productName: line.partName,
      brand: brandById.get(line.partId) ?? null,
      quantity: line.quantity,
      dealerListingId: line.dealerListingId,
    })),
  });
}

async function orderResponse(
  db: OrderDb,
  orderId: string,
  status: 200 | 201,
) {
  const orderRecord = await db.query.order.findFirst({
    where: eq(order.id, orderId),
  });
  if (!orderRecord) return null;

  /* Customer Intelligence & Experience Analytics: order attribution.
   *
   * Fired once the order row exists, never awaited into the response. An order is
   * revenue and a funnel figure is observability, so analytics can be dropped,
   * slow or broken without affecting this response in any way.
   *
   * The firm for each line is resolved from the dealer_listing chain on the SERVER
   * inside `recordOrderEvent`, and no amount is ever recorded. See
   * `lib/analytics/commerce.ts`. */
  if (status === 201) {
    void recordOrderAnalytics(db, orderId).catch(() => undefined);
  }

  const allocations = await db
    .select({
      firmId: firmOrder.firmId,
      firmName: firm.name,
      amountPaise: firmOrder.amountPaise,
      gstPaise: firmOrder.gstPaise,
      itemCount: count(firmOrderItem.orderItemId),
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .leftJoin(firmOrderItem, eq(firmOrder.id, firmOrderItem.firmOrderId))
    .where(eq(firmOrder.orderId, orderId))
    .groupBy(firmOrder.id, firm.name);

  return NextResponse.json(
    {
      id: orderRecord.id,
      orderNumber: orderRecord.orderNumber,
      subtotalPaise: orderRecord.subtotalPaise,
      gstPaise: orderRecord.gstPaise,
      shippingPaise: orderRecord.shippingPaise,
      totalPaise: orderRecord.totalPaise,
      status: orderRecord.status,
      paymentStatus: orderRecord.paymentStatus,
      firmAllocations: allocations.map((allocation) => ({
        firmId: allocation.firmId,
        firmName: allocation.firmName,
        amountPaise: allocation.amountPaise,
        gstPaise: allocation.gstPaise,
        itemCount: allocation.itemCount,
      })),
    },
    { status },
  );
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
      const gstPaise =
        item.gstPaise > 0
          ? item.gstPaise
          : Math.max(
              0,
              item.totalPaise - item.subtotalPaise - (item.shippingPaise ?? 0),
            );
      return {
        ...item,
        gstPaise,
        items: items.filter((orderItemRow) => orderItemRow.orderId === item.id),
        firmAllocations: allocations.filter(
          (allocation) => allocation.orderId === item.id,
        ),
      };
    }),
  });
}

export function unexpectedCheckoutErrorResponse() {
  return NextResponse.json(
    { error: "Unable to place your order. Please try again." },
    { status: 500 },
  );
}

async function handlePost(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const rawIdempotencyKey = parseCheckoutIdempotencyKey(
    request.headers.get("Idempotency-Key"),
  );
  if (!rawIdempotencyKey) {
    return NextResponse.json(
      { error: "A valid Idempotency-Key header is required." },
      { status: 400 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const body = ignoreClientPricing(
    (rawBody && typeof rawBody === "object"
      ? (rawBody as Record<string, unknown>)
      : {}) as Record<string, unknown>,
  );
  const shippingAddress = parseShippingAddress(body?.shippingAddress);
  const paymentMethod = body?.paymentMethod;
  const rawBuyerGstin =
    typeof body?.buyerGstin === "string" && body.buyerGstin.trim()
      ? body.buyerGstin.trim().toUpperCase()
      : undefined;

  // A GSTIN printed on a tax invoice must be well formed. The previous
  // implementation only upper-cased it, so any string at all reached the
  // invoice and the Excel export. Reject rather than silently drop: silently
  // dropping would make a B2B buyer's invoice quietly B2C.
  let buyerGstin: string | undefined;
  if (rawBuyerGstin) {
    const gstinCheck = validateGSTIN(rawBuyerGstin);
    if (!gstinCheck.valid) {
      return NextResponse.json(
        {
          error:
            gstinCheck.message ||
            "Please provide a valid 15-character GSTIN, or leave it blank for a retail purchase.",
        },
        { status: 400 },
      );
    }
    buyerGstin = rawBuyerGstin;
  }

  const buyerBusinessName =
    typeof body?.buyerBusinessName === "string" && body.buyerBusinessName.trim()
      ? body.buyerBusinessName.trim().slice(0, 120)
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
  const existingOrder = await findIdempotentOrder(
    db,
    session.user.id,
    rawIdempotencyKey,
  );
  const buyerCart = await db.query.cart.findFirst({
    where: eq(cart.buyerId, session.user.id),
  });
  const loadCartItems = async (cartId: string) =>
    db
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
      .where(eq(cartItem.cartId, cartId));

  if (existingOrder) {
    const replayCartItems = buyerCart ? await loadCartItems(buyerCart.id) : [];
    if (
      !checkoutIdempotencyStorageMatches(
        existingOrder.checkoutIdempotencyKey,
        session.user.id,
        rawIdempotencyKey,
        body,
        replayCartItems,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This Idempotency-Key was already used with a different checkout request.",
        },
        { status: 409 },
      );
    }
    const replayResponse = await orderResponse(db, existingOrder.id, 200);
    return replayResponse ?? NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!buyerCart) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const cartItems = await loadCartItems(buyerCart.id);

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

  // Firm availability. `isAllowedFirmId` above only proves the id is one of the
  // three canonical firms; it does not prove the firm is still active. An
  // inactive firm must not be able to take an order, so the active set is
  // resolved once and every cart line is checked against it.
  const cartFirmIds = [
    ...new Set(
      cartItems
        .map((item) => item.firmId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const orderableFirms = new Set(await orderableFirmIds(cartFirmIds));
  const inactiveFirmItem = cartItems.find(
    (item) => !item.firmId || !orderableFirms.has(item.firmId),
  );
  if (inactiveFirmItem) {
    return NextResponse.json(
      {
        error: `${inactiveFirmItem.partName} is temporarily unavailable. Please contact us for an alternative.`,
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

  // Credit settlement is a commercial entitlement, so it is resolved from the
  // database rather than accepted from the request body. The dealer must have
  // a positive credit limit with headroom, and the parent order must be paying
  // by bank transfer, which is the only mode a credit sale settles against.
  const creditEntitlement = await resolveCreditSettlementEntitlement({
    buyerId: session.user.id,
    paymentMethod,
  });

  const settlementResult = authorizedPensolSettlement(body.pensolSettlement, {
    creditSettlementAllowed: creditEntitlement.allowed,
  });
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
  const pricedCheckoutLines = cartItems.map((item, index) => ({
    line: {
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
    },
    gstRate: storefront.priced[index].gstRate,
    priced: storefront.priced[index],
  }));

  /**
 * Resolve the immutable HSN and UOM for a line from the catalogue record.
 *
 * Read HERE, at order time, and stored on the order item. Previously the
 * invoice re-derived HSN from live catalogue prose on demand, which meant a
 * later catalogue edit could rewrite a historical tax document.
 *
 * Returns null when the catalogue has no value. Nothing is invented: an invoice
 * line with a dash for HSN is honest, a fabricated code is not.
 */
function resolveHsnAndUom(specifications?: string | null): {
  hsn: string | null;
  uom: string | null;
} {
  if (!specifications) return { hsn: null, uom: null };
  try {
    const parsed = JSON.parse(specifications) as Record<string, unknown> | null;
    const hsn = typeof parsed?.hsn === "string" ? parsed.hsn.trim() || null : null;
    const uomRaw = parsed?.uom ?? parsed?.unit ?? parsed?.uomShort;
    const uom =
      typeof uomRaw === "string" && uomRaw.trim()
        ? uomRaw.trim().toUpperCase()
        : null;
    return { hsn, uom };
  } catch {
    return { hsn: null, uom: null };
  }
}

/**
 * Snapshot the CGST/SGST vs IGST presentation per order line.
 *
 * Resolved from the order's place of supply and the fulfilling firm's state
 * code, both read from the database. When either is unknown the columns stay
 * zero and the invoice prints a single undivided GST line, which is honest;
 * a guessed split would be a filing error.
 *
 * CGST takes the rounded half so the pair sums back to lineGstPaise exactly.
 */
const orderableFirmsForTax = await orderableFirmIds(cartFirmIds);
const firmStateById = await resolveFirmStateCodes(orderableFirmsForTax);
// `shippingAddress` was already null-checked above; captured into a const so the
// narrowing survives into this closure.
const orderStateName = shippingAddress?.state ?? "";
const orderPlaceOfSupplyCode = stateCodeFromName(orderStateName);

// HSN/UOM resolved once per cart line and written onto the order item.
const hsnByListingId = new Map<string, string>();
const uomByListingId = new Map<string, string>();
for (const item of cartItems) {
  const resolved = resolveHsnAndUom(item.partSpecifications);
  if (resolved.hsn) hsnByListingId.set(item.dealerListingId, resolved.hsn);
  if (resolved.uom) uomByListingId.set(item.dealerListingId, resolved.uom);
}

function taxBreakupFor(
  snap: { lineGstPaise: number; firmId: string },
): {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  placeOfSupplyCode: string | null;
} {
  const split = resolveGstSplit({
    gstPaise: snap.lineGstPaise,
    supplierStateCode: firmStateById.get(snap.firmId) ?? null,
    placeOfSupplyCode: orderPlaceOfSupplyCode,
    placeOfSupplyName: orderStateName,
  });
  return {
    cgstPaise: split.cgstPaise,
    sgstPaise: split.sgstPaise,
    igstPaise: split.igstPaise,
    placeOfSupplyCode: orderPlaceOfSupplyCode,
  };
}

  const checkoutIdempotencyKey = buildCheckoutIdempotencyStorageKey(
    session.user.id,
    rawIdempotencyKey,
    body,
    cartItems,
  );
  const orderId = randomUUID();
  const orderNumber = `SL-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 6).toUpperCase()}`;

  let parentPlan;
  try {
    parentPlan = buildParentOrderPlan(
      pricedCheckoutLines,
      paymentMethod as ParentPaymentMethod,
      orderNumber,
      storefront.totals.shippingPaise,
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
  const firmNameById = new Map(
    SPARELINK_FIRMS.map((row) => [row.id, row.name] as const),
  );

  // Resolved once, immediately before the transaction, from the same set the
  // pre-check used. The in-transaction loop re-tests membership so a firm that
  // was deactivated in the intervening milliseconds cannot be allocated.
  const transactionOrderableFirms = new Set(orderableFirms);

  // Normalised out here rather than inside the transaction, for one reason: the
  // audit row written after the commit has to record the shipping method that was
  // ACTUALLY used. Keeping the rule inside the transaction would have meant
  // duplicating it outside to read it, and two copies of a defaulting rule is how
  // an audit trail starts disagreeing with the order.
  const requestedShippingMethod =
    typeof body.shippingMethod === "string" ? body.shippingMethod : "";
  const shippingMethod = ["self_pickup", "transport", "courier"].includes(
    requestedShippingMethod,
  )
    ? requestedShippingMethod
    : "courier";

  let replayOrderId: string | null = null;
  try {
    const transactionResult = await db.transaction(async (tx) => {
      const lockedCart = await tx
        .select({ id: cart.id })
        .from(cart)
        .where(eq(cart.id, buyerCart.id))
        .for("update");
      if (!lockedCart.length) {
        throw new Error("Your cart is empty.");
      }

      const concurrentOrder = await tx
        .select({
          id: order.id,
          checkoutIdempotencyKey: order.checkoutIdempotencyKey,
        })
        .from(order)
        .where(
          and(
            eq(order.buyerId, session.user.id),
            or(
              eq(order.checkoutIdempotencyKey, rawIdempotencyKey),
              like(
                order.checkoutIdempotencyKey,
                checkoutIdempotencyStoragePattern(session.user.id, rawIdempotencyKey),
              ),
            ),
          ),
        )
        .limit(1);
      if (concurrentOrder.length) {
        if (
          !checkoutIdempotencyStorageMatches(
            concurrentOrder[0].checkoutIdempotencyKey,
            session.user.id,
            rawIdempotencyKey,
            body,
            cartItems,
          )
        ) {
          throw new Error("IDEMPOTENCY_KEY_REUSED");
        }
        return { replayOrderId: concurrentOrder[0].id };
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
          // Re-read inside the transaction so the in-transaction comparison can
          // detect a concurrent price edit instead of committing a stale one.
          pricePaise: dealerListing.pricePaise,
        })
        .from(cartItem)
        .innerJoin(dealerListing, eq(cartItem.dealerListingId, dealerListing.id))
        .innerJoin(part, eq(dealerListing.partId, part.id))
        .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
        .where(eq(cartItem.cartId, buyerCart.id))
        .for("update", { of: [cartItem, dealerListing, part] });
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
          !isAllowedFirmId(live.firmId) ||
          // Firm re-checked inside the transaction so a firm deactivated
          // between the pre-check and here cannot be allocated.
          !transactionOrderableFirms.has(live.firmId) ||
          // Price re-checked inside the transaction. The order was priced from
          // the pre-transaction snapshot, so an admin price edit landing in that
          // window would otherwise be committed at the stale value. Comparing
          // here closes that TOCTOU window.
          live.pricePaise !== item.pricePaise
        ) {
          throw new Error("Your cart changed. Please review and try again.");
        }
      }

      // Existing checkout decrements live stock in this transaction.
      // This is not a separate reservation system; do not invent one here.
      //
      // Every decrement is ALSO recorded as a `stock_adjustment` in this same
      // transaction. That record is the durable proof of how much stock this
      // order actually removed, which is what lets cancellation restock
      // reconcile later instead of blindly adding the ordered quantity back
      // (see `lib/order-cancel-restock.ts`). If this transaction rolls back,
      // both the decrement and the adjustment roll back together.
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
          // `returning` gives the authoritative post-decrement quantity, so the
          // recorded previous/new pair cannot drift from the real movement.
          .returning({
            id: inventory.id,
            quantity: inventory.quantity,
            warehouseCode: inventory.warehouseCode,
          });

        if (!updated.length) {
          throw new Error(`${item.partName} is no longer available.`);
        }

        const inventoryRow = updated[0];
        const newQuantity = inventoryRow.quantity;
        await tx.insert(stockAdjustment).values({
          id: randomUUID(),
          inventoryId: inventoryRow.id,
          dealerListingId: item.dealerListingId,
          actorUserId: session.user.id,
          previousQuantity: newQuantity + item.quantity,
          newQuantity,
          delta: -item.quantity,
          // Stable machine-readable reason. The order number is carried by
          // referenceType/referenceId, not interpolated here, so the row stays
          // reliably matchable.
          reason: CHECKOUT_STOCK_ADJUSTMENT_REASON,
          warehouseCode: inventoryRow.warehouseCode || "MAIN",
          referenceType: "order",
          referenceId: orderId,
        });
      }

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
        subtotalPaise: parentPlan.subtotalPaise,
        gstPaise: parentPlan.gstPaise,
        shippingPaise: parentPlan.shippingPaise,
        totalPaise: parentPlan.totalPaise,
        checkoutIdempotencyKey,
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

      const createdItems = parentPlan.allocations.flatMap((allocation) =>
        allocation.items.map((snap) => ({
          id: randomUUID(),
          orderId,
          dealerListingId: snap.dealerListingId,
          dealerId: snap.dealerId,
          partId: snap.partId,
          partNumber: snap.partNumber,
          partName: snap.partName,
          partBrand: snap.partBrand,
          sku: snap.sku,
          firmId: snap.firmId,
          quantity: snap.quantity,
          listInclusivePaise: snap.listInclusivePaise,
          discountPercent: snap.discountPercent,
          discountPaise: snap.discountPaise,
          unitPricePaise: snap.unitPricePaise,
          gstRate: snap.gstRate,
          basePaise: snap.basePaise,
          gstPaise: snap.gstPaise,
          lineDiscountPaise: snap.lineDiscountPaise,
          lineBasePaise: snap.lineBasePaise,
          lineGstPaise: snap.lineGstPaise,
          totalPaise: snap.totalPaise,
          /**
           * Immutable tax snapshot. HSN and UOM are captured HERE, at order
           * time, rather than being re-read from the live catalogue when the
           * invoice is generated. Previously HSN was scraped out of
           * `part.description` on demand, so editing a catalogue record silently
           * rewrote historical invoices.
           */
          hsn: hsnByListingId.get(snap.dealerListingId) ?? null,
          uom: uomByListingId.get(snap.dealerListingId) ?? null,
          ...taxBreakupFor(snap),
        })),
      );
      await tx.insert(orderItem).values(createdItems);

      const createdByListing = new Map(
        createdItems.map((item) => [item.dealerListingId, item]),
      );
      for (const allocation of parentPlan.allocations) {
        const linked = allocation.items.map((snap) => {
          const created = createdByListing.get(snap.dealerListingId);
          if (!created) {
            throw new Error(
              "This listing is not assigned to a fulfillment firm.",
            );
          }
          return created;
        });
        const firmOrderId = randomUUID();
        const allocationNumber =
          allocation.invoiceReference ||
          `SLA-${orderNumber}-${allocation.firmId.slice(0, 6).toUpperCase()}`;
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
          fulfillmentStatus: "pending",
          paymentStatus: "unpaid",
          paymentAccountingReference: `SPL-${orderNumber}-${allocation.firmId.slice(0, 8).toUpperCase()}`,
        });
        await tx.insert(firmOrderItem).values(
          linked.map((item) => ({
            id: randomUUID(),
            firmOrderId,
            orderItemId: item.id,
          })),
        );
      }

      await tx.delete(cartItem).where(eq(cartItem.cartId, buyerCart.id));
       return { replayOrderId: null };
    });
     replayOrderId = transactionResult.replayOrderId;
   } catch (error) {
     const committedOrder = await findIdempotentOrder(
       db,
       session.user.id,
       rawIdempotencyKey,
     );
     if (committedOrder) {
       if (
         checkoutIdempotencyStorageMatches(
           committedOrder.checkoutIdempotencyKey,
           session.user.id,
           rawIdempotencyKey,
           body,
           cartItems,
         )
       ) {
         return (
           (await orderResponse(db, committedOrder.id, 200)) ??
           NextResponse.json({ error: "Order not found" }, { status: 404 })
         );
       }
       return NextResponse.json(
         {
           error:
             "This Idempotency-Key was already used with a different checkout request.",
         },
         { status: 409 },
       );
     }

     console.error("Checkout failed", error);
    const known =
      error instanceof Error &&
      (error.message.endsWith("is no longer available.") ||
        error.message === "This listing is not assigned to a fulfillment firm." ||
        error.message === "Your cart is empty." ||
        error.message === "Your cart changed. Please review and try again." ||
        error.message.includes("not assigned to a SpareLink fulfillment firm"));
    return NextResponse.json(
      {
        error: known
          ? error.message
          : "Unable to place your order. Please try again.",
      },
      { status: 409 },
    );
  }

  if (replayOrderId) {
    return (
      (await orderResponse(db, replayOrderId, 200)) ??
      NextResponse.json({ error: "Order not found" }, { status: 404 })
    );
  }

  // Checkout is the largest single business event this application performs: it
  // creates the order, decrements real stock, writes one stock_adjustment row per
  // line and splits the order across firms. It was the one money-moving write
  // with no audit record at all, so there was no way to answer "who placed this,
  // what did it move, and which firms carried it" from the trail.
  //
  // Written after the transaction commits rather than inside it, deliberately:
  // `writeAuditLog` swallows its own errors so that an audit-table problem can
  // never fail a customer's completed checkout. That trade-off means an audit
  // row can be missing where the order exists, which is why the order id and
  // number are both recorded and why the stock movement itself is separately
  // evidenced by the stock_adjustment rows written inside the transaction.
  await writeAuditLog({
    actorUserId: session.user.id,
    action: "order.place",
    entityType: "order",
    entityId: orderId,
    metadata: {
      orderNumber,
      paymentMethod,
      shippingMethod,
      totalPaise: parentPlan.totalPaise,
      gstPaise: parentPlan.gstPaise,
      shippingPaise: parentPlan.shippingPaise,
      // Per-firm split, because a single order can be an obligation on more than
      // one legal entity and "what was bought" is not the same question as "who
      // owes for it".
      firmAllocations: parentPlan.allocations.map((allocation) => ({
        firmId: allocation.firmId,
        firmName: firmNameById.get(allocation.firmId) ?? allocation.firmId,
        amountPaise: allocation.totalPaise,
        gstPaise: allocation.gstPaise,
        itemCount: allocation.items.length,
      })),
    },
  });

  return NextResponse.json(
    {
      id: orderId,
      orderNumber,
      subtotalPaise: parentPlan.subtotalPaise,
      gstPaise: parentPlan.gstPaise,
      shippingPaise: parentPlan.shippingPaise,
      totalPaise: parentPlan.totalPaise,
      status: "placed",
      paymentStatus: "pending",
      firmAllocations: parentPlan.allocations.map((allocation) => ({
        firmId: allocation.firmId,
        firmName: firmNameById.get(allocation.firmId) ?? allocation.firmId,
        amountPaise: allocation.totalPaise,
        gstPaise: allocation.gstPaise,
        itemCount: allocation.items.length,
      })),
    },
    { status: 201 },
  );
}

export async function POST(request: Request) {
  const throttled = await throttleRoute(request, "checkout");
  if (throttled) return throttled;

  try {
    return await handlePost(request);
  } catch (error) {
    console.error("Checkout request failed", error);
    return unexpectedCheckoutErrorResponse();
  }
}
