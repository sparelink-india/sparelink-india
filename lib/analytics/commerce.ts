/**
 * Commerce-side analytics capture.
 *
 * Everything in this module is written from the SERVER, at the moment the business
 * action actually succeeded, using context the server already holds: the session, the
 * visitor identity, the authoritative listing-to-firm relationship, the shipping
 * address the customer typed.
 *
 * WHY SERVER-SIDE RATHER THAN THE BROWSER
 *
 *   - ACCURACY. A browser can be closed, throttled, or blocked. An order that
 *     completed did complete, and the funnel has to show it.
 *   - AUTHORITY. The firm for an order comes from the listing chain, never from a
 *     client field. Three-firm safety depends on that, so the analytics write is
 *     deliberately server-authoritative.
 *   - CONSENT. The visitor's stored preference is consulted before anything is
 *     written, so a customer who withdrew consent stops being measured even though
 *     they are still shopping.
 *
 * EVERY FUNCTION HERE IS FAIL-SAFE
 *
 * Each one is wrapped so a failure is logged and swallowed. Losing a measurement is
 * acceptable; failing an order, an enquiry or a checkout is not.
 */

import { desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  analyticsEnquiry,
  analyticsEvent,
  analyticsProductEvent,
  analyticsSearch,
  analyticsSession,
  analyticsVisitor,
  dealerListing,
  part,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { readConsent } from "@/lib/analytics/session";
import { eventAllowedUnderConsent, type ConsentState } from "@/lib/analytics/privacy";
import type { AnalyticsEventType } from "@/lib/analytics/events";
import { normaliseUserAddress, type UserAddressInput } from "@/lib/analytics/location";

type CommerceContext = {
  userId: string | null;
  visitorId: string | null;
  sessionId: string | null;
  path: string | null;
  searchQuery: string | null;
  deviceCategory: string | null;
};

function safe<T>(label: string, work: () => Promise<T>): Promise<T | null> {
  return work().catch((error: unknown) => {
    console.error(
      `[analytics:commerce] ${label} failed:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  });
}

/**
 * Resolve the most recent analytics visitor and session for a signed-in user.
 *
 * Used so a server-side event is attached to the same identity the browser was
 * using. Returns nulls rather than inventing an identity when there is none, which
 * is the normal case for a customer who never granted consent.
 */
async function resolveContext(
  userId: string | null,
  fallbackVisitorId?: string | null,
): Promise<CommerceContext> {
  const empty: CommerceContext = {
    userId,
    visitorId: fallbackVisitorId ?? null,
    sessionId: null,
    path: null,
    searchQuery: null,
    deviceCategory: null,
  };
  if (!userId) return empty;

  const rows = await safe("resolveContext", async () => {
    const database = getDb();
    const visitors = await database
      .select({ id: analyticsVisitor.id })
      .from(analyticsVisitor)
      .where(eq(analyticsVisitor.userId, userId))
      .orderBy(desc(analyticsVisitor.lastSeenAt))
      .limit(1);
    return visitors[0] ?? null;
  });

  const visitorId = rows?.id ?? fallbackVisitorId ?? null;
  if (!visitorId) return empty;

  const detail = await safe("resolveContextDetail", async () => {
    const database = getDb();
    const sessions = await database
      .select({ id: analyticsSession.id, deviceCategory: analyticsSession.deviceCategory })
      .from(analyticsSession)
      .where(eq(analyticsSession.visitorId, visitorId))
      .orderBy(desc(analyticsSession.lastActivityAt))
      .limit(1);
    return sessions[0] ?? null;
  });

  return {
    userId,
    visitorId,
    sessionId: detail?.id ?? null,
    path: null,
    searchQuery: null,
    deviceCategory: detail?.deviceCategory ?? null,
  };
}

/**
 * Consent check for a server-side write.
 *
 * A customer who declined analytics still gets their order. They simply do not
 * produce an analytics row for it. Operational events (errors) are the only ones
 * that survive a denial, and that is the same rule the ingestion layer applies.
 */
async function mayRecord(visitorId: string | null, eventType: AnalyticsEventType) {
  if (!visitorId) return false;
  const consent = await safe("readConsent", () => readConsent(visitorId));
  const state: ConsentState = consent?.state ?? "denied";
  return eventAllowedUnderConsent(state, eventType);
}

/* ============================================================ order events */

export type OrderAnalyticsLine = {
  partId: string;
  partNumber: string;
  productName: string | null;
  brand: string | null;
  quantity: number;
  dealerListingId: string;
};

/**
 * Record a completed order into the funnel.
 *
 * `firmId` is resolved from `dealerListing -> firm` here and only here. It is never
 * read from a request body, which is what keeps a forged firm id from turning
 * analytics into a cross-firm reporting channel.
 *
 * Amounts are deliberately NOT recorded. The analytics tables have no money column
 * on an order event, so there is nowhere for a rupee figure to leak from.
 */
export async function recordOrderEvent(input: {
  orderId: string;
  buyerId: string;
  lines: readonly OrderAnalyticsLine[];
  visitorId?: string | null;
}): Promise<void> {
  await safe("recordOrderEvent", async () => {
    const context = await resolveContext(input.buyerId, input.visitorId ?? null);
    if (!context.visitorId) return;
    if (!(await mayRecord(context.visitorId, "order_created"))) return;

    const database = getDb();

    /* Authoritative firm per line. A line with no listing gets no firm rather than a
       guessed one. */
    const listingIds = input.lines.map((line) => line.dealerListingId);
    const firmRows = listingIds.length
      ? await database
          .select({ id: dealerListing.id, firmId: dealerListing.firmId })
          .from(dealerListing)
          .where(inArray(dealerListing.id, listingIds))
      : [];
    const firmByListing = new Map(firmRows.map((row) => [row.id, row.firmId]));

    const now = new Date();

    /* Typed narrowly so the array literal below keeps drizzle's literal inference. */
    const orderEventType = "order" as const;

    /* Both analytics_event and analytics_product_event require a session (they
       carry it as a non-null foreign key), and a customer who never granted consent
       has no session at all. Resolve it once, and bail out cleanly if there is
       genuinely none rather than writing a row with a dangling reference. */
    const sessionId = context.sessionId ?? (await fallbackSessionId(context.visitorId));
    if (!context.sessionId && sessionId === "unknown-session") return;

    /* Product events: what was actually bought. */
    await database
      .insert(analyticsProductEvent)
      .values(
        input.lines.map((line) => ({
          id: randomUUID(),
          eventType: orderEventType,
          visitorId: context.visitorId as string,
          sessionId,
          userId: input.buyerId,
          partId: line.partId,
          partNumber: line.partNumber,
          productName: line.productName,
          brand: line.brand,
          quantity: line.quantity,
          firmId: firmByListing.get(line.dealerListingId) ?? null,
          occurredAt: now,
          receivedAt: now,
        })),
      )
      .onConflictDoNothing();

    /* One funnel event per order, not per line: five lines is still one order, and
       counting five would inflate the conversion stage. */
    await database
      .insert(analyticsEvent)
      .values({
        id: randomUUID(),
        eventType: "order_created",
        visitorId: context.visitorId,
        sessionId: context.sessionId ?? (await fallbackSessionId(context.visitorId)),
        userId: input.buyerId,
        isAuthenticated: true,
        path: "/checkout",
        partId: input.lines[0]?.partId ?? null,
        occurredAt: now,
        receivedAt: now,
        metadata: JSON.stringify({
          orderId: input.orderId,
          orderCount: 1,
          itemCount: input.lines.reduce((sum, line) => sum + line.quantity, 0),
        }),
      })
      .onConflictDoNothing();

    /* Lifetime order count on the visitor. SQL arithmetic rather than
       read-modify-write, so two simultaneous orders cannot lose a count. */
    await database
      .update(analyticsVisitor)
      .set({ totalOrders: sql`${analyticsVisitor.totalOrders} + 1`, updatedAt: now })
      .where(eq(analyticsVisitor.id, context.visitorId));
  });
}

/** Session id is a NOT NULL foreign key, so a missing session blocks the insert. */
async function fallbackSessionId(visitorId: string): Promise<string> {
  const found = await safe("fallbackSessionId", async () => {
    const database = getDb();
    const rows = await database
      .select({ id: analyticsSession.id })
      .from(analyticsSession)
      .where(eq(analyticsSession.visitorId, visitorId))
      .orderBy(desc(analyticsSession.lastActivityAt))
      .limit(1);
    return rows[0]?.id ?? null;
  });
  return found ?? "unknown-session";
}

/* ======================================================= enquiry attribution */

/**
 * Record the analytics attribution for a freshly created enquiry.
 *
 * The search query that led here is taken from the customer's own most recent
 * search, so nothing has to be sent by the client and nothing can be forged.
 * The customer's own typed address is normalised but never reverse-geocoded.
 */
export async function recordEnquiryAttribution(input: {
  enquiryId: string;
  buyerId: string;
  partId: string;
  quantity: number;
  enquiryType?: string | null;
  channel?: string | null;
  address?: UserAddressInput | null;
}): Promise<void> {
  await safe("recordEnquiryAttribution", async () => {
    const context = await resolveContext(input.buyerId);
    if (!context.visitorId) return;
    if (!(await mayRecord(context.visitorId, "enquiry_submitted"))) return;

    const database = getDb();

    /* The part snapshot, so the report survives the part being deleted. */
    const partRows = await database
      .select({ id: part.id, partNumber: part.partNumber, name: part.name, brand: part.brand })
      .from(part)
      .where(eq(part.id, input.partId))
      .limit(1);
    const partRow = partRows[0];

    /* The most recent search this customer made, which is by definition the one
       that led to the part they are now asking about. */
    const lastSearch = context.visitorId
      ? (
          await database
            .select({ query: analyticsSearch.normalizedQuery })
            .from(analyticsSearch)
            .where(eq(analyticsSearch.visitorId, context.visitorId))
            .orderBy(desc(analyticsSearch.occurredAt))
            .limit(1)
        )[0] ?? null
      : null;

    const address = input.address ? normaliseUserAddress(input.address) : null;
    const now = new Date();

    await database
      .insert(analyticsEnquiry)
      .values({
        id: randomUUID(),
        enquiryId: input.enquiryId,
        visitorId: context.visitorId,
        sessionId: context.sessionId,
        userId: input.buyerId,
        partId: input.partId,
        partNumber: partRow?.partNumber ?? null,
        productName: partRow?.name ?? null,
        brand: partRow?.brand ?? null,
        quantity: input.quantity,
        enquiryType: input.enquiryType ?? null,
        channel: input.channel ?? null,
        searchQuery: lastSearch?.query ?? null,
        path: context.path,
        country: address?.country ?? null,
        region: address?.region ?? null,
        city: address?.city ?? null,
        pincode: address?.pincode ?? null,
        locationType: address ? address.locationType : null,
        locationSource: address ? address.locationSource : null,
        deviceCategory: context.deviceCategory,
        occurredAt: now,
      })
      .onConflictDoNothing();
  });
}

/* ========================================================= journey milestones */

/**
 * Record a checkout or payment milestone from a server route.
 *
 * Used by the checkout, payment-status and webhook routes, where the server knows
 * what actually happened. Never records a payment credential: the only fields this
 * writes are the milestone name, a failure CODE the gateway gave us, and an optional
 * gateway name.
 */
export async function recordJourneyMilestone(input: {
  userId: string | null;
  eventType: AnalyticsEventType;
  path?: string | null;
  step?: string | null;
  paymentProvider?: string | null;
  failureCode?: string | null;
  paymentMethod?: string | null;
  visitorId?: string | null;
}): Promise<void> {
  await safe("recordJourneyMilestone", async () => {
    const context = await resolveContext(input.userId, input.visitorId ?? null);
    if (!context.visitorId) return;
    if (!(await mayRecord(context.visitorId, input.eventType))) return;

    const database = getDb();
    const now = new Date();

    /* Metadata is assembled from an allow-list of non-sensitive keys. A gateway
       failure message is NOT forwarded: gateways routinely echo the instrument
       detail in their message text. */
    const metadata: Record<string, unknown> = {};
    if (input.step) metadata.step = input.step.slice(0, 60);
    if (input.paymentProvider) metadata.paymentProvider = input.paymentProvider.slice(0, 40);
    if (input.failureCode) metadata.failureCode = input.failureCode.slice(0, 60);
    if (input.paymentMethod) metadata.paymentMethod = input.paymentMethod.slice(0, 40);

    await database
      .insert(analyticsEvent)
      .values({
        id: randomUUID(),
        eventType: input.eventType,
        visitorId: context.visitorId,
        sessionId: context.sessionId ?? (await fallbackSessionId(context.visitorId)),
        userId: context.userId,
        isAuthenticated: context.userId !== null,
        path: input.path ?? null,
        occurredAt: now,
        receivedAt: now,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      })
      .onConflictDoNothing();
  });
}

/* ================================================================ cart events */

/** Record a cart change from `/api/cart`. */
export async function recordCartMilestone(input: {
  userId: string;
  eventType: "cart_item_added" | "cart_item_removed" | "cart_quantity_changed" | "cart_viewed";
  partId?: string | null;
  partNumber?: string | null;
  productName?: string | null;
  quantity?: number | null;
  itemCount?: number | null;
}): Promise<void> {
  await safe("recordCartMilestone", async () => {
    const context = await resolveContext(input.userId);
    if (!context.visitorId) return;
    if (!(await mayRecord(context.visitorId, input.eventType))) return;

    const database = getDb();
    const now = new Date();
    const sessionId = context.sessionId ?? (await fallbackSessionId(context.visitorId));
    if (!context.sessionId && sessionId === "unknown-session") return;
    const metadata: Record<string, unknown> = {};
    if (input.quantity) metadata.quantity = input.quantity;
    if (input.itemCount) metadata.itemCount = input.itemCount;

    await database
      .insert(analyticsEvent)
      .values({
        id: randomUUID(),
        eventType: input.eventType,
        visitorId: context.visitorId,
        sessionId: context.sessionId ?? (await fallbackSessionId(context.visitorId)),
        userId: input.userId,
        isAuthenticated: true,
        path: "/cart",
        partId: input.partId ?? null,
        occurredAt: now,
        receivedAt: now,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      })
      .onConflictDoNothing();

    if (input.partId) {
      /* Typed as a literal union so drizzle keeps the column's own literal type
       * rather than widening `eventType` to `string`. */
      const cartProductEventType =
        input.eventType === "cart_item_added"
          ? ("product_cart_added" as const)
          : ("product_cart_removed" as const);
      await database
        .insert(analyticsProductEvent)
        .values({
          id: randomUUID(),
          eventType: cartProductEventType,
          visitorId: context.visitorId as string,
          sessionId,
          userId: input.userId,
          partId: input.partId,
          partNumber: input.partNumber ?? null,
          productName: input.productName ?? null,
          quantity: input.quantity ?? null,
          path: "/cart",
          occurredAt: now,
          receivedAt: now,
        })
        .onConflictDoNothing();
    }
  });
}
