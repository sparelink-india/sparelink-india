import { SPARELINK_FIRMS, isAllowedFirmId } from "@/lib/firms";

export type AuthoritativeCartLine = {
  listingId: string;
  firmId: string;
  quantity: number;
  unitNetInclusivePaise: number;
  lineNetInclusivePaise: number;
  lineGstPaise?: number;
};

export type FirmAllocationPlan = {
  firmId: string;
  firmName: string;
  items: AuthoritativeCartLine[];
  amountPaise: number;
  gstPaise: number;
};

export function validateCartQuantity(quantity: unknown):
  | { ok: true; quantity: number }
  | { ok: false; error: string } {
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    return { ok: false, error: "Quantity must be a whole number." };
  }
  if (quantity < 1) {
    return { ok: false, error: "Quantity must be at least 1. Use remove to delete item." };
  }
  return { ok: true, quantity };
}

export function validateAvailableStock(
  quantity: number,
  stock: number | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const available = stock ?? 0;
  if (quantity > available) {
    return {
      ok: false,
      error: `Requested quantity (${quantity}) exceeds available stock (${available})`,
    };
  }
  return { ok: true };
}

export function splitLinesByFirm(lines: AuthoritativeCartLine[]):
  | { ok: true; parentTotalPaise: number; allocations: FirmAllocationPlan[] }
  | { ok: false; error: string } {
  if (!lines.length) {
    return { ok: false, error: "Your cart is empty." };
  }

  const byFirm = new Map<string, AuthoritativeCartLine[]>();
  for (const line of lines) {
    const qty = validateCartQuantity(line.quantity);
    if (!qty.ok) return qty;
    if (!isAllowedFirmId(line.firmId)) {
      return { ok: false, error: "This listing is not assigned to a fulfillment firm." };
    }
    if (!Number.isInteger(line.lineNetInclusivePaise) || line.lineNetInclusivePaise < 0) {
      return { ok: false, error: "Invalid line total." };
    }
    byFirm.set(line.firmId, [...(byFirm.get(line.firmId) ?? []), line]);
  }

  const allocations: FirmAllocationPlan[] = SPARELINK_FIRMS.filter((firm) =>
    byFirm.has(firm.id),
  ).map((firm) => {
    const items = byFirm.get(firm.id) ?? [];
    return {
      firmId: firm.id,
      firmName: firm.name,
      items,
      amountPaise: items.reduce((sum, item) => sum + item.lineNetInclusivePaise, 0),
      gstPaise: items.reduce((sum, item) => sum + (item.lineGstPaise ?? 0), 0),
    };
  });

  return {
    ok: true,
    parentTotalPaise: allocations.reduce((sum, item) => sum + item.amountPaise, 0),
    allocations,
  };
}

export function canAccessCustomerOrder(
  actor: { role?: string | null; id?: string | null } | null,
  orderBuyerId: string | null | undefined,
): boolean {
  if (!actor?.id || !actor.role || !orderBuyerId) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "buyer" && actor.id === orderBuyerId) return true;
  return false;
}

export function canMutateOrderPaymentStatus(actorRole: string | undefined): boolean {
  return actorRole === "admin";
}
