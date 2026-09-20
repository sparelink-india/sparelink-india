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

export function authorizedPensolSettlement(value: unknown): {
  settlement: PensolSettlement;
  error?: string;
} {
  const parsed = parsePensolSettlement(value);
  if (parsed === "invalid") {
    return { settlement: "cash", error: "Payment type must be cash or credit." };
  }
  return { settlement: parsed ?? "cash" };
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
