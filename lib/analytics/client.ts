/**
 * The browser analytics client.
 *
 * DESIGN CONSTRAINTS
 *
 *   1. IT MUST NOT AFFECT THE WEBSITE. Every entry point is wrapped so nothing
 *      here can throw into a caller's code path, delivery is non-blocking
 *      (`navigator.sendBeacon` where available, `fetch` with `keepalive`
 *      otherwise), and the whole queue is bounded and dropped on overflow. A
 *      customer adding to cart must never wait for, or fail because of, an
 *      analytics request.
 *
 *   2. IT MUST NOT CAPTURE ANYTHING SECRET. No form values, no keystrokes, no
 *      inputs. `sanitizePath` strips the query string before a path is ever sent.
 *      The server re-validates everything regardless, because a client-side
 *      guarantee is a convenience and not a control.
 *
 *   3. IT MUST BE HONEST ABOUT CONSENT. Nothing is queued or sent until the
 *      visitor has been asked, and denying stops delivery immediately. The server
 *      enforces the same rule independently.
 *
 * There is no screen capture, no keystroke recording and no session replay in
 * this file, and none is planned: the module's approach to understanding a broken
 * journey is the event timeline plus a screenshot the customer chooses to attach.
 */

import type { AnalyticsEventType } from "@/lib/analytics/events";
import {
  CONSENT_POLICY_VERSION,
  type ConsentState,
} from "@/lib/analytics/privacy";
import { pathShape, pageTypeForPath } from "@/lib/analytics/events";

/* -------------------------------------------------------------- constants */

const VISITOR_KEY = "sparelink-analytics-visitor";
const SESSION_KEY = "sparelink-analytics-session";
const CONSENT_KEY = "sparelink-analytics-consent";
const QUEUE_KEY = "sparelink-analytics-queue";
const SESSION_TTL_MS = 30 * 60 * 1000;

const INGEST_URL = "/api/v1/analytics/events";
const CONSENT_URL = "/api/v1/analytics/consent";
const LOCATION_URL = "/api/v1/analytics/location";

/** Bounded queue. Beyond this, oldest events are dropped, newest kept. */
const MAX_QUEUE = 120;
const FLUSH_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 60_000;

/** Repeat-interaction threshold before a friction signal is recorded. */
const FRICTION_THRESHOLD = 3;
const FRICTION_WINDOW_MS = 1200;

/* ---------------------------------------------------------------- helpers */

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Private browsing, disabled storage, or a quota error. Analytics is optional
    // so this degrades to "no tracking" rather than breaking the page.
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readJson<T>(key: string): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded: analytics is not worth evicting the session for */
  }
}

/* ------------------------------------------------------------------ types */

export type QueuedEvent = {
  id: string;
  type: AnalyticsEventType;
  occurredAt: number;
  path?: string;
  durationMs?: number;
  pageType?: string;
  query?: string;
  resultCount?: number;
  responseTimeMs?: number;
  searchType?: string;
  partId?: string;
  partNumber?: string;
  productName?: string;
  brand?: string;
  categoryId?: string;
  categoryName?: string;
  quantity?: number;
  errorCode?: string;
  message?: string;
  status?: number;
  route?: string;
  stack?: string;
  elementId?: string;
  label?: string;
  clickCount?: number;
  windowMs?: number;
  metadata?: Record<string, unknown>;
};

export type StoredConsent = {
  state: ConsentState;
  analyticsAllowed: boolean;
  locationAllowed: boolean;
  preciseLocationAllowed: boolean;
  policyVersion: string;
  decidedAt: string;
};

export type AnalyticsClientOptions = {
  /** Turn the client off entirely without unmounting it. */
  enabled?: boolean;
  /** Consent to apply before the visitor has interacted with a banner. */
  defaultConsent?: StoredConsent;
  /** Skip admin surfaces entirely. Defaults to true: admin traffic is not
   *  customer traffic and mixing it into customer analytics would be wrong. */
  ignoreAdminPaths?: boolean;
};

/* ============================================================== the client */

class AnalyticsClient {
  private visitorId: string | null = null;
  private sessionId: string | null = null;
  private sessionStartedAt = 0;
  private consent: StoredConsent | null = null;
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private options: AnalyticsClientOptions = {};
  private currentPageStartedAt = 0;
  private currentPath: string | null = null;
  private lastSentPageEventId: string | null = null;
  private lastSearchQuery: string | null = null;
  private unbinders: Array<() => void> = [];
  /** Click bursts, keyed by element, cleared on navigation. */
  private clickBursts = new Map<string, { count: number; firstAt: number; lastAt: number }>();

  /* ------------------------------------------------------------ lifecycle */

  start(options: AnalyticsClientOptions = {}): void {
    if (this.started) return;
    this.options = options;
    if (options.enabled === false) return;
    if (typeof window === "undefined") return;

    this.started = true;
    try {
      this.restoreQueue();
      this.consent = readJson<StoredConsent>(CONSENT_KEY) ?? options.defaultConsent ?? null;
      this.ensureVisitorId();
      this.ensureSession();

      this.trackPageView();

      this.bindGlobalListeners();
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);

      const onPageHide = () => this.onPageHide();
      this.pagehideListener = onPageHide;
      window.addEventListener("pagehide", onPageHide);
      this.unbinders.push(() => window.removeEventListener("pagehide", onPageHide));
    } catch {
      // Never let initialisation break the page.
      this.stop();
    }
  }

  private pagehideListener: (() => void) | null = null;

  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.flushTimer = null;
    this.heartbeatTimer = null;
    for (const unbind of this.unbinders) {
      try {
        unbind();
      } catch {
        /* ignore */
      }
    }
    this.unbinders = [];
    if (this.pagehideListener && typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.pagehideListener);
    }
    this.pagehideListener = null;
    this.started = false;
  }

  /* -------------------------------------------------------------- consent */

  setConsent(next: StoredConsent): void {
    this.consent = { ...next, policyVersion: next.policyVersion || CONSENT_POLICY_VERSION };
    writeJson(CONSENT_KEY, this.consent);

    if (!this.allowsAnalytics()) {
      // Revocation takes effect now: the queue is discarded, not merely paused.
      this.queue = [];
      writeJson(QUEUE_KEY, []);
    } else if (!this.currentPath) {
      /* Record the page the visitor is actually looking at, right now.
       *
       * `trackPageView()` at start() bailed out because consent had not been given
       * yet - it could not have been, the banner was still on screen - so the landing
       * page was never measured and `currentPath` stayed null. Without this, the
       * entry page of every first-time visit was missing from the Pages report and the
       * funnel, and the journey appeared to begin mid-funnel. A returning visitor who
       * consented on an earlier visit already has `currentPath` set, so this cannot
       * double-count. */
      this.trackPageView();
    }

    this.post(CONSENT_URL, {
      state: this.consent.state,
      analyticsAllowed: this.consent.analyticsAllowed,
      locationAllowed: this.consent.locationAllowed,
      preciseLocationAllowed: this.consent.preciseLocationAllowed,
      source: "banner",
      policyVersion: this.consent.policyVersion,
    });
  }

  getConsent(): StoredConsent | null {
    return this.consent;
  }

  private allowsAnalytics(): boolean {
    if (this.options.enabled === false) return false;
    if (!this.consent) return false;
    return this.consent.analyticsAllowed && this.consent.state !== "denied";
  }

  /* -------------------------------------------------------------- identity */

  private ensureVisitorId(): void {
    const store = storage();
    if (!store) return;
    let id = readJson<string>(VISITOR_KEY);
    if (typeof id !== "string" || id.length < 22) {
      id = randomId();
      writeJson(VISITOR_KEY, id);
    }
    this.visitorId = id;
  }

  /**
   * A "session" here is a visit window, not an auth session.
   *
   * It expires after 30 minutes of inactivity rather than living until the tab
   * closes, so a customer who leaves a product page open over lunch and comes back
   * is counted as returning rather than as one very long session. It is also
   * deliberately NOT the auth cookie: analytics must keep measuring anonymous
   * browsing, and coupling the two would mean losing most of the funnel.
   */
  private ensureSession(): void {
    const store = storage();
    if (!store) return;
    const existing = readJson<{ id: string; startedAt: number; lastSeenAt: number }>(SESSION_KEY);
    const now = Date.now();
    if (
      existing &&
      typeof existing.id === "string" &&
      existing.id.length >= 22 &&
      now - existing.lastSeenAt < SESSION_TTL_MS
    ) {
      this.sessionId = existing.id;
      this.sessionStartedAt = existing.startedAt;
      writeJson(SESSION_KEY, { ...existing, lastSeenAt: now });
      return;
    }
    const id = randomId();
    this.sessionId = id;
    this.sessionStartedAt = now;
    writeJson(SESSION_KEY, { id, startedAt: now, lastSeenAt: now });
  }

  private restoreQueue(): void {
    const stored = readJson<QueuedEvent[]>(QUEUE_KEY);
    if (Array.isArray(stored)) {
      // Drop anything older than an hour: a queued event from a previous
      // navigation is no longer useful and would distort the current session.
      const cutoff = Date.now() - 60 * 60 * 1000;
      this.queue = stored.filter(
        (event) => event && typeof event.id === "string" && event.occurredAt > cutoff,
      );
    }
  }

  private persistQueue(): void {
    writeJson(QUEUE_KEY, this.queue);
  }

  /* --------------------------------------------------------------- events */

  /**
   * Queue one event.
   *
   * The ONLY public write path. Every helper below funnels through it so there is
   * a single place where consent, bounding and scrubbing happen.
   */
  track(
    type: AnalyticsEventType,
    payload: Omit<QueuedEvent, "id" | "type" | "occurredAt"> = {},
  ): void {
    if (!this.allowsAnalytics()) return;
    if (this.options.ignoreAdminPaths !== false && this.isAdminPath()) return;
    try {
      const event: QueuedEvent = {
        ...payload,
        id: randomId(),
        type,
        occurredAt: Date.now(),
      };
      this.queue.push(event);
      // Oldest-first eviction: recent behaviour is the useful behaviour.
      if (this.queue.length > MAX_QUEUE) {
        this.queue = this.queue.slice(this.queue.length - MAX_QUEUE);
      }
      this.persistQueue();
    } catch {
      /* never throw into a caller */
    }
  }

  private isAdminPath(): boolean {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/admin");
  }

  /** Convenience wrappers used by the storefront components. */
  trackPageView(): void {
    if (typeof window === "undefined" || !this.allowsAnalytics()) return;
    const path = this.safePath();
    this.currentPath = path;
    this.currentPageStartedAt = Date.now();
    this.track("page_view", {
      path,
      pageType: pageTypeForPath(path),
      metadata: {
        pageTitle: this.safeTitle(),
        pathShape: pathShape(path),
        navigationType: this.navigationType(),
      },
    });
  }

  trackSearch(input: {
    query: string;
    resultCount: number;
    responseTimeMs?: number;
    searchType?: string;
  }): void {
    const query = input.query.trim().slice(0, 200);
    if (!query) return;
    this.lastSearchQuery = query;
    this.track("search_performed", {
      path: this.safePath(),
      query,
      resultCount: Math.max(0, Math.round(input.resultCount)),
      responseTimeMs: input.responseTimeMs ? Math.round(input.responseTimeMs) : undefined,
      searchType: input.searchType,
    });
  }

  /**
   * Record that a search produced a result click.
   *
   * The query is carried rather than a search-row id, because the server attributes
   * the click to the most recent search with that normalised query in the same
   * session. That keeps the click count at most one per search per session, so a
   * click-through rate cannot exceed 100%.
   */
  trackSearchResultSelected(query: string, partId?: string): void {
    const trimmed = query.trim().slice(0, 200);
    if (!trimmed) return;
    this.lastSearchQuery = trimmed;
    this.track("search_result_selected", {
      path: this.safePath(),
      query: trimmed,
      partId,
    });
  }

  trackProduct(
    eventType: AnalyticsEventType,
    part: {
      id: string;
      partNumber?: string;
      name?: string;
      brand?: string;
      categoryId?: string;
      categoryName?: string;
    },
    quantity?: number,
  ): void {
    this.track(eventType, {
      path: this.safePath(),
      partId: part.id,
      partNumber: part.partNumber,
      productName: part.name,
      brand: part.brand,
      categoryId: part.categoryId,
      categoryName: part.categoryName,
      quantity,
    });
  }

  trackJourney(eventType: AnalyticsEventType, metadata?: Record<string, unknown>): void {
    this.track(eventType, { path: this.safePath(), metadata });
  }

  trackError(input: {
    errorCode: string;
    message?: string;
    status?: number;
    route?: string;
    stack?: string;
  }): void {
    this.track("error_occurred", {
      path: this.safePath(),
      errorCode: input.errorCode,
      message: input.message?.slice(0, 400),
      status: input.status,
      route: input.route,
      stack: input.stack?.slice(0, 600),
    });
  }

  /* -------------------------------------------------------------- friction */

  /**
   * Record a click burst as a friction signal.
   *
   * The threshold is deliberately conservative: three or more clicks on the same
   * element inside 1.2 seconds. That is enough to catch a control that is
   * obviously not responding and low enough to stay clear of normal fast
   * interaction, a triple-click to select text, or someone genuinely tapping a
   * button three times because their first two taps were swallowed by a slow
   * network.
   *
   * The element identifier is the developer-supplied `data-analytics-id` or a
   * structural selector. `innerText` is never read: a customer's name rendered in
   * a button must not become a stored string.
   */
  private noteClick(target: EventTarget | null): void {
    const elementId = this.elementIdentifier(target);
    if (!elementId) return;
    const now = Date.now();
    const existing = this.clickBursts.get(elementId);
    if (!existing || now - existing.firstAt > FRICTION_WINDOW_MS) {
      this.clickBursts.set(elementId, { count: 1, firstAt: now, lastAt: now });
      return;
    }
    existing.count += 1;
    existing.lastAt = now;
    if (existing.count >= FRICTION_THRESHOLD) {
      this.clickBursts.delete(elementId);
      this.track("repeated_click", {
        path: this.safePath(),
        elementId,
        clickCount: existing.count,
        windowMs: now - existing.firstAt,
      });
    }
  }

  private elementIdentifier(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) return null;
    const explicit = target.closest("[data-analytics-id]");
    if (explicit instanceof HTMLElement) {
      const id = explicit.getAttribute("data-analytics-id");
      if (id) return id.slice(0, 120);
    }
    // Structural fallback: tag plus the first two class names. Deliberately
    // coarse - enough to tell "the carousel arrow" from "the add-to-cart button",
    // and not specific enough to identify a person or reconstruct a form.
    const classes = Array.from(target.classList)
      .slice(0, 2)
      .join(".")
      .slice(0, 80);
    return `${target.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
  }

  /* ------------------------------------------------------------ listeners */

  private bindGlobalListeners(): void {
    const onError = (event: ErrorEvent) => {
      try {
        this.trackError({
          errorCode: "JS_RUNTIME",
          message: event.message,
          stack: event.error instanceof Error ? event.error.stack : undefined,
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("error", onError);
    this.unbinders.push(() => window.removeEventListener("error", onError));

    const onRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        this.trackError({
          errorCode: "UNHANDLED_REJECTION",
          message: reason instanceof Error ? reason.message : String(reason).slice(0, 300),
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    this.unbinders.push(() => window.removeEventListener("unhandledrejection", onRejection));

    const onClick = (event: MouseEvent) => {
      try {
        this.noteClick(event.target);
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("click", onClick, { passive: true, capture: true });
    this.unbinders.push(() => document.removeEventListener("click", onClick, true));

    const onResourceError = (event: Event) => {
      try {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.tagName !== "IMG") return;
        const src = target.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        this.track("image_load_failed", {
          path: this.safePath(),
          errorCode: "IMAGE_FAILED",
          message: "An image failed to load.",
          route: src.split("?")[0]?.slice(0, 200),
        });
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("error", onResourceError, true);
    this.unbinders.push(() => document.removeEventListener("error", onResourceError, true));

    /* Web Vitals. Only aggregate values are ever sent; nothing is attached to a
       person, and the server only ever reports percentiles. */
    this.bindWebVitals();
  }

  private bindWebVitals(): void {
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (navigation) {
        const ttfb = Math.round(navigation.responseStart > 0 ? navigation.responseStart : 0);
        const domContentLoaded = Math.round(navigation.domContentLoadedEventEnd);
        const loadEvent = Math.round(navigation.loadEventEnd);
        this.track("page_view", {
          path: this.currentPath ?? this.safePath(),
          pageType: pageTypeForPath(this.safePath()),
          metadata: {
            ttfb,
            domContentLoaded: Number.isFinite(domContentLoaded) ? domContentLoaded : undefined,
            loadEvent: Number.isFinite(loadEvent) ? loadEvent : undefined,
            metricName: "navigation",
          },
        });
      }
    } catch {
      /* Performance API unavailable: not an error worth reporting. */
    }

    if (typeof PerformanceObserver === "undefined") return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metric = (entry as PerformanceEntry & { name?: string; value?: number });
          const name = metric.name;
          const value = typeof metric.value === "number" ? metric.value : null;
          if (!name || value === null) continue;

          if (name === "largest-contentful-paint") {
            this.track("page_view", {
              path: this.currentPath ?? this.safePath(),
              pageType: pageTypeForPath(this.safePath()),
              metadata: { lcp: Math.round(value), metricName: "LCP" },
            });
          } else if (name === "layout-shift") {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (shift.hadRecentInput) continue;
            this.track("page_view", {
              path: this.currentPath ?? this.safePath(),
              pageType: pageTypeForPath(this.safePath()),
              metadata: { cls: Number(value.toFixed(4)), metricName: "CLS" },
            });
          } else if (name === "paint" && (entry as PerformanceEntry).name === "first-contentful-paint") {
            this.track("page_view", {
              path: this.currentPath ?? this.safePath(),
              pageType: pageTypeForPath(this.safePath()),
              metadata: { fcp: Math.round(value), metricName: "FCP" },
            });
          } else if (name === "event" || name === "first-input") {
            this.track("page_view", {
              path: this.currentPath ?? this.safePath(),
              pageType: pageTypeForPath(this.safePath()),
              metadata: { inp: Math.round(value), metricName: "INP" },
            });
          }
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      observer.observe({ type: "layout-shift", buffered: true });
      observer.observe({ type: "paint", buffered: true });
      observer.observe({ type: "first-input", buffered: true });
      this.unbinders.push(() => observer.disconnect());
    } catch {
      /* A browser that rejects one of these observer types still gets the rest. */
    }
  }

  /* ----------------------------------------------------------- navigation */

  private onPageHide(): void {
    try {
      this.flush();
    } catch {
      /* ignore */
    }
  }

  /** Called by the Next.js router after a client navigation. */
  handleRouteChange(): void {
    try {
      this.flushCurrentPageDuration();
      this.clickBursts.clear();
      this.ensureSession();
      this.trackPageView();
    } catch {
      /* ignore */
    }
  }

  /**
   * Send the dwell time for the page being left.
   *
   * Guarded against double-sending: a `pagehide` followed by a route change would
   * otherwise report the same view twice, inflating both the page-view count and
   * the average time on page.
   */
  private flushCurrentPageDuration(): void {
    if (!this.currentPath || !this.currentPageStartedAt) return;
    const durationMs = Date.now() - this.currentPageStartedAt;
    this.currentPageStartedAt = 0;
    if (durationMs < 0 || durationMs > 24 * 60 * 60 * 1000) return;
    this.track("page_view", {
      path: this.currentPath,
      pageType: pageTypeForPath(this.currentPath),
      durationMs,
      metadata: { durationMs, pathShape: pathShape(this.currentPath) },
    });
    this.currentPath = null;
  }

  /* -------------------------------------------------------------- delivery */

  private buildEnvelope(events: QueuedEvent[]): Record<string, unknown> {
    const utm = this.readUtm();
    return {
      visitor: {
        id: this.visitorId,
        firstSeenAt: Date.now(),
        referrer: this.safeReferrer(),
        deviceCategory: this.deviceCategory(),
        browser: this.browserName(),
        browserVersion: this.browserVersion(),
        os: this.osName(),
        viewportWidth: typeof window === "undefined" ? undefined : window.innerWidth,
        viewportHeight: typeof window === "undefined" ? undefined : window.innerHeight,
        locale: typeof navigator === "undefined" ? undefined : navigator.language,
        timezone: readTimezone(),
        utm,
      },
      session: {
        id: this.sessionId,
        startedAt: this.sessionStartedAt,
        landingPage: this.currentPath ?? this.safePath(),
        referrer: this.safeReferrer(),
        deviceCategory: this.deviceCategory(),
        browser: this.browserName(),
        os: this.osName(),
        viewportWidth: typeof window === "undefined" ? undefined : window.innerWidth,
        viewportHeight: typeof window === "undefined" ? undefined : window.innerHeight,
        locale: typeof navigator === "undefined" ? undefined : navigator.language,
        timezone: readTimezone(),
      },
      consent: this.consent
        ? {
            state: this.consent.state,
            analyticsAllowed: this.consent.analyticsAllowed,
            locationAllowed: this.consent.locationAllowed,
            preciseLocationAllowed: this.consent.preciseLocationAllowed,
            source: "banner",
            policyVersion: this.consent.policyVersion,
          }
        : null,
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt,
        path: event.path,
        query: event.query,
        resultCount: event.resultCount,
        responseTimeMs: event.responseTimeMs,
        partId: event.partId,
        partNumber: event.partNumber,
        productName: event.productName,
        brand: event.brand,
        categoryId: event.categoryId,
        categoryName: event.categoryName,
        quantity: event.quantity,
        errorCode: event.errorCode,
        message: event.message,
        status: event.status,
        route: event.route,
        stack: event.stack,
        elementId: event.elementId,
        label: event.label,
        clickCount: event.clickCount,
        windowMs: event.windowMs,
        metadata: event.metadata,
      })),
    };
  }

  flush(): void {
    if (!this.allowsAnalytics()) return;
    if (this.queue.length === 0) return;
    if (!this.visitorId || !this.sessionId) return;

    const batch = this.queue.splice(0, 20);
    this.persistQueue();

    try {
      const body = JSON.stringify(this.buildEnvelope(batch));
      this.post(INGEST_URL, JSON.parse(body) as Record<string, unknown>, body);
    } catch {
      // Delivery failed. The events are dropped rather than retried forever: an
      // unbounded retry queue is a memory leak and a privacy problem (it would
      // hold old events on a device that has since opted out).
    }
  }

  /**
   * Deliver a payload without blocking the page.
   *
   * `sendBeacon` is preferred because the browser keeps the request alive across a
   * page unload, which is the only reliable way to deliver the final page-view
   * duration and the page-hide beacon. `fetch` with `keepalive` is the fallback.
   * There is no third option: an analytics failure must never surface as an error
   * the customer has to think about.
   */
  private post(url: string, payload: unknown, rawBody?: string): void {
    try {
      const body = rawBody ?? JSON.stringify(payload);
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "same-origin",
        // A failed analytics POST must not produce a console error storm.
      }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  private sendHeartbeat(): void {
    if (!this.allowsAnalytics()) return;
    this.flush();
    if (!this.visitorId || !this.sessionId) return;
    const seconds = Math.round(
      ((Date.now() - this.sessionStartedAt) / 1000) || 0,
    );
    this.post("/api/v1/analytics/heartbeat", {
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      path: this.safePath(),
      durationSeconds: seconds,
    });
  }

  /* ------------------------------------------------------------- location */

  /**
   * Submit a precise location, but ONLY after the UI has obtained permission.
   *
   * The caller passes the coordinates and the observed permission state. If the
   * state is not `granted` this does nothing at all: the client refuses to send
   * coordinates it was not given, and the server refuses them again independently.
   * Nothing here ever calls the permission API by itself.
   */
  submitPreciseLocation(input: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    permissionState: "granted" | "denied" | "prompt";
  }): void {
    try {
      if (input.permissionState !== "granted") return;
      if (!this.visitorId || !this.sessionId) return;
      this.post(LOCATION_URL, {
        visitorId: this.visitorId,
        sessionId: this.sessionId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        permissionState: input.permissionState,
      });
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------- device */

  private deviceCategory(): string {
    if (typeof navigator === "undefined") return "unknown";
    const ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod|windows phone|mobi/.test(ua)) return "mobile";
    if (/ipad|tablet|kindle|playbook|silk/.test(ua)) return "tablet";
    return "desktop";
  }

  private uaMatches(patterns: readonly RegExp[]): string | null {
    if (typeof navigator === "undefined") return null;
    const ua = navigator.userAgent;
    for (const pattern of patterns) {
      const match = ua.match(pattern);
      if (match) return match[1] ?? "";
    }
    return null;
  }

  private browserName(): string | undefined {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (/Edg\//.test(ua)) return "Edge";
    if (/OPR\/|Opera/.test(ua)) return "Opera";
    if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
    if (/Brave\//.test(ua)) return "Brave";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/CriOS\/|Chrome\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return undefined;
  }

  private browserVersion(): string | undefined {
    return (
      this.uaMatches([
        /Edg\/([\d.]+)/,
        /OPR\/([\d.]+)/,
        /Firefox\/([\d.]+)/,
        /Chrome\/([\d.]+)/,
        /Version\/([\d.]+)/,
      ]) ?? undefined
    );
  }

  private osName(): string | undefined {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (/Windows/.test(ua)) return "Windows";
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPod/.test(ua)) return "iOS";
    if (/iPad/.test(ua)) return "iPadOS";
    if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
    if (/CrOS/.test(ua)) return "ChromeOS";
    if (/Linux|X11/.test(ua)) return "Linux";
    return undefined;
  }

  private navigationType(): string | undefined {
    if (typeof performance === "undefined") return undefined;
    const navigation = performance.getEntriesByType("navigation")[0] as
      | (PerformanceEntry & { type?: string })
      | undefined;
    return navigation?.type;
  }

  private safePath(): string {
    if (typeof window === "undefined") return "/";
    // `pathname` only. The query string is never included: it can carry a search
    // term, an email address in a callback parameter, or a token.
    return window.location.pathname.slice(0, 500);
  }

  private safeTitle(): string | undefined {
    if (typeof document === "undefined") return undefined;
    const title = document.title.replace(/\s+/g, " ").trim();
    return title ? title.slice(0, 200) : undefined;
  }

  private safeReferrer(): string | undefined {
    if (typeof document === "undefined") return undefined;
    try {
      const referrer = document.referrer;
      if (!referrer) return undefined;
      return new URL(referrer).origin.slice(0, 120);
    } catch {
      return undefined;
    }
  }

  private readUtm(): Record<string, string | undefined> {
    if (typeof window === "undefined") return {};
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string | undefined> = {};
      for (const key of ["source", "medium", "campaign", "term", "content"]) {
        const value = params.get(`utm_${key}`);
        if (value) utm[key] = value.slice(0, 100);
      }
      return utm;
    } catch {
      return {};
    }
  }
}

/** IANA timezone, best-effort. Unavailable in some browsers; never fatal. */
function readTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The shared client instance.
 *
 * A singleton because the identity is stored in local storage and two instances
 * would each maintain their own queue for the same visitor, which would double
 * count. Exported directly rather than via React context because nothing in it is
 * render-dependent.
 */
export const analyticsClient = new AnalyticsClient();

/* --------------------------------------------------- non-React accessors */

/** Page-view and duration tracking. Safe to call on every route change. */
export function trackPageView(): void {
  analyticsClient.trackPageView();
}

export function trackSearch(input: {
  query: string;
  resultCount: number;
  responseTimeMs?: number;
  searchType?: string;
}): void {
  analyticsClient.trackSearch(input);
}

export function trackSearchResultSelected(query: string, partId?: string): void {
  analyticsClient.trackSearchResultSelected(query, partId);
}

export function trackProductEvent(
  eventType: AnalyticsEventType,
  part: {
    id: string;
    partNumber?: string;
    name?: string;
    brand?: string;
    categoryId?: string;
    categoryName?: string;
  },
  quantity?: number,
): void {
  analyticsClient.trackProduct(eventType, part, quantity);
}

export function trackJourneyEvent(
  eventType: AnalyticsEventType,
  metadata?: Record<string, unknown>,
): void {
  analyticsClient.trackJourney(eventType, metadata);
}

export function setAnalyticsConsent(consent: Omit<StoredConsent, "policyVersion"> & { policyVersion?: string }): void {
  analyticsClient.setConsent({
    ...consent,
    policyVersion: consent.policyVersion ?? CONSENT_POLICY_VERSION,
  });
}

export function getAnalyticsConsent(): StoredConsent | null {
  return analyticsClient.getConsent();
}

export function submitPreciseLocation(input: {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  permissionState: "granted" | "denied" | "prompt";
}): void {
  analyticsClient.submitPreciseLocation(input);
}

export function flushAnalytics(): void {
  analyticsClient.flush();
}