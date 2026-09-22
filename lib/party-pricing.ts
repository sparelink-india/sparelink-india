/**
 * GST-inclusive list prices with an inclusive-tax customer discount layer.
 * All money math is integer paise. Discount is applied on the inclusive list
 * price; GST is then extracted from the net inclusive amount.
 */

export type InclusiveDiscount = {
  listInclusivePaise: number;
  discountPercent: number;
  discountPaise: number;
  netInclusivePaise: number;
};

export type InclusiveGstSplit = {
  netInclusivePaise: number;
  gstRate: number;
  basePaise: number;
  gstPaise: number;
};

export type CustomerLinePrice = InclusiveDiscount &
  InclusiveGstSplit & {
    quantity: number;
    lineListPaise: number;
    lineDiscountPaise: number;
    lineNetPaise: number;
    lineBasePaise: number;
    lineGstPaise: number;
  };

export function clampDiscountPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

export function parseDiscountPercentInput(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return clampDiscountPercent(numeric);
}

export function resolveEffectiveDiscountPercent(
  commonCustomerDiscountPercent: number,
  customerDiscountPercent: number | null,
): { effectiveDiscountPercent: number; source: "specific" | "common" } {
  const common = clampDiscountPercent(commonCustomerDiscountPercent) ?? 0;
  if (customerDiscountPercent === null || customerDiscountPercent === undefined) {
    return { effectiveDiscountPercent: common, source: "common" };
  }
  const specific = clampDiscountPercent(customerDiscountPercent) ?? 0;
  return { effectiveDiscountPercent: specific, source: "specific" };
}

export function applyInclusiveDiscount(
  listInclusivePaise: number,
  discountPercent: number,
): InclusiveDiscount {
  const list = Math.max(0, Math.round(listInclusivePaise));
  const percent = clampDiscountPercent(discountPercent) ?? 0;
  const discountPaise = Math.round((list * percent) / 100);
  return {
    listInclusivePaise: list,
    discountPercent: percent,
    discountPaise,
    netInclusivePaise: list - discountPaise,
  };
}

export function splitInclusiveGst(
  netInclusivePaise: number,
  gstRate: number,
): InclusiveGstSplit {
  const net = Math.max(0, Math.round(netInclusivePaise));
  const rate =
    typeof gstRate === "number" && Number.isFinite(gstRate) && gstRate >= 0 && gstRate <= 100
      ? gstRate
      : 18;
  const basePaise = Math.round((net * 100) / (100 + rate));
  return {
    netInclusivePaise: net,
    gstRate: rate,
    basePaise,
    gstPaise: net - basePaise,
  };
}

export function priceFixedDiscountLine(
  listInclusivePaise: number,
  quantity: number,
  gstRate: number,
  unitFixedDiscountPaise: number,
): CustomerLinePrice {
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  const list = Math.max(0, Math.round(listInclusivePaise));
  const unitDiscount = Math.min(list, Math.max(0, Math.round(unitFixedDiscountPaise)));
  const netUnit = list - unitDiscount;
  const tax = splitInclusiveGst(netUnit, gstRate);
  return {
    ...tax,
    listInclusivePaise: list,
    discountPercent: 0,
    discountPaise: unitDiscount,
    netInclusivePaise: netUnit,
    quantity: qty,
    lineListPaise: list * qty,
    lineDiscountPaise: unitDiscount * qty,
    lineNetPaise: netUnit * qty,
    lineBasePaise: tax.basePaise * qty,
    lineGstPaise: tax.gstPaise * qty,
  };
}

export function priceCustomerLine(
  listInclusivePaise: number,
  quantity: number,
  gstRate: number,
  discountPercent: number,
): CustomerLinePrice {
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  const discounted = applyInclusiveDiscount(listInclusivePaise, discountPercent);
  const tax = splitInclusiveGst(discounted.netInclusivePaise, gstRate);
  return {
    ...discounted,
    ...tax,
    quantity: qty,
    lineListPaise: discounted.listInclusivePaise * qty,
    lineDiscountPaise: discounted.discountPaise * qty,
    lineNetPaise: discounted.netInclusivePaise * qty,
    lineBasePaise: tax.basePaise * qty,
    lineGstPaise: tax.gstPaise * qty,
  };
}

export function calculateInclusiveCartTotals(
  items: Array<{
    listInclusivePaise: number;
    quantity: number;
    gstRate: number;
    discountPercent: number;
    unitFixedDiscountPaise?: number;
  }>,
  shippingPaise = 0,
) {
  let subtotalPaise = 0;
  let gstPaise = 0;
  let totalPaise = 0;
  let listPaise = 0;
  let discountPaise = 0;

  const lines = items.map((item) => {
    const line =
      item.unitFixedDiscountPaise !== undefined
        ? priceFixedDiscountLine(
            item.listInclusivePaise,
            item.quantity,
            item.gstRate,
            item.unitFixedDiscountPaise,
          )
        : priceCustomerLine(
            item.listInclusivePaise,
            item.quantity,
            item.gstRate,
            item.discountPercent,
          );
    subtotalPaise += line.lineBasePaise;
    gstPaise += line.lineGstPaise;
    totalPaise += line.lineNetPaise;
    listPaise += line.lineListPaise;
    discountPaise += line.lineDiscountPaise;
    return line;
  });

  return {
    subtotalPaise,
    gstPaise,
    shippingPaise,
    totalPaise: totalPaise + shippingPaise,
    listPaise,
    discountPaise,
    lines,
  };
}

export function publicListingPrice(
  listInclusivePaise: number,
  gstRate: number,
  discountPercent: number,
) {
  const line = priceCustomerLine(listInclusivePaise, 1, gstRate, discountPercent);
  return {
    pricePaise: line.listInclusivePaise,
    listInclusivePaise: line.listInclusivePaise,
    netInclusivePaise: line.netInclusivePaise,
    discountPercent: line.discountPercent,
    discountPaise: line.discountPaise,
    gstRate: line.gstRate,
    basePaise: line.basePaise,
    gstPaise: line.gstPaise,
  };
}

export function ignoreClientPricing<T extends Record<string, unknown>>(body: T): T {
  const next = { ...body };
  delete next.discountPercent;
  delete next.netPrice;
  delete next.netPricePaise;
  delete next.listPrice;
  delete next.listPricePaise;
  delete next.pricePaise;
  delete next.customerId;
  delete next.userId;
  delete next.buyerId;
  delete next.pensolCashDiscountPaisePerUnit;
  delete next.pensolCreditDiscountPaisePerUnit;
  delete next.cashDiscount;
  delete next.creditDiscount;
  delete next.discountPaise;
  delete next.mrpPaise;
  delete next.dlpPaise;
  delete next.listInclusivePaise;
  delete next.netInclusivePaise;
  delete next.billableUnits;
  delete next.firmId;
  delete next.dealerId;
  delete next.totalPaise;
  delete next.subtotalPaise;
  delete next.gstPaise;
  delete next.shippingPaise;
  delete next.amountPaise;
  delete next.paymentStatus;
  delete next.fulfillmentStatus;
  delete next.orderStatus;
  delete next.status;
  return next;
}

const CLIENT_PRICING_KEYS = [
  "discountPercent",
  "netPrice",
  "netPricePaise",
  "listPrice",
  "listPricePaise",
  "pricePaise",
  "customerId",
  "userId",
  "buyerId",
  "pensolCashDiscountPaisePerUnit",
  "pensolCreditDiscountPaisePerUnit",
  "cashDiscount",
  "creditDiscount",
  "discountPaise",
  "mrpPaise",
  "dlpPaise",
  "listInclusivePaise",
  "netInclusivePaise",
  "billableUnits",
  "gstPaise",
  "gstRate",
  "subtotalPaise",
  "totalPaise",
  "shippingPaise",
  "stock",
  "paymentStatus",
  "firmId",
] as const;

const CHECKOUT_CLIENT_OVERRIDE_KEYS = [
  ...CLIENT_PRICING_KEYS,
  "quantity",
  "quantities",
  "items",
  "cartItems",
  "orderItems",
  "allocations",
  "orderId",
  "status",
  "fulfillmentStatus",
] as const;

export function ignoreCheckoutClientOverrides<T extends Record<string, unknown>>(
  body: T,
): T {
  const next = ignoreClientPricing(body);
  for (const key of CHECKOUT_CLIENT_OVERRIDE_KEYS) {
    delete next[key];
  }
  return next;
}
