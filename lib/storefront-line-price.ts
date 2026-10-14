import { calculateInclusiveCartTotals, type CustomerLinePrice } from "@/lib/party-pricing";
import {
  isPensolProduct,
  parsePensolSettlement,
  resolvePensolDiscount,
  type PensolDiscountConfig,
  type PensolSettlement,
} from "@/lib/pensol-pricing";

export type StorefrontProductRef = {
  brand?: string | null;
  name?: string | null;
  sku?: string | null;
  categoryName?: string | null;
  uom?: string | null;
  specifications?: string | null;
  manufacturer?: string | null;
};

/**
 * Decide the Pensol settlement mode from AUTHORITATIVE state, not from the
 * request body.
 *
 * SECURITY: this used to be taken straight from `body.pensolSettlement` and
 * merely enum-checked. Because "credit" selects the LARGER per-unit discount,
 * any buyer could maximise their discount by posting `"credit"` with no
 * entitlement check at all. The client is no longer trusted:
 *
 *   - a credit settlement is only honoured for a bank-transfer order, which is
 *     the only payment mode a credit sale can actually settle against,
 *   - the dealer must hold a positive AR credit limit with headroom, resolved
 *     from the database rather than asserted by the caller,
 *   - otherwise the order falls back to cash, which is the conservative choice.
 *
 * `value` is still read so an explicit "cash" is honoured, but it can no longer
 * upgrade a buyer into the credit tier.
 */
export function authorizedPensolSettlement(
  value: unknown,
  entitlement: { creditSettlementAllowed: boolean },
): {
  settlement: PensolSettlement;
  error?: string;
} {
  const parsed = parsePensolSettlement(value);
  if (parsed === "invalid") {
    return { settlement: "cash", error: "Payment type must be cash or credit." };
  }
  // `null` means the client sent nothing. It must resolve to CASH, never to
  // credit: an omitted field must never be interpreted as the more valuable
  // settlement mode.
  if (parsed === "cash" || parsed === null) {
    return { settlement: "cash" };
  }
  if (!entitlement.creditSettlementAllowed) {
    // Not an error: a buyer asking for a credit settlement is simply served the
    // cash price. Rejecting the order would be worse for them.
    return { settlement: "cash" };
  }
  return { settlement: "credit" };
}

export function storefrontLineInput(
  product: StorefrontProductRef,
  listInclusivePaise: number,
  quantity: number,
  gstRate: number,
  discountPercent: number,
  settlement: PensolSettlement,
  commonConfig: PensolDiscountConfig,
  customerConfig: PensolDiscountConfig | null,
) {
  const pensol = isPensolProduct(product);
  const resolved = resolvePensolDiscount({
    isPensol: pensol,
    sku: product.sku,
    categoryName: product.categoryName,
    name: product.name,
    uom: product.uom,
    specifications: product.specifications,
    customerConfig,
    commonConfig,
  });
  const perUnit =
    settlement === "credit"
      ? resolved.creditDiscountPaisePerUnit
      : resolved.cashDiscountPaisePerUnit;
  const packUnits = resolved.packUnits;
  const unitFixedDiscountPaise = pensol
    ? packUnits
      ? perUnit * packUnits
      : 0
    : undefined;

  return {
    listInclusivePaise,
    quantity,
    gstRate,
    discountPercent: pensol ? 0 : discountPercent,
    unitFixedDiscountPaise,
    pensol,
    resolved,
    settlement,
  };
}

export function priceStorefrontLines(
  lines: Array<{
    product: StorefrontProductRef;
    listInclusivePaise: number;
    quantity: number;
    gstRate: number;
  }>,
  discountPercent: number,
  settlement: PensolSettlement,
  commonConfig: PensolDiscountConfig,
  customerConfig: PensolDiscountConfig | null,
  shippingPaise = 0,
): {
  totals: ReturnType<typeof calculateInclusiveCartTotals>;
  priced: Array<
    CustomerLinePrice & {
      pensol: boolean;
      resolved: ReturnType<typeof resolvePensolDiscount>;
    }
  >;
  hasPensol: boolean;
} {
  const prepared = lines.map((line) =>
    storefrontLineInput(
      line.product,
      line.listInclusivePaise,
      line.quantity,
      line.gstRate,
      discountPercent,
      settlement,
      commonConfig,
      customerConfig,
    ),
  );
  const totals = calculateInclusiveCartTotals(prepared, shippingPaise);
  return {
    totals,
    priced: totals.lines.map((line, index) => ({
      ...line,
      pensol: prepared[index].pensol,
      resolved: prepared[index].resolved,
    })),
    hasPensol: prepared.some((line) => line.pensol),
  };
}
