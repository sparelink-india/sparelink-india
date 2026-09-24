/**
 * Authoritative checkout → one SpareLink parent order → firm-wise allocations.
 *
 * STOCK BEHAVIOR (existing, preserved):
 * - Available stock is inventory.quantity on the listing.
 * - reservedQuantity exists on inventory but is NOT used at checkout.
 * - On successful order commit, quantity is decremented by the ordered amount.
 * - Decrement happens inside the same database transaction as order creation.
 * - Failed checkout rolls back stock changes (no partial deduction).
 * - This module does not invent stock or add a reservation layer.
 */

import { createHash } from "node:crypto";

import type { CustomerLinePrice } from "@/lib/party-pricing";
import {
  AMBAJI_TRADERS_FIRM_ID,
  HIND_MOTORS_FIRM_ID,
  INDIA_SALES_FIRM_ID,
  isAllowedFirmId,
  resolveAllocationPaymentMethod,
  type ParentPaymentMethod,
} from "@/lib/firms";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

export class CheckoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

export type CheckoutCartLine = {
  dealerListingId: string;
  dealerId: string;
  firmId: string | null;
  quantity: number;
  pricePaise: number;
  listingStatus: string;
  stock: number | null;
  partId: string;
  partNumber: string;
  partName: string;
  partBrand: string | null;
  sku: string | null;
};

export type PricedCheckoutLine = {
  line: CheckoutCartLine;
  gstRate: number;
  priced: CustomerLinePrice;
};

export type OrderItemSnapshot = {
  dealerListingId: string;
  dealerId: string;
  partId: string;
  partNumber: string;
  partName: string;
  partBrand: string | null;
  sku: string | null;
  firmId: string;
  quantity: number;
  listInclusivePaise: number;
  discountPercent: number;
  discountPaise: number;
  unitPricePaise: number;
  gstRate: number;
  basePaise: number;
  gstPaise: number;
  lineDiscountPaise: number;
  lineBasePaise: number;
  lineGstPaise: number;
  totalPaise: number;
};

export type FirmAllocationPlan = {
  firmId: string;
  items: OrderItemSnapshot[];
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
  paymentMethod: ReturnType<typeof resolveAllocationPaymentMethod>;
  invoiceReference: string;
};

export type ParentOrderPlan = {
  subtotalPaise: number;
  gstPaise: number;
  shippingPaise: number;
  totalPaise: number;
  allocations: FirmAllocationPlan[];
};

export function parseCheckoutIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return null;
  return trimmed;
}

type CheckoutIdempotencyCartLine = Pick<
  CheckoutCartLine,
  "dealerListingId" | "quantity" | "firmId" | "pricePaise"
> & { id?: string };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function cartFingerprintValue(cartItems: readonly CheckoutIdempotencyCartLine[]) {
  return [...cartItems]
    .map((item) => ({
      id: item.id ?? null,
      dealerListingId: item.dealerListingId,
      quantity: item.quantity,
      firmId: item.firmId,
      pricePaise: item.pricePaise,
    }))
    .sort((left, right) =>
      `${left.id ?? ""}:${left.dealerListingId}`.localeCompare(
        `${right.id ?? ""}:${right.dealerListingId}`,
      ),
    );
}

/**
 * The existing order key column is globally unique. Include the buyer and
 * request fingerprints in the stored value so keys are buyer-scoped and a
 * reused key with a different payload cannot silently replay another order.
 */
export function buildCheckoutIdempotencyStorageKey(
  buyerId: string,
  rawKey: string,
  body: Record<string, unknown>,
  cartItems: readonly CheckoutIdempotencyCartLine[],
) {
  return `${buyerId}~${rawKey}~${fingerprint(body)}~${fingerprint(
    cartFingerprintValue(cartItems),
  )}`;
}

export function checkoutIdempotencyStoragePattern(
  buyerId: string,
  rawKey: string,
) {
  return `${`${buyerId}~${rawKey}~`.replace(/[\\%_]/g, "\\$&")}%`;
}

export function checkoutIdempotencyStorageMatches(
  storedKey: string | null | undefined,
  buyerId: string,
  rawKey: string,
  body: Record<string, unknown>,
  cartItems: readonly CheckoutIdempotencyCartLine[],
) {
  if (!storedKey) return false;
  const [storedBuyerId, storedRawKey, bodyHash, cartHash] = storedKey.split("~");
  if (storedBuyerId !== buyerId || storedRawKey !== rawKey) return false;
  if (bodyHash !== fingerprint(body)) return false;
  return cartItems.length === 0 || cartHash === fingerprint(cartFingerprintValue(cartItems));
}

export function validateCheckoutQuantity(quantity: unknown): number {
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    throw new CheckoutError("Quantity must be a positive integer.", 400);
  }
  return quantity;
}

export function validateCheckoutStock(
  partName: string,
  quantity: number,
  stock: number | null | undefined,
): void {
  const available = stock ?? 0;
  if (available < quantity) {
    throw new CheckoutError(
      `${partName} is no longer available in the requested quantity.`,
      409,
    );
  }
}

export function validateCheckoutFirmId(
  firmId: string | null | undefined,
  partName: string,
): string {
  if (!firmId || !isAllowedFirmId(firmId)) {
    throw new CheckoutError(
      `${partName} is not assigned to a SpareLink fulfillment firm.`,
      409,
    );
  }
  return firmId;
}

export function validateCheckoutLine(line: CheckoutCartLine): string {
  const quantity = validateCheckoutQuantity(line.quantity);
  if (line.listingStatus !== "active") {
    throw new CheckoutError(
      `${line.partName} is no longer available in the requested quantity.`,
      409,
    );
  }
  if (!isAuthoritativeSellingPricePaise(line.pricePaise)) {
    throw new CheckoutError(
      `${line.partName} is available on request and cannot be purchased online.`,
      400,
    );
  }
  const firmId = validateCheckoutFirmId(line.firmId, line.partName);
  validateCheckoutStock(line.partName, quantity, line.stock);
  return firmId;
}

export function snapshotOrderItem(
  line: CheckoutCartLine,
  priced: CustomerLinePrice,
  gstRate: number,
): OrderItemSnapshot {
  const firmId = validateCheckoutFirmId(line.firmId, line.partName);
  return {
    dealerListingId: line.dealerListingId,
    dealerId: line.dealerId,
    partId: line.partId,
    partNumber: line.partNumber,
    partName: line.partName,
    partBrand: line.partBrand,
    sku: line.sku,
    firmId,
    quantity: priced.quantity,
    listInclusivePaise: priced.listInclusivePaise,
    discountPercent: priced.discountPercent,
    discountPaise: priced.discountPaise,
    unitPricePaise: priced.netInclusivePaise,
    gstRate,
    basePaise: priced.basePaise,
    gstPaise: priced.gstPaise,
    lineDiscountPaise: priced.lineDiscountPaise,
    lineBasePaise: priced.lineBasePaise,
    lineGstPaise: priced.lineGstPaise,
    totalPaise: priced.lineNetPaise,
  };
}

export function buildParentOrderPlan(
  pricedLines: PricedCheckoutLine[],
  parentPaymentMethod: ParentPaymentMethod,
  orderNumber: string,
  shippingPaise = 0,
): ParentOrderPlan {
  if (!pricedLines.length) {
    throw new CheckoutError("Your cart is empty.", 400);
  }

  const snapshots = pricedLines.map(({ line, priced, gstRate }) => {
    validateCheckoutLine(line);
    if (priced.quantity !== line.quantity) {
      throw new CheckoutError("Quantity must be a positive integer.", 400);
    }
    return snapshotOrderItem(line, priced, gstRate);
  });

  const byFirm = new Map<string, OrderItemSnapshot[]>();
  for (const item of snapshots) {
    byFirm.set(item.firmId, [...(byFirm.get(item.firmId) ?? []), item]);
  }

  const allocations: FirmAllocationPlan[] = [...byFirm.entries()].map(
    ([firmId, items]) => {
      const subtotalPaise = items.reduce((sum, item) => sum + item.lineBasePaise, 0);
      const gstPaise = items.reduce((sum, item) => sum + item.lineGstPaise, 0);
      const totalPaise = items.reduce((sum, item) => sum + item.totalPaise, 0);
      const allocationNumber = `SLA-${orderNumber}-${firmId.slice(0, 6).toUpperCase()}`;
      return {
        firmId,
        items,
        subtotalPaise,
        gstPaise,
        totalPaise,
        paymentMethod: resolveAllocationPaymentMethod(parentPaymentMethod, firmId),
        invoiceReference: allocationNumber,
      };
    },
  );

  allocations.sort((a, b) => a.firmId.localeCompare(b.firmId));

  const subtotalPaise = allocations.reduce((sum, item) => sum + item.subtotalPaise, 0);
  const gstPaise = allocations.reduce((sum, item) => sum + item.gstPaise, 0);
  const merchandiseTotalPaise = allocations.reduce(
    (sum, item) => sum + item.totalPaise,
    0,
  );

  return {
    subtotalPaise,
    gstPaise,
    shippingPaise,
    totalPaise: merchandiseTotalPaise + shippingPaise,
    allocations,
  };
}

export function countAllocationsByCanonicalFirm(plan: ParentOrderPlan) {
  return {
    parentCount: 1,
    allocationCount: plan.allocations.length,
    ambaji: plan.allocations.some((item) => item.firmId === AMBAJI_TRADERS_FIRM_ID)
      ? 1
      : 0,
    hind: plan.allocations.some((item) => item.firmId === HIND_MOTORS_FIRM_ID)
      ? 1
      : 0,
    indiaSales: plan.allocations.some((item) => item.firmId === INDIA_SALES_FIRM_ID)
      ? 1
      : 0,
  };
}

export function shouldClearCart(orderCommitted: boolean): boolean {
  return orderCommitted === true;
}

export function isUniqueConstraintError(error: unknown): boolean {
  const record = error as { code?: string; cause?: { code?: string } };
  return record?.code === "23505" || record?.cause?.code === "23505";
}
