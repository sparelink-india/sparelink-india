/**
 * Visitor and session lifecycle.
 *
 * This is the only place that writes `analytics_visitor` and `analytics_session`,
 * so the invariants that make the rest of the reports correct live here:
 *
 *   - `visitorId` is opaque and client-supplied; `sessionId` must be new for a
 *     visit. A session that already exists is reused, which is what makes a page
 *     refresh one visit rather than several.
 *   - `isReturning` is computed from the database, never sent by the client, so
 *     "new vs returning" cannot be forged.
 *   - lifetime counters are incremented with database expressions, not
 *     read-modify-write, so two concurrent requests cannot lose a count.
 *   - logging in joins the anonymous history to the account, which is what makes
 *     Customer 360 able to show the journey that happened before registration.
 */

import { and, eq, sql } from "drizzle-orm";

import { randomUUID } from "node:crypto";
import {
  analyticsConsent,
  analyticsLocation,
  analyticsSession,
  analyticsVisitor,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { type ConsentState } from "@/lib/analytics/privacy";
import { writeAuditLog } from "@/lib/audit";

/* --------------------------------------------------------------- consent */

export type ConsentRecord = {
  state: ConsentState;
  analyticsAllowed: boolean;
  locationAllowed: boolean;
  preciseLocationAllowed: boolean;
};

/**
 * The authoritative consent state for a visitor.
 *
 * A visitor with no row is `pending`: not granted, not denied. That distinction
 * matters. `denied` is an explicit refusal the server enforces forever; `pending`
 * is simply nobody having decided yet, and it still allows operational events.
 */
export async function readConsent(visitorId: string): Promise<ConsentRecord> {
  return (await readConsentRow(visitorId)) ?? PENDING_CONSENT;
}

/**
 * The stored consent row, or `null` when the visitor has never chosen.
 *
 * This exists SEPARATELY from `readConsent` because "nobody has decided yet" and
 * "somebody decided no" are different facts, and collapsing them breaks the module.
 *
 * A brand-new visitor has no row, which `readConsent` correctly reports as
 * `pending`. But if ingestion then treats that `pending` as an authoritative
 * decision, the visitor's own choice - which arrives in the same request, from the
 * consent banner they just answered - is discarded, and NO behavioural event is
 * ever recorded for them. Since the consent endpoint requires a signed-in session,
 * that would mean analytics silently never worked for anonymous visitors, which is
 * most of the traffic.
 *
 * So the ingest path needs to know the difference. `readConsent` stays for the
 * callers that genuinely want the conservative answer.
 */
export async function readConsentRow(visitorId: string): Promise<ConsentRecord | null> {
  const db = getDb();
  const rows = await db
    .select({
      consentState: analyticsConsent.consentState,
      analyticsAllowed: analyticsConsent.analyticsAllowed,
      locationAllowed: analyticsConsent.locationAllowed,
      preciseLocationAllowed: analyticsConsent.preciseLocationAllowed,
    })
    .from(analyticsConsent)
    .where(eq(analyticsConsent.visitorId, visitorId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const state = (row.consentState ?? "pending") as ConsentState;
  return {
    state,
    analyticsAllowed: row.analyticsAllowed === true && state !== "denied",
    locationAllowed: row.locationAllowed === true && state !== "denied",
    preciseLocationAllowed:
      row.preciseLocationAllowed === true && row.locationAllowed === true && state !== "denied",
  };
}

/** "Nobody has decided yet": not granted, not denied. */
const PENDING_CONSENT: ConsentRecord = {
  state: "pending",
  analyticsAllowed: false,
  locationAllowed: false,
  preciseLocationAllowed: false,
};

/**
 * Record a tracking preference.
 *
 * The caller passes the visitor's OWN preference. A body cannot reach another
 * visitor because the visitor id is resolved from the caller's own stored
 * identity, not from the request.
 *
 * Revocation takes effect on the next ingest because `readConsent` is consulted
 * server-side there. Deleting the local copy alone would stop the client sending
 * events but would not change what the server would accept if they did.
 */
export async function writeConsent(input: {
  visitorId: string;
  userId?: string | null;
  state: ConsentState;
  analyticsAllowed: boolean;
  locationAllowed: boolean;
  preciseLocationAllowed: boolean;
  source?: string | null;
  policyVersion?: string | null;
}): Promise<ConsentRecord> {
  const db = getDb();
  const record: ConsentRecord = {
    state: input.state,
    // Precise location implies coarse location, never the other way round.
    analyticsAllowed: input.analyticsAllowed && input.state !== "denied",
    locationAllowed: input.locationAllowed && input.state !== "denied",
    preciseLocationAllowed:
      input.preciseLocationAllowed &&
      input.locationAllowed &&
      input.state !== "denied",
  };

  await db
    .insert(analyticsConsent)
    .values({
      id: randomUUID(),
      visitorId: input.visitorId,
      userId: input.userId ?? null,
      consentState: record.state,
      analyticsAllowed: record.analyticsAllowed,
      locationAllowed: record.locationAllowed,
      preciseLocationAllowed: record.preciseLocationAllowed,
      replayAllowed: false,
      source: input.source ?? null,
      policyVersion: input.policyVersion ?? null,
    })
    .onConflictDoUpdate({
      target: analyticsConsent.visitorId,
      set: {
        consentState: record.state,
        analyticsAllowed: record.analyticsAllowed,
        locationAllowed: record.locationAllowed,
        preciseLocationAllowed: record.preciseLocationAllowed,
        userId: input.userId ?? null,
        source: input.source ?? null,
        policyVersion: input.policyVersion ?? null,
        updatedAt: new Date(),
      },
    });

  await db
    .update(analyticsVisitor)
    .set({ consentState: record.state, updatedAt: new Date() })
    .where(eq(analyticsVisitor.id, input.visitorId));

  // A precise-location revocation must delete the coordinates it granted.
  // "You may no longer track me precisely" has to actually remove the data, not
  // merely stop adding to it.
  if (!record.preciseLocationAllowed) {
    await db
      .delete(analyticsLocation)
      .where(
        and(
          eq(analyticsLocation.visitorId, input.visitorId),
          eq(analyticsLocation.locationType, "PRECISE"),
        ),
      );
  }

  await writeAuditLog({
    actorUserId: input.userId ?? null,
    action: "analytics.consent.updated",
    entityType: "analytics_visitor",
    entityId: input.visitorId,
    metadata: {
      state: record.state,
      analyticsAllowed: record.analyticsAllowed,
      locationAllowed: record.locationAllowed,
      preciseLocationAllowed: record.preciseLocationAllowed,
      source: input.source ?? null,
    },
  });

  return record;
}

/* --------------------------------------------------------------- visitor */

export type VisitorContext = {
  deviceCategory: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  locale: string | null;
  timezone: string | null;
  referrerHost: string | null;
  trafficSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  firstSeenAt: Date | null;
};

export type SessionContext = {
  startedAt: Date | null;
  landingPage: string | null;
  referrerHost: string | null;
  deviceCategory: string | null;
  browser: string | null;
  os: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  locale: string | null;
  timezone: string | null;
};

/**
 * Upsert the visitor and its session, and return whether this is a first visit.
 *
 * Both rows are written in one transaction: an event that references a session
 * that failed to be created would violate the foreign key and lose the event, so
 * the session must exist first or not at all.
 *
 * `isNewVisitor` is derived from an insert-conflict probe rather than from a
 * subsequent SELECT, so two requests from the same brand-new visitor racing each
 * other cannot both claim to be the first.
 */
export async function upsertVisit(input: {
  visitorId: string;
  sessionId: string;
  visitor: VisitorContext;
  session: SessionContext;
  userId: string | null;
  consentState: ConsentState;
  /** Coarse location, resolved by the caller from the edge headers. */
  location: { country: string | null; region: string | null; city: string | null; stateCode: string | null };
  now?: Date;
}): Promise<{ isNewVisitor: boolean; isNewSession: boolean }> {
  const db = getDb();
  const now = input.now ?? new Date();
  const locationType = input.location.country || input.location.city ? "APPROXIMATE" : null;

  return db.transaction(async (tx) => {
    /* ------------------------------------------------------- new visitor? */
    const inserted = await tx
      .insert(analyticsVisitor)
      .values({
        id: input.visitorId,
        userId: input.userId,
        firstSeenAt: input.visitor.firstSeenAt ?? now,
        lastSeenAt: now,
        totalSessions: 0,
        country: input.location.country,
        region: input.location.region ?? input.location.stateCode,
        city: input.location.city,
        locationType,
        locationSource: locationType ? "IP" : null,
        deviceCategory: input.visitor.deviceCategory,
        browser: input.visitor.browser,
        os: input.visitor.os,
        viewportWidth: input.visitor.viewportWidth,
        viewportHeight: input.visitor.viewportHeight,
        locale: input.visitor.locale,
        timezone: input.visitor.timezone,
        referrerHost: input.visitor.referrerHost,
        trafficSource: input.visitor.trafficSource,
        utmSource: input.visitor.utmSource,
        utmMedium: input.visitor.utmMedium,
        utmCampaign: input.visitor.utmCampaign,
        utmTerm: input.visitor.utmTerm,
        utmContent: input.visitor.utmContent,
        consentState: input.consentState,
      })
      .onConflictDoNothing({ target: analyticsVisitor.id })
      .returning({ id: analyticsVisitor.id });

    const isNewVisitor = inserted.length > 0;

    /* ------------------------------------------------- touch the visitor */
    // Acquisition context is only set on the first visit. Overwriting it on
    // every page view would turn "how did this person find us" into "what did
    // their most recent referrer say", which is a different and useless report.
    await tx
      .update(analyticsVisitor)
      .set({
        lastSeenAt: now,
        userId: input.userId,
        country: input.location.country,
        region: input.location.region ?? input.location.stateCode,
        city: input.location.city,
        locationType,
        locationSource: locationType ? "IP" : null,
        ...(isNewVisitor
          ? {}
          : {
              deviceCategory: input.visitor.deviceCategory,
              browser: input.visitor.browser,
              os: input.visitor.os,
              viewportWidth: input.visitor.viewportWidth,
              viewportHeight: input.visitor.viewportHeight,
            }),
      })
      .where(eq(analyticsVisitor.id, input.visitorId));

    /* ------------------------------------------------------ new session? */
    const insertedSession = await tx
      .insert(analyticsSession)
      .values({
        id: input.sessionId,
        visitorId: input.visitorId,
        userId: input.userId,
        startedAt: input.session.startedAt ?? now,
        lastActivityAt: now,
        landingPage: input.session.landingPage,
        referrer: input.session.referrerHost,
        referrerHost: input.session.referrerHost,
        deviceCategory: input.session.deviceCategory ?? input.visitor.deviceCategory,
        browser: input.session.browser ?? input.visitor.browser,
        os: input.session.os ?? input.visitor.os,
        viewportWidth: input.session.viewportWidth ?? input.visitor.viewportWidth,
        viewportHeight: input.session.viewportHeight ?? input.visitor.viewportHeight,
        locale: input.session.locale ?? input.visitor.locale,
        timezone: input.session.timezone ?? input.visitor.timezone,
        country: input.location.country,
        region: input.location.region ?? input.location.stateCode,
        city: input.location.city,
        locationType,
        locationSource: locationType ? "IP" : null,
        consentState: input.consentState,
        isBounced: true,
      })
      .onConflictDoNothing({ target: analyticsSession.id })
      .returning({ id: analyticsSession.id });

    const isNewSession = insertedSession.length > 0;

    if (isNewSession) {
      await tx
        .update(analyticsVisitor)
        .set({
          totalSessions: sql`${analyticsVisitor.totalSessions} + 1`,
          isReturning: true,
          updatedAt: now,
        })
        .where(
          and(
            eq(analyticsVisitor.id, input.visitorId),
            sql`${analyticsVisitor.totalSessions} > 0`,
          ),
        );
    }

    return { isNewVisitor, isNewSession };
  });
}

/**
 * Heartbeat for the Live Visitors view.
 *
 * Deliberately a plain UPDATE rather than a publish/subscribe channel: an
 * always-on connection per visitor is a real cost on a serverless runtime, and
 * "active in the last 5 minutes" is the same answer for a dashboard that a human
 * refreshes.
 */
export async function touchSession(input: {
  sessionId: string;
  visitorId: string;
  path?: string | null;
  durationSeconds?: number | null;
  pageView?: boolean;
  now?: Date;
}): Promise<void> {
  const db = getDb();
  const now = input.now ?? new Date();

  const updates: Record<string, unknown> = {
    lastActivityAt: now,
    durationSeconds: input.durationSeconds ?? sql`${analyticsSession.durationSeconds}`,
    isBounced: false,
  };
  if (input.path) updates.exitPage = input.path;

  await db
    .update(analyticsSession)
    .set(updates)
    .where(
      and(
        eq(analyticsSession.id, input.sessionId),
        eq(analyticsSession.visitorId, input.visitorId),
      ),
    );
}

/**
 * Join an anonymous visitor's history to an account.
 *
 * Called on login and on registration. It back-fills `user_id` across the
 * visitor, its sessions, and its location rows.
 *
 * What it deliberately does NOT do: read the customer's past searches and
 * present them to anyone without `analytics.customers`, merge two separate
 * visitor identities that happen to belong to one person, or touch anything the
 * customer explicitly declined. The join is per-visitor, so signing in on a shared
 * office computer does not splice two people's browsing together.
 */
export async function associateVisitorWithUser(input: {
  visitorId: string;
  userId: string;
}): Promise<{ sessionsLinked: number }> {
  const db = getDb();

  const sessionsLinked = await db
    .update(analyticsSession)
    .set({ userId: input.userId })
    .where(
      and(
        eq(analyticsSession.visitorId, input.visitorId),
        sql`${analyticsSession.userId} is null`,
      ),
    )
    .returning({ id: analyticsSession.id });

  await db
    .update(analyticsVisitor)
    .set({ userId: input.userId, updatedAt: new Date() })
    .where(eq(analyticsVisitor.id, input.visitorId));

  await db
    .update(analyticsLocation)
    .set({ userId: input.userId })
    .where(eq(analyticsLocation.visitorId, input.visitorId));

  await db
    .update(analyticsConsent)
    .set({ userId: input.userId })
    .where(eq(analyticsConsent.visitorId, input.visitorId));

  return { sessionsLinked: sessionsLinked.length };
}

/**
 * Find the visitor id belonging to a signed-in user's most recent device.
 *
 * Used by Customer 360 to relate an account to the browsing that preceded
 * registration on the same device. Returns null when there is none, which is the
 * common case for a customer who registered on a different phone than they shop
 * on.
 */
export async function findPrimaryVisitorForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: analyticsVisitor.id })
    .from(analyticsVisitor)
    .where(eq(analyticsVisitor.userId, userId))
    .orderBy(sql`${analyticsVisitor.lastSeenAt} desc`)
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Every visitor id linked to a user. A customer may browse on several devices. */
export async function listVisitorIdsForUser(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: analyticsVisitor.id })
    .from(analyticsVisitor)
    .where(eq(analyticsVisitor.userId, userId));
  return rows.map((row) => row.id);
}