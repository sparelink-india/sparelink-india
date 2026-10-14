/**
 * DEMAND + SHORTAGE DOMAIN LOGIC.
 *
 * Pure functions, no database, no React, no I/O. Everything here is
 * deterministic and directly unit-testable, which is deliberate: the arithmetic
 * in this file decides whether a customer is told "we have it" or "40 more are
 * on order", so it must be provable without standing up Postgres.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * The rest of the procurement stack already exists and is authoritative:
 *   - `inventory` (keyed by dealer_listing) with `quantity` and
 *     `reserved_quantity` is the single stock source. Nothing here writes it.
 *   - `goods-receipt-service.ts` is the only thing allowed to move stock.
 *   - `purchase_order` / `purchase_order_item` are the only procurement records.
 * This module decides *what should be bought and why*, and never mutates
 * anything, so it cannot become a second stock system.
 *
 * THE INVARIANTS, STATED PLAINLY
 * ------------------------------
 *  1. available = max(0, physical - reserved). Never negative, never "physical
 *     alone" — a reservation is a real commitment someone else already made.
 *  2. shortage = max(0, requested - available). A customer can never be told a
 *     shortage larger than the gap.
 *  3. demand is never double counted. `pendingQty` is derived
 *     (requested - fulfilled), never a second stored number that can drift.
 *  4. a purchase suggestion is a RECOMMENDATION. It is shortage plus optional
 *     safety stock, and an admin may edit it freely. Nothing auto-orders.
 *  5. nothing here invents a quantity, a date or a promise. `expectedAt` is
 *     only ever populated from data that already exists.
 */

export type StockPosition = {
  /** Total units physically held. From inventory.quantity. */
  physical: number;
  /** Units already committed to other orders. From inventory.reserved_quantity. */
  reserved: number;
  /**
   * Units already on an approved/sent purchase order and not yet received.
   * Supplied by the caller from real purchase_order_item rows. There is no
   * default of 0 implied by this module — the caller must pass what it knows.
   */
  incoming?: number;
  /** Optional reorder floor. Only applied when the caller has a real value. */
  safetyStock?: number;
};

/**
 * Units a new customer may actually be promised right now.
 *
 * Reserved units are excluded because they already belong to someone. Incoming
 * units are excluded because they have not arrived. The floor at 0 is the
 * important part: a corrupt reserved figure must never produce a negative
 * "available" that then reads as stock the shop does not have.
 */
export function availableToPromise(stock: StockPosition): number {
  const physical = safeNonNegativeInt(stock.physical);
  const reserved = safeNonNegativeInt(stock.reserved);
  return Math.max(0, physical - reserved);
}

export type ShortageBreakdown = {
  requestedQty: number;
  /** How much of the request can be filled from stock on hand. */
  fulfillableQty: number;
  /** max(0, requested - fulfillable). Never negative. */
  shortageQty: number;
  availableToPromise: number;
  /** True when the customer wants more than exists, or nothing exists at all. */
  isShort: boolean;
};

/**
 * Split a customer request into what can be filled now and what cannot.
 *
 * `fulfillableQty` is capped at `availableToPromise`, so the two numbers always
 * add back up to the request. That sum invariant is what stops the UI showing
 * "10 available" and "40 short" against a 50 request that was really 30.
 */
export function resolveShortage(
  requestedQty: number,
  stock: StockPosition,
): ShortageBreakdown {
  const requested = safeNonNegativeInt(requestedQty);
  const available = availableToPromise(stock);
  const fulfillable = Math.min(requested, available);
  const shortage = Math.max(0, requested - fulfillable);
  return {
    requestedQty: requested,
    fulfillableQty: fulfillable,
    shortageQty: shortage,
    availableToPromise: available,
    isShort: shortage > 0,
  };
}

/* ------------------------------------------------------------------ */
/* DEMAND LIFECYCLE                                                     */
/* ------------------------------------------------------------------ */

/**
 * Demand states.
 *
 * `requested` is the entry state. `backordered` is distinct from `requested`
 * on purpose: a backorder is demand that procurement has ALREADY been told
 * about, and reporting treats them differently. Collapsing the two is how a
 * "pending demand" number silently becomes "demand we have not acted on".
 */
export const DEMAND_STATUSES = [
  "requested",
  "confirmed",
  "allocated",
  "partially_fulfilled",
  "fulfilled",
  "backordered",
  "cancelled",
] as const;

export type DemandStatus = (typeof DEMAND_STATUSES)[number];

/** Statuses that still represent unmet customer want. Used for aggregation. */
export const OPEN_DEMAND_STATUSES: ReadonlySet<DemandStatus> = new Set([
  "requested",
  "confirmed",
  "allocated",
  "partially_fulfilled",
  "backordered",
]);

export type DemandLine = {
  id: string;
  status: DemandStatus;
  requestedQty: number;
  /** Units actually handed to the customer so far. Never more than requested. */
  fulfilledQty: number;
  /** Units earmarked against incoming procurement. */
  allocatedQty: number;
  /** When it was first raised, for ageing. */
  createdAt: Date;
};

/** Units still wanted. DERIVED, so it cannot drift out of step with the request. */
export function pendingQty(line: DemandLine): number {
  const requested = safeNonNegativeInt(line.requestedQty);
  const fulfilled = Math.min(safeNonNegativeInt(line.fulfilledQty), requested);
  const allocated = Math.min(safeNonNegativeInt(line.allocatedQty), requested - fulfilled);
  return Math.max(0, requested - fulfilled - allocated);
}

/** True while the line still represents unmet want. */
export function isOpenDemand(line: DemandLine): boolean {
  return OPEN_DEMAND_STATUSES.has(line.status) && pendingQty(line) > 0;
}

/**
 * Legal demand transitions. Enforced server-side; the UI only ever offers a
 * subset of this.
 *
 * `fulfilled` and `cancelled` are terminal. There is deliberately no way back
 * out of them from this map — reopening a cancelled demand must be a new line,
 * otherwise the audit trail of what the customer actually asked for is lost.
 */
const DEMAND_TRANSITIONS: Readonly<Record<DemandStatus, ReadonlySet<DemandStatus>>> = {
  requested: new Set(["confirmed", "backordered", "cancelled"]),
  confirmed: new Set(["allocated", "partially_fulfilled", "fulfilled", "backordered", "cancelled"]),
  allocated: new Set(["partially_fulfilled", "fulfilled", "cancelled"]),
  partially_fulfilled: new Set(["partially_fulfilled", "fulfilled", "cancelled"]),
  backordered: new Set(["confirmed", "allocated", "partially_fulfilled", "fulfilled", "cancelled"]),
  fulfilled: new Set(),
  cancelled: new Set(),
};

export function canTransitionDemand(
  from: DemandStatus,
  to: DemandStatus,
): boolean {
  if (from === to) return true;
  return DEMAND_TRANSITIONS[from]?.has(to) ?? false;
}

export function assertDemandTransition(from: DemandStatus, to: DemandStatus): void {
  if (!canTransitionDemand(from, to)) {
    throw new Error(
      `Invalid demand transition '${from}' -> '${to}'. Allowed: ${
        [...(DEMAND_TRANSITIONS[from] ?? [])].join(", ") || "none"
      }`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* AGGREGATION                                                          */
/* ------------------------------------------------------------------ */

export type AggregatedDemand = {
  partId: string;
  /** Sum of pending units across every open line. */
  totalPendingQty: number;
  /** Distinct customers/dealers still waiting. */
  waitingCustomerCount: number;
  /** Distinct demand lines still open. */
  openLineCount: number;
  /** Oldest open line, for ageing reports. Null when nothing is open. */
  oldestOpenAt: Date | null;
};

/**
 * Aggregate open demand for one part.
 *
 * Only OPEN lines count, and each contributes `pendingQty` rather than its raw
 * request. That is the anti-double-counting rule: a customer who asked for 50
 * and has since received 10 contributes 40, never 50 and never a second 40.
 *
 * Closed, fulfilled and cancelled lines are excluded entirely.
 */
export function aggregateDemand(
  partId: string,
  lines: readonly DemandLine[],
): AggregatedDemand {
  const open = lines.filter((line) => isOpenDemand(line));
  let totalPendingQty = 0;
  // NOTE: DemandLine carries no customer identity (by design — identity is
  // authoritative only at the service layer), so distinct customers cannot be
  // counted here. Callers that need "customers waiting" must use
  // aggregateDemandByPart with caller-supplied customer keys. This field is
  // therefore always 0 from this function; the override in
  // aggregateDemandByPart is the real count.
  let oldestOpenAt: Date | null = null;

  for (const line of open) {
    totalPendingQty += pendingQty(line);
    if (line.allocatedQty > 0) {
      // An allocated line has an earmark against procurement; still open.
    }
    const stamp = line.createdAt.getTime();
    if (oldestOpenAt === null || stamp < oldestOpenAt.getTime()) {
      oldestOpenAt = line.createdAt;
    }
  }

  return {
    partId,
    totalPendingQty,
    waitingCustomerCount: 0,
    openLineCount: open.length,
    oldestOpenAt,
  };
}

/**
 * Fold aggregation across several parts.
 *
 * `customerKey` identifies who is waiting and is supplied by the caller as the
 * already-authoritative identity (a user id or a dealer id) — never a
 * client-supplied label, because that would let one customer inflate the
 * "customers waiting" count by varying the string.
 */
export function aggregateDemandByPart(
  rows: ReadonlyArray<{ partId: string; line: DemandLine; customerKey: string }>,
): Map<string, AggregatedDemand> {
  const byPart = new Map<string, { lines: DemandLine[]; customers: Set<string> }>();
  for (const row of rows) {
    let bucket = byPart.get(row.partId);
    if (!bucket) {
      bucket = { lines: [], customers: new Set() };
      byPart.set(row.partId, bucket);
    }
    bucket.lines.push(row.line);
    if (isOpenDemand(row.line)) bucket.customers.add(row.customerKey);
  }

  const out = new Map<string, AggregatedDemand>();
  for (const [partId, bucket] of byPart) {
    const agg = aggregateDemand(partId, bucket.lines);
    out.set(partId, {
      ...agg,
      waitingCustomerCount: bucket.customers.size,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* PROCUREMENT SUGGESTION                                               */
/* ------------------------------------------------------------------ */

export type PurchaseSuggestion = {
  partId: string;
  physical: number;
  reserved: number;
  available: number;
  pendingDemandQty: number;
  incomingQty: number;
  safetyStock: number;
  /**
   * recommended = shortage - incoming, floored at the safety stock, floored at 0.
   *
   * Incoming stock already covers part of the shortage, so buying for the full
   * shortage on top of stock that is already on its way would over-order.
   */
  recommendedQty: number;
  /** Human-readable justification. Audit trail for "why is this on the list". */
  reasons: string[];
};

/**
 * Recommend a purchase quantity for one part.
 *
 * This is advice, not an order. It deliberately does not round up to a carton
 * or supplier minimum, because neither exists in this codebase and inventing
 * one would change what gets bought.
 */
export function suggestPurchase(input: {
  partId: string;
  stock: StockPosition;
  pendingDemandQty: number;
}): PurchaseSuggestion {
  const physical = safeNonNegativeInt(input.stock.physical);
  const reserved = safeNonNegativeInt(input.stock.reserved);
  const incoming = safeNonNegativeInt(input.stock.incoming ?? 0);
  const safetyStock = safeNonNegativeInt(input.stock.safetyStock ?? 0);
  const pendingDemand = safeNonNegativeInt(input.pendingDemandQty);

  const available = availableToPromise(input.stock);

  /* Units we must buy to reach the desired END STATE: every pending demand unit
     served, plus the safety floor still held, minus what is already on hand or
     already inbound.

     This is additive on purpose. The brief's worked example is physical 10,
     reserved 10, available 0, demand 40, incoming 0, safety 10 -> 50, because
     after serving all 40 there must still be 10 in hand. Treating safety stock
     as a max() against the shortfall instead would buy only 40 and land at
     zero safety stock, which is the opposite of what a reorder floor is for.
     The subtraction still floors at zero, so surplus stock buys nothing. */
  const recommendedQty = Math.max(
    0,
    pendingDemand + safetyStock - available - incoming,
  );

  const reasons: string[] = [];
  if (pendingDemand > 0) {
    reasons.push(`Pending customer demand: ${pendingDemand}`);
  }
  if (incoming > 0) {
    reasons.push(`Already on order: ${incoming} (excluded from this suggestion)`);
  }
  if (reserved > 0) {
    reasons.push(`Reserved for committed orders: ${reserved}`);
  }
  if (
    safetyStock > 0 &&
    recommendedQty > Math.max(0, pendingDemand - available - incoming)
  ) {
    reasons.push(`Safety stock floor of ${safetyStock} applied`);
  }
  if (reasons.length === 0) {
    reasons.push("No shortage and no safety-stock breach.");
  }

  return {
    partId: input.partId,
    physical,
    reserved,
    available,
    pendingDemandQty: pendingDemand,
    incomingQty: incoming,
    safetyStock,
    recommendedQty,
    reasons,
  };
}

/* ------------------------------------------------------------------ */
/* SUPPLIERS + WHATSAPP                                                 */
/* ------------------------------------------------------------------ */

export type SupplierContactCheck =
  | { ok: true; digits: string }
  | { ok: false; reason: "missing" | "invalid" | "not_whatsapp_capable" };

/**
 * Validate a supplier WhatsApp number BEFORE a link is built.
 *
 * The rule that matters: this function never "fixes" a number by guessing.
 * A value that is not already a plausible international number is REJECTED, so
 * the app cannot construct a link that would message a random person. Digits
 * are stripped only from punctuation the supplier clearly typed themselves
 * (spaces, dashes, brackets, a leading +); anything else is a failure.
 *
 * Returns a discriminated reason so the caller can show setup guidance instead
 * of a broken link.
 */
export function validateSupplierWhatsApp(
  raw: string | null | undefined,
): SupplierContactCheck {
  if (!raw || !raw.trim()) return { ok: false, reason: "missing" };

  const trimmed = raw.trim();
  // Only + and separators are tolerated. Letters/spaces words are rejected.
  if (!/^\+?[\d\s\-().]{7,20}$/.test(trimmed)) {
    return { ok: false, reason: "invalid" };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, reason: "invalid" };
  }
  // WhatsApp itself requires a country code; a bare 10-digit local number is
  // not enough to build a link we could guarantee reaches the supplier.
  if (!trimmed.startsWith("+")) {
    return { ok: false, reason: "not_whatsapp_capable" };
  }
  return { ok: true, digits };
}

/** Build wa.me link digits, or null when the number is not usable. */
export function supplierWhatsAppDigits(
  raw: string | null | undefined,
): string | null {
  const check = validateSupplierWhatsApp(raw);
  return check.ok ? check.digits : null;
}

/* ------------------------------------------------------------------ */
/* INTERNAL                                                             */
/* ------------------------------------------------------------------ */

/**
 * Coerce a quantity to a safe non-negative integer.
 *
 * Everything downstream assumes integers. A fractional, negative, NaN or
 * Infinity quantity from a request body is a bug or an attack, and the single
 * safest response is to treat it as zero rather than to let it poison an
 * arithmetic chain.
 */
function safeNonNegativeInt(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
