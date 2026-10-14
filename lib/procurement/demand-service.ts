import { randomUUID } from "node:crypto";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import {
  dealerListing,
  inventory,
  part,
  partDemand,
  purchaseOrder,
  purchaseOrderItem,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  aggregateDemand,
  assertDemandTransition,
  availableToPromise,
  DEMAND_STATUSES,
  OPEN_DEMAND_STATUSES,
  pendingQty,
  resolveShortage,
  suggestPurchase,
  type DemandLine,
  type DemandStatus,
} from "@/lib/procurement/demand";

/**
 * DEMAND SERVICE — the authoritative server-side implementation.
 *
 * THE ONE RULE THIS MODULE ENFORCES: firm context is never taken from the
 * caller. `firm_id` on a demand row is derived here, from the dealer_listing
 * that actually carries the part, or from the session's own firm for a dealer.
 * A client that posts `firmId: "firm-hind-motors"` changes nothing, because the
 * field is not read.
 *
 * WHY A SERVICE AND NOT ROUTE LOGIC
 * --------------------------------
 * Route handlers are the wrong place for arithmetic that procurement reports
 * also need. Aggregation, suggestion and allocation all read the same stock
 * position, so it is resolved once, here, and every caller shares it.
 *
 * STOCK SOURCE
 * ------------
 * `inventory` is authoritative and is only ever READ here. The single writer
 * remains `goods-receipt-service.ts`. Nothing in this module inserts, updates or
 * deletes an inventory row.
 */

/** Sources accepted from a validated request body. Mirrors DEMAND_SOURCES. */
export type DemandSource =
  | "out_of_stock_request"
  | "shortage_during_order"
  | "quantity_request"
  | "dealer_request"
  | "admin_entry";

const DEMAND_SOURCES: ReadonlySet<string> = new Set([
  "out_of_stock_request",
  "shortage_during_order",
  "quantity_request",
  "dealer_request",
  "admin_entry",
]);

export function isDemandSource(v: unknown): v is DemandSource {
  return typeof v === "string" && DEMAND_SOURCES.has(v);
}

export function isDemandStatus(v: unknown): v is DemandStatus {
  return typeof v === "string" && (DEMAND_STATUSES as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------ */
/* STOCK POSITION                                                      */
/* ------------------------------------------------------------------ */

export type PartStockPosition = {
  dealerListingId: string | null;
  firmId: string | null;
  physical: number;
  reserved: number;
  incoming: number;
};

/**
 * Resolve the authoritative stock position for a part.
 *
 * Listing choice matters, so it is explicit rather than "first row wins":
 *  - a dealer always sees THEIR OWN listing, which is the only one they are
 *    allowed to price or stock;
 *  - otherwise the first ACTIVE listing, preferring one that actually has
 *    inventory rows, because a listing with no inventory row would report zero
 *    stock for a part that is plainly in stock on another listing.
 *
 * `incoming` is summed from purchase order items that are ordered but not fully
 * received, restricted to the POs that are past draft. It is deliberately not
 * estimated: no supplier promise is invented.
 */
export async function resolvePartStockPosition(
  partId: string,
  options: { dealerId?: string | null } = {},
): Promise<PartStockPosition> {
  const db = getDb();

  const listings = await db
    .select({
      listingId: dealerListing.id,
      firmId: dealerListing.firmId,
      status: dealerListing.status,
      dealerId: dealerListing.dealerId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
    })
    .from(dealerListing)
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(eq(dealerListing.partId, partId));

  const active = listings.filter(
    (l) => l.status === undefined || l.status === "active",
  );

  const scoped = options.dealerId
    ? active.filter((l) => l.dealerId === options.dealerId)
    : active;

  const pool = scoped.length ? scoped : active;
  if (!pool.length) {
    return { dealerListingId: null, firmId: null, physical: 0, reserved: 0, incoming: 0 };
  }

  const withStock = pool.filter((l) => (l.quantity ?? 0) > 0);
  const chosen = withStock[0] ?? pool[0];

  // Incoming: ordered-but-not-received quantity on purchase orders that can
  // still deliver. Draft and cancelled POs can never be received (the receipt
  // guard in lib/goods-receipt.ts blocks both), and rejected/closed POs will
  // never deliver either — counting any of them as inbound understates the
  // purchase suggestion. Pipeline statuses (submitted through received,
  // including on_hold) still count.
  const incomingRows = await db
    .select({
      ordered: purchaseOrderItem.quantity,
      received: purchaseOrderItem.receivedQuantity,
    })
    .from(purchaseOrderItem)
    .innerJoin(
      purchaseOrder,
      eq(purchaseOrderItem.purchaseOrderId, purchaseOrder.id),
    )
    .where(
      and(
        eq(purchaseOrderItem.partId, partId),
        notInArray(purchaseOrder.status, ["draft", "cancelled", "rejected", "closed"]),
      ),
    );

  const incoming = incomingRows.reduce(
    (sum, r) => sum + Math.max(0, r.ordered - r.received),
    0,
  );

  return {
    dealerListingId: chosen.listingId,
    firmId: chosen.firmId,
    physical: chosen.quantity ?? 0,
    reserved: chosen.reservedQuantity ?? 0,
    incoming,
  };
}

/* ------------------------------------------------------------------ */
/* CAPTURE                                                             */
/* ------------------------------------------------------------------ */

export type CaptureDemandInput = {
  partId: string;
  requestedQty: number;
  source: DemandSource;
  actor: {
    userId: string;
    role: string;
    /** Only used to scope a dealer to their OWN listing. */
    dealerId?: string | null;
  };
  orderId?: string | null;
  orderItemId?: string | null;
  /** Replay guard. Same key => same row, never a second one. */
  idempotencyKey?: string | null;
  note?: string | null;
  notifyEmail?: string | null;
  notifyPhone?: string | null;
};

export type CaptureDemandResult =
  | { ok: true; created: boolean; demandId: string; partId: string }
  | { ok: false; error: string; code: "invalid" | "not_found" };

/**
 * Record what a customer actually asked for.
 *
 * Order of operations matters:
 *  1. validate the request BEFORE any database work;
 *  2. resolve firm and stock from the database, never from the payload;
 *  3. compute the shortage with the shared domain function, so the stored
 *     fulfillable figure can never disagree with what the UI showed;
 *  4. honour the idempotency key BEFORE inserting, and again via the unique
 *     index, because a double-clicked button can fire two requests that are
 *     genuinely concurrent rather than merely sequential.
 *
 * The stored `requested_quantity` is the FULL request, never just the short
 * part. Storing 40 instead of 50 would lose the fact that 10 were expected to
 * ship immediately, and would make `requested - fulfilled` wrong later.
 */
export async function captureDemand(
  input: CaptureDemandInput,
): Promise<CaptureDemandResult> {
  if (!input.partId || typeof input.partId !== "string") {
    return { ok: false, error: "partId is required.", code: "invalid" };
  }
  const requestedQty = Number(input.requestedQty);
  if (!Number.isFinite(requestedQty) || !Number.isInteger(requestedQty) || requestedQty <= 0) {
    return {
      ok: false,
      error: "requestedQty must be a positive whole number of pieces.",
      code: "invalid",
    };
  }
  if (!isDemandSource(input.source)) {
    return { ok: false, error: "Unsupported demand source.", code: "invalid" };
  }

  const db = getDb();

  const partRow = await db
    .select({ id: part.id, name: part.name, partNumber: part.partNumber })
    .from(part)
    .where(eq(part.id, input.partId))
    .limit(1);
  if (!partRow.length) {
    return { ok: false, error: "Part not found.", code: "not_found" };
  }

  // Idempotent replay: return the existing row rather than creating another.
  if (input.idempotencyKey) {
    const existing = await db
      .select({ id: partDemand.id })
      .from(partDemand)
      .where(eq(partDemand.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing.length) {
      return {
        ok: true,
        created: false,
        demandId: existing[0].id,
        partId: input.partId,
      };
    }
  }

  const stock = await resolvePartStockPosition(input.partId, {
    dealerId: input.actor.dealerId ?? null,
  });

  const breakdown = resolveShortage(requestedQty, stock);

  const demandId = randomUUID();

  try {
    await db.insert(partDemand).values({
      id: demandId,
      partId: input.partId,
      customerUserId: input.actor.userId,
      customerDealerId: input.actor.dealerId ?? null,
      notifyEmail: input.notifyEmail ?? null,
      notifyPhone: input.notifyPhone ?? null,
      requestedQuantity: breakdown.requestedQty,
      fulfillableQuantity: breakdown.fulfillableQty,
      allocatedQuantity: 0,
      fulfilledQuantity: 0,
      source: input.source,
      status: "requested",
      /* Firm comes from the listing the server resolved, never the payload. */
      firmId: stock.firmId,
      orderId: input.orderId ?? null,
      orderItemId: input.orderItemId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      customerNote: input.note ?? null,
    });
  } catch (error) {
    /* A genuinely concurrent duplicate loses the race to the unique index rather
       than creating a second row. Treat that as success, not as a failure —
       the customer's intent is already recorded. */
    if (input.idempotencyKey && isUniqueViolation(error)) {
      const existing = await db
        .select({ id: partDemand.id })
        .from(partDemand)
        .where(eq(partDemand.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing.length) {
        return {
          ok: true,
          created: false,
          demandId: existing[0].id,
          partId: input.partId,
        };
      }
    }
    throw error;
  }

  await writeAuditLog({
    actorUserId: input.actor.userId,
    action: "demand.created",
    entityType: "part_demand",
    entityId: demandId,
    metadata: {
      partId: input.partId,
      requestedQuantity: breakdown.requestedQty,
      fulfillableQuantity: breakdown.fulfillableQty,
      shortageQuantity: breakdown.shortageQty,
      availableToPromise: breakdown.availableToPromise,
      source: input.source,
      firmId: stock.firmId,
    },
  });

  return { ok: true, created: true, demandId, partId: input.partId };
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("23505")
  );
}

/* ------------------------------------------------------------------ */
/* READ                                                               */
/* ------------------------------------------------------------------ */

/** A customer's own demand lines, newest first. Never another customer's. */
export async function listDemandForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: partDemand.id,
      partId: partDemand.partId,
      partName: part.name,
      partNumber: part.partNumber,
      brand: part.brand,
      requestedQuantity: partDemand.requestedQuantity,
      fulfillableQuantity: partDemand.fulfillableQuantity,
      allocatedQuantity: partDemand.allocatedQuantity,
      fulfilledQuantity: partDemand.fulfilledQuantity,
      source: partDemand.source,
      status: partDemand.status,
      createdAt: partDemand.createdAt,
    })
    .from(partDemand)
    .leftJoin(part, eq(partDemand.partId, part.id))
    .where(eq(partDemand.customerUserId, userId))
    .orderBy(sql`${partDemand.createdAt} desc`)
    .limit(200);

  return rows.map((r) => ({
    ...r,
    pendingQuantity:
      r.requestedQuantity - r.fulfilledQuantity - r.allocatedQuantity,
  }));
}

/**
 * A dealer's own demand lines, scoped by the dealer's OWN id.
 *
 * The scope is applied in the query, not by filtering afterwards, so there is no
 * window in which another dealer's rows are loaded into this process at all.
 */
export async function listDemandForDealer(dealerId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: partDemand.id,
      partId: partDemand.partId,
      partName: part.name,
      partNumber: part.partNumber,
      brand: part.brand,
      requestedQuantity: partDemand.requestedQuantity,
      fulfillableQuantity: partDemand.fulfillableQuantity,
      allocatedQuantity: partDemand.allocatedQuantity,
      fulfilledQuantity: partDemand.fulfilledQuantity,
      source: partDemand.source,
      status: partDemand.status,
      createdAt: partDemand.createdAt,
    })
    .from(partDemand)
    .leftJoin(part, eq(partDemand.partId, part.id))
    .where(eq(partDemand.customerDealerId, dealerId))
    .orderBy(sql`${partDemand.createdAt} desc`)
    .limit(200);

  return rows.map((r) => ({
    ...r,
    pendingQuantity:
      r.requestedQuantity - r.fulfilledQuantity - r.allocatedQuantity,
  }));
}

/** Aggregated open demand per part, for the procurement views. */
export async function aggregateOpenDemand(opts: { firmId?: string | null } = {}) {
  const db = getDb();

  const conditions = [inArray(partDemand.status, [...OPEN_DEMAND_STATUSES])];
  if (opts.firmId) conditions.push(eq(partDemand.firmId, opts.firmId));

  const rows = await db
    .select({
      partId: partDemand.partId,
      partName: part.name,
      partNumber: part.partNumber,
      brand: part.brand,
      /* These aliases MUST match DemandLine's field names. They previously read
         `requested`/`fulfilled`/`allocated`, which made `pendingQty()` see
         `undefined` for every line, so `totalPendingQty` was always 0 and both
         the admin demand view and the purchase suggestions were permanently
         empty. Renaming them is what makes this aggregation mean anything. */
      requestedQty: partDemand.requestedQuantity,
      fulfilledQty: partDemand.fulfilledQuantity,
      allocatedQty: partDemand.allocatedQuantity,
      status: partDemand.status,
      createdAt: partDemand.createdAt,
      customerUserId: partDemand.customerUserId,
      customerDealerId: partDemand.customerDealerId,
      firmId: partDemand.firmId,
    })
    .from(partDemand)
    .leftJoin(part, eq(partDemand.partId, part.id))
    .where(and(...conditions))
    .limit(5000);

  const byPart = new Map<
    string,
    { lines: Array<Record<string, unknown>>; customers: Set<string>; meta: Record<string, unknown> }
  >();

  for (const r of rows) {
    let bucket = byPart.get(r.partId);
    if (!bucket) {
      bucket = { lines: [], customers: new Set(), meta: r };
      byPart.set(r.partId, bucket);
    }
    bucket.lines.push(r);
    const key = r.customerUserId ?? r.customerDealerId;
    if (key) bucket.customers.add(key);
  }

  const out = [];
  for (const [partId, bucket] of byPart) {
    const agg = aggregateDemand(partId, bucket.lines as DemandLine[]);
    out.push({
      partId,
      partName: bucket.meta.partName,
      partNumber: bucket.meta.partNumber,
      brand: bucket.meta.brand,
      firmId: bucket.meta.firmId,
      totalPendingQty: agg.totalPendingQty,
      openLineCount: agg.openLineCount,
      customersWaiting: bucket.customers.size,
      oldestOpenAt: agg.oldestOpenAt,
    });
  }
  return out.sort((a, b) => b.totalPendingQty - a.totalPendingQty);
}

/**
 * Purchase suggestions, computed live from real stock + real open demand.
 *
 * Nothing is persisted here: a suggestion is a view, and persisting it would
 * create a second thing that can drift from the demand it was derived from.
 */
export async function buildPurchaseSuggestions(
  opts: { firmId?: string | null; safetyStock?: number } = {},
) {
  const aggregated = await aggregateOpenDemand({ firmId: opts.firmId });

  const suggestions = [];
  for (const agg of aggregated) {
    const stock = await resolvePartStockPosition(agg.partId);
    const suggestion = suggestPurchase({
      partId: agg.partId,
      stock: {
        physical: stock.physical,
        reserved: stock.reserved,
        incoming: stock.incoming,
        safetyStock: opts.safetyStock ?? 0,
      },
      pendingDemandQty: agg.totalPendingQty,
    });
    if (suggestion.recommendedQty <= 0) continue;
    suggestions.push({
      partName: agg.partName,
      partNumber: agg.partNumber,
      brand: agg.brand,
      firmId: agg.firmId,
      customersWaiting: agg.customersWaiting,
      oldestOpenAt: agg.oldestOpenAt,
      ...suggestion,
    });
  }
  return suggestions.sort((a, b) => b.recommendedQty - a.recommendedQty);
}

/* ------------------------------------------------------------------ */
/* MUTATE                                                             */
/* ------------------------------------------------------------------ */

export type UpdateDemandResult =
  | { ok: true }
  | { ok: false; error: string; code: "invalid" | "not_found" | "forbidden" | "illegal_transition" };

/**
 * Move a demand line to a new status, enforcing the lifecycle server-side.
 *
 * Ownership is checked here and nowhere else in the chain, so a caller cannot
 * advance somebody else's demand by guessing an id.
 */
export async function updateDemandStatus(input: {
  demandId: string;
  nextStatus: string;
  actor: { userId: string; role: string; dealerId?: string | null };
}): Promise<UpdateDemandResult> {
  if (!isDemandStatus(input.nextStatus)) {
    return { ok: false, error: "Unknown demand status.", code: "invalid" };
  }

  const db = getDb();
  const rows = await db
    .select({
      id: partDemand.id,
      status: partDemand.status,
      customerUserId: partDemand.customerUserId,
      customerDealerId: partDemand.customerDealerId,
    })
    .from(partDemand)
    .where(eq(partDemand.id, input.demandId))
    .limit(1);

  if (!rows.length) {
    return { ok: false, error: "Demand not found.", code: "not_found" };
  }
  const row = rows[0];

  const isAdmin = input.actor.role === "admin";
  const isOwner =
    row.customerUserId === input.actor.userId ||
    (input.actor.dealerId != null && row.customerDealerId === input.actor.dealerId);

  if (!isAdmin && !isOwner) {
    return { ok: false, error: "Not permitted.", code: "forbidden" };
  }

  const from = row.status as DemandStatus;
  if (!isDemandStatus(from)) {
    return {
      ok: false,
      error: `Demand row holds an unrecognised status '${from}'.`,
      code: "invalid",
    };
  }

  try {
    assertDemandTransition(from, input.nextStatus);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Illegal transition.",
      code: "illegal_transition",
    };
  }

  await db
    .update(partDemand)
    .set({
      status: input.nextStatus,
      fulfilledAt:
        input.nextStatus === "fulfilled" ? new Date() : undefined,
    })
    .where(eq(partDemand.id, input.demandId));

  await writeAuditLog({
    actorUserId: input.actor.userId,
    action: "demand.status_changed",
    entityType: "part_demand",
    entityId: input.demandId,
    metadata: { from, to: input.nextStatus },
  });

  return { ok: true };
}

/**
 * Allocate received material to open demand.
 *
 * Bounds are enforced here rather than trusted:
 *  - the line must exist and still be open;
 *  - the amount must be a positive integer;
 *  - `fulfilled + allocated` may never exceed the ORIGINAL request.
 *
 * Returns the new pending figure so the caller can report it without
 * recomputing.
 */
export async function allocateDemand(input: {
  demandId: string;
  quantity: number;
  actorUserId: string;
}): Promise<
  | { ok: true; allocated: number; pendingAfter: number }
  | { ok: false; error: string; code: string }
> {
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
    return {
      ok: false,
      error: "quantity must be a positive whole number of pieces.",
      code: "invalid",
    };
  }

  const db = getDb();
  const rows = await db
    .select({
      id: partDemand.id,
      status: partDemand.status,
      requestedQuantity: partDemand.requestedQuantity,
      allocatedQuantity: partDemand.allocatedQuantity,
      fulfilledQuantity: partDemand.fulfilledQuantity,
    })
    .from(partDemand)
    .where(eq(partDemand.id, input.demandId))
    .limit(1);

  if (!rows.length) {
    return { ok: false, error: "Demand not found.", code: "not_found" };
  }
  const row = rows[0];

  if (!isDemandStatus(row.status) || !OPEN_DEMAND_STATUSES.has(row.status)) {
    return {
      ok: false,
      error: `Demand is ${row.status} and can no longer be allocated.`,
      code: "closed",
    };
  }

  const line = {
    id: row.id,
    status: row.status,
    requestedQty: row.requestedQuantity,
    fulfilledQty: row.fulfilledQuantity,
    allocatedQty: row.allocatedQuantity,
    createdAt: new Date(0),
  } as Parameters<typeof pendingQty>[0];

  const pending = pendingQty(line);
  if (qty > pending) {
    return {
      ok: false,
      error: `Cannot allocate ${qty}: only ${pending} pending.`,
      code: "over_allocation",
    };
  }

  await db
    .update(partDemand)
    .set({ allocatedQuantity: row.allocatedQuantity + qty })
    .where(eq(partDemand.id, input.demandId));

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "demand.allocated",
    entityType: "part_demand",
    entityId: input.demandId,
    metadata: { allocated: qty, pendingBefore: pending, pendingAfter: pending - qty },
  });

  return { ok: true, allocated: qty, pendingAfter: pending - qty };
}

/* Re-exported so callers need one import for the whole vocabulary. */
export { availableToPromise, pendingQty };
