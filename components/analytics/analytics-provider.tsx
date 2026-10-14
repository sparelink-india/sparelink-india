"use client";

/**
 * React surface for the analytics module.
 *
 * A thin, dependency-free binding over `lib/analytics/client.ts`. The client itself
 * is deliberately not a React component: it owns a queue and an identity in local
 * storage, it does not render anything, and two instances must never exist. This file
 * only mounts it once and exposes the hooks the storefront components call.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import type { AnalyticsEventType } from "@/lib/analytics/events";
import {
  analyticsClient,
  getAnalyticsConsent,
  submitPreciseLocation as clientSubmitPreciseLocation,
  trackJourneyEvent,
  trackProductEvent,
  trackSearch as clientTrackSearch,
} from "@/lib/analytics/client";
import type { StoredConsent } from "@/lib/analytics/client";

export type ProductRef = {
  id: string;
  partNumber?: string;
  name?: string;
  brand?: string;
  categoryId?: string;
  categoryName?: string;
};

/* ================================================================= provider */

/**
 * Mount the analytics client.
 *
 * Rendered once from the root layout, above the storefront, so it observes route
 * changes for the whole site.
 *
 * `defaultConsent` is the state to apply before the visitor has been asked. It
 * defaults to DENIED: nothing is measured until someone actively opts in, which is
 * the only defensible default for a system that has not asked the question yet.
 *
 * Mounting this component has no visible effect and cannot fail the page: every
 * initialisation path is wrapped, and the client stops itself on any error.
 */
export function AnalyticsProvider({
  defaultConsent,
  enabled = true,
}: {
  defaultConsent?: StoredConsent;
  enabled?: boolean;
}) {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    analyticsClient.start({ enabled: true, defaultConsent, ignoreAdminPaths: true });

    /* Link this device's anonymous history to the account, if the visitor is now
       signed in. One small request per session; the endpoint is a 204 no-op for an
       anonymous visitor, so it costs nothing in the common case. */
    const identify = () => {
      try {
        const raw = window.localStorage.getItem("sparelink-analytics-visitor");
        if (!raw) return;
        const visitorId = JSON.parse(raw) as string;
        if (typeof visitorId !== "string" || visitorId.length < 22) return;
        void fetch("/api/v1/analytics/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ visitorId }),
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        /* storage unavailable: nothing to link */
      }
    };
    identify();
    window.setTimeout(identify, 2500);

    return () => {
      /* Deliberately NOT `stop()`. A client-side navigation that unmounts and
         remounts the provider would otherwise drop the queue and lose the session
         heartbeat. `stop()` exists for teardown in tests; the singleton is
         intentionally long-lived for the lifetime of the tab. */
    };
  }, [enabled, defaultConsent]);

  /* Record a page view for every client-side navigation.
   *
   * WITHOUT this, only the FIRST page of a session was ever measured. `start()`
   * records the landing page, but the storefront is a single-page app: every
   * subsequent route change is a client-side transition that nothing was listening
   * for. The Pages report, the per-page funnel, the average-time-on-page figure and
   * the Live Visitors "current page" column therefore all showed the entry URL and
   * nothing else - and because the queue was empty after the first page, `flush()`
   * had nothing to send, so it looked like the whole module was dead rather than
   * partially wired.
   *
   * `usePathname` from the App Router is the correct signal: it changes on every
   * client-side navigation. The first render is skipped, because `start()` has
   * already recorded the landing page.
   */
  useEffect(() => {
    if (!enabled) return;
    if (typeof pathname !== "string") return;
    const next = pathname.startsWith("/") ? pathname : `/${pathname}`;
    if (lastPathRef.current === null) {
      lastPathRef.current = next;
      return;
    }
    if (lastPathRef.current === next) return;
    lastPathRef.current = next;
    try {
      analyticsClient.handleRouteChange();
    } catch {
      /* Analytics must never break a navigation. */
    }
  }, [enabled, pathname]);

  return null;
}

/* ==================================================================== hooks */

/**
 * Current tracking preference, or null before the visitor has answered.
 *
 * Uses `useSyncExternalStore` rather than `useState` + `useEffect`, which is the
 * correct primitive for reading something that lives outside React (local storage).
 * It also solves the hydration problem properly: the server snapshot is always null,
 * so the first server render and the first client render agree, and the real value
 * appears on the second pass. A lazy `useState` initialiser would read local storage
 * during the first client render and produce a hydration mismatch instead.
 */
const CONSENT_SUBSCRIBERS = new Set<() => void>();

export function useAnalyticsConsentState(): StoredConsent | null {
  return useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );
}

function subscribeConsent(onStoreChange: () => void): () => void {
  CONSENT_SUBSCRIBERS.add(onStoreChange);
  return () => {
    CONSENT_SUBSCRIBERS.delete(onStoreChange);
  };
}

function getConsentSnapshot(): StoredConsent | null {
  return getAnalyticsConsent();
}

function getConsentServerSnapshot(): StoredConsent | null {
  return null;
}

/**
 * Notify React that the preference changed.
 *
 * Called by the consent control after a decision. Without this the preferences panel
 * would keep showing the old value until a full page reload.
 */
export function notifyConsentChanged(): void {
  for (const subscriber of CONSENT_SUBSCRIBERS) {
    try {
      subscriber();
    } catch {
      /* a failing subscriber must not break the consent write that just happened */
    }
  }
}

/** Record a meaningful search. A no-op without consent. */
export function useTrackSearch() {
  return useCallback(
    (input: { query: string; resultCount: number; responseTimeMs?: number; searchType?: string }) => {
      clientTrackSearch(input);
    },
    [],
  );
}

/** Record product behaviour. A no-op without consent. */
export function useTrackProduct() {
  return useCallback(
    (eventType: AnalyticsEventType, part: ProductRef, quantity?: number) => {
      trackProductEvent(eventType, part, quantity);
    },
    [],
  );
}

/** Record a journey milestone (cart, checkout, enquiry, order…). */
export function useTrackJourney() {
  return useCallback(
    (eventType: AnalyticsEventType, metadata?: Record<string, unknown>) => {
      trackJourneyEvent(eventType, metadata);
    },
    [],
  );
}

/**
 * Submit a precise location.
 *
 * `permissionState` is REQUIRED and must be the state the browser actually
 * reported. This hook never calls the geolocation API: the caller asks, at the
 * moment the customer requested something that needs it, and passes the outcome.
 * A `denied` or `prompt` result does nothing at all.
 */
export function useSubmitPreciseLocation() {
  return useCallback(
    (input: {
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
      permissionState: "granted" | "denied" | "prompt";
    }) => {
      clientSubmitPreciseLocation(input);
    },
    [],
  );
}

/**
 * Ask the browser for location permission.
 *
 * Only ever call this at the point a customer has asked for something that needs
 * their position, and only after explaining why. The returned state is what must be
 * passed to `useSubmitPreciseLocation`.
 */
export function useRequestLocationPermission(): () => Promise<{
  state: "granted" | "denied" | "prompt" | "unsupported";
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}> {
  return useCallback(async () => {
    /* Imported from `browser-location`, not `location`. The latter reaches
       `lib/db`, and a lazy import is followed just as eagerly as a static one, so
       importing it from a client component would ship the database driver to the
       browser. `lib/analytics/client-boundary.test.ts` enforces this. */
    const { requestPermission } = await import("@/lib/analytics/browser-location");
    const result = await requestPermission();
    if (result.state === "granted" && result.latitude !== undefined && result.longitude !== undefined) {
      clientSubmitPreciseLocation({
        latitude: result.latitude,
        longitude: result.longitude,
        accuracyMeters: result.accuracyMeters,
        permissionState: "granted",
      });
    }
    return result;
  }, []);
}

export type { StoredConsent };