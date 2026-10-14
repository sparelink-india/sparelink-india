/**
 * Privacy and data-minimisation rules for analytics.
 *
 * This module is the reason the analytics data set can be trusted. Everything it
 * exports is deliberately pure and dependency-free so it can be exhaustively
 * unit-tested: a redaction function that is only exercised in production is a
 * redaction function that will eventually leak.
 *
 * THE RULE
 *   Analytics never stores a secret, and never stores anything that identifies a
 *   person beyond what a retailer legitimately needs to answer "where is this
 *   customer and what were they trying to buy".
 *
 * There are three layers of defence, in order of strength:
 *
 *   1. STRUCTURAL. `drizzle/schema.ts` has no column that could hold a password,
 *      OTP, card number or token. See the module header there. Nothing can write
 *      one because nowhere to write one exists.
 *
 *   2. ALLOW-LIST. `METADATA_ALLOWED_KEYS` below is a closed set. An unknown key
 *      is DROPPED, not truncated or renamed. A new call site cannot accidentally
 *      start persisting a field by passing it through; the field has to be added
 *      here deliberately, in review, with a reason.
 *
 *   3. DEFENCE IN DEPTH. Even an allow-listed value goes through
 *      `scrubSensitiveText`, which catches the plausible accidental cases:
 *      a bearer token pasted into a message, a card number typed into a search
 *      box, an OTP typed into a search box.
 */

import type { AnalyticsEventType } from "@/lib/analytics/events";

/* ------------------------------------------------------- sensitive markers */

/**
 * Keys and value patterns that must never be persisted, matched
 * case-insensitively anywhere in a key name.
 *
 * Note that `card` is included but `cardNumber`-adjacent business terms like
 * "card_added" are event TYPES, not metadata keys, so they are unaffected.
 */
export const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /pass(word|wd|phrase)?/i,
  /otp/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /card[-_]?number/i,
  /card[-_]?detail/i,
  /pan[-_]?number/i,
  /\bpan\b/i,
  /upi/i,
  /vpa/i,
  /\bifsc\b/i,
  /account[-_]?number/i,
  /bank[-_]?account/i,
  /secret/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /\bid[-_]?token\b/i,
  /session[-_]?token/i,
  /auth[-_]?token/i,
  /\btoken\b/i,
  /authorization/i,
  /cookie/i,
  /session[-_]?id[-_]?cookie/i,
  /bearer/i,
  /signature/i,
  /private[-_]?key/i,
  /credential/i,
  /auth/i,
  /salt/i,
  /hash/i,
  /gstin/i,
  /aadhaar/i,
  /aadhar/i,
  /pan[-_]?card/i,
];

/**
 * Value patterns that are secrets regardless of the key they arrive under.
 * Applied to free text (search queries, problem descriptions, error messages).
 */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  // A six-digit OTP on its own or after common labels.
  /(?:\botp\b|\bcode\b|verification)\s*(?:is|:|=)?\s*\d{4,8}\b/gi,
  /\b\d{4,8}\b(?=\s*(?:is\s+)?(?:your\s+)?(?:otp|one[\s-]?time))/gi,
  // A card number: 13-19 digits, optionally grouped by spaces or dashes.
  /\b(?:\d[ -]?){13,19}\b/g,
  // Card-like CVV: three or four digits immediately after a CVV label.
  /\bcvv\b\s*(?:is|:|=)?\s*\d{3,4}\b/gi,
  // A UPI id.
  /\b[\w.-]{2,64}@[\w-]{2,32}\b/g,
  // A bearer token.
  /\b(?:bearer|token)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  // A JSON Web Token.
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // An email address, in free text where an email has no business being.
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // A phone number. Retained in free text because a customer pasting their own
  // number into a search box is exactly the personal-data leak this guards.
  /\b(?:\+?91[- ]?)?[6-9]\d{9}\b/g,
];

export const REDACTED = "[redacted]";

/* ------------------------------------------------------------- allow-list */

/**
 * The ONLY metadata keys that may be persisted on an analytics event.
 *
 * Every entry exists because a specific report needs it. If you cannot name the
 * report, do not add the key.
 */
export const METADATA_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  /* page / navigation */
  "pageType",
  "pathShape",
  "queryParamCount",
  "navigationType",

  /* search */
  "resultCount",
  "searchType",
  "selectedIndex",
  "responseTimeMs",

  /* product */
  "partId",
  "partNumber",
  "brand",
  "categoryId",
  "categoryName",
  "quantity",
  "listingId",
  "position",

  /* cart / checkout */
  "itemCount",
  "cartValuePaise",
  "currency",
  "step",
  "paymentMethod",
  "paymentProvider",
  "failureCode",
  "failureReason",
  "isRetry",

  /* orders */
  "orderId",
  "orderCount",
  "returnCount",

  /* diagnostics */
  "status",
  "durationMs",
  "metricName",
  "metricValue",
  "apiRoute",
  "method",
  "imageSrc",
  "elementId",
  "clickCount",
  "windowMs",
  "fieldName",
  "attemptCount",

  /* web vitals */
  "ttfb",
  "fcp",
  "lcp",
  "cls",
  "inp",
  "domContentLoaded",
  "loadEvent",
  "resourceCount",
  "transferBytes",

  /* location (coarse only — never raw coordinates) */
  "locationSource",
  "locationType",
  "accuracyBucket",
  "permissionState",

  /* consent */
  "consentSource",
  "policyVersion",
]);

/**
 * Metadata keys allowed on friction reports specifically. A friction report is
 * about an element, so the element identifier and a repeat count are needed, but
 * nothing about what the customer typed.
 */
export const FRICTION_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "elementId",
  "clickCount",
  "windowMs",
  "attemptCount",
  "fieldName",
  "pathShape",
  "pageType",
  "durationMs",
  "status",
  "apiRoute",
  "method",
]);

/* ------------------------------------------------------------ size limits */

/** Hard ceilings. A payload that exceeds these is rejected, not truncated. */
export const LIMITS = {
  /** Whole ingest body. */
  maxBodyBytes: 64 * 1024,
  /** One event's serialised metadata. */
  maxMetadataBytes: 2 * 1024,
  /** One free-text field (query, description, label). */
  maxFreeTextChars: 300,
  /** Number of events in one batch. */
  maxEventsPerBatch: 50,
  /** Number of distinct metadata keys on one event. */
  maxMetadataKeys: 24,
  /** Path length. */
  maxPathChars: 512,
  /** Page title length. */
  maxTitleChars: 200,
  /** Problem report description. */
  maxDescriptionChars: 2000,
  /** Screenshot upload. */
  maxScreenshotBytes: 3 * 1024 * 1024,
  /** Search result count that is still a believable number. */
  maxResultCount: 100_000,
  /** Any duration we will accept, in ms. One day. */
  maxDurationMs: 24 * 60 * 60 * 1000,
  /** Any metric value we will accept. */
  maxMetricValue: 1_000_000_000,
} as const;

/* --------------------------------------------------------------- helpers */

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Replace every secret-looking span in a free-text string.
 *
 * The input is returned unchanged when nothing matched, so the common case
 * allocates nothing and the original string is preserved exactly.
 */
export function scrubSensitiveText(value: string): string {
  let output = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    // Patterns with the `g` flag are stateful; reset lastIndex between uses so a
    // module-level regex cannot leak state between two unrelated callers.
    pattern.lastIndex = 0;
    output = output.replace(pattern, REDACTED);
  }
  return output;
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return scrubSensitiveText(value).slice(0, LIMITS.maxFreeTextChars);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.max(-LIMITS.maxMetricValue, Math.min(LIMITS.maxMetricValue, Math.round(value)));
  }
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return null;
  // Objects and arrays are not accepted in analytics metadata. A nested
  // structure is how an unredacted payload gets through a shallow filter.
  return null;
}

export type ScrubResult = {
  value: Record<string, unknown>;
  /** Keys removed because they were not allow-listed. */
  droppedKeys: string[];
  /** Keys removed because they matched a sensitive pattern. */
  sensitiveKeys: string[];
  /** True when the result was rejected for exceeding a hard limit. */
  rejected: boolean;
  reason?: string;
};

/**
 * Reduce arbitrary client metadata to a safe, bounded, allow-listed map.
 *
 * The order is deliberate: reject first, then allow-list, then scrub. Scrubbing
 * first would spend work on fields that are about to be dropped anyway, and
 * allow-listing first would mean scrubbing before deciding what to keep.
 */
export function scrubMetadata(
  input: unknown,
  allowedKeys: ReadonlySet<string> = METADATA_ALLOWED_KEYS,
): ScrubResult {
  const empty: ScrubResult = {
    value: {},
    droppedKeys: [],
    sensitiveKeys: [],
    rejected: false,
  };

  if (input === null || input === undefined) return empty;
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ...empty, rejected: true, reason: "Metadata must be an object." };
  }

  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > LIMITS.maxMetadataKeys * 4) {
    return {
      ...empty,
      rejected: true,
      reason: `Too many metadata keys (${entries.length}).`,
    };
  }

  const value: Record<string, unknown> = {};
  const droppedKeys: string[] = [];
  const sensitiveKeys: string[] = [];

  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.slice(0, 64);

    if (isSensitiveKey(key)) {
      sensitiveKeys.push(key);
      continue;
    }
    if (!allowedKeys.has(key)) {
      droppedKeys.push(key);
      continue;
    }
    if (rawValue === null || rawValue === undefined) continue;

    const scrubbed = scrubValue(rawValue);
    if (scrubbed === null && rawValue !== null && rawValue !== undefined) {
      droppedKeys.push(key);
      continue;
    }
    value[key] = scrubbed;
  }

  const serialised = JSON.stringify(value);
  if (serialised && serialised.length > LIMITS.maxMetadataBytes) {
    return {
      value: {},
      droppedKeys,
      sensitiveKeys,
      rejected: true,
      reason: `Metadata exceeds ${LIMITS.maxMetadataBytes} bytes.`,
    };
  }

  return { value, droppedKeys, sensitiveKeys, rejected: false };
}

/**
 * Sanitise a search query before it is stored or exported.
 *
 * Searches are the single highest-risk free-text field in the system: customers
 * paste part numbers, but they also paste phone numbers and occasionally an OTP
 * when they think the search box is a support channel. Redacting those is the
 * difference between a demand report and a personal-data leak.
 *
 * The result keeps enough structure to group by: punctuation and casing are
 * normalised, but the token sequence is preserved.
 */
export function sanitizeSearchQuery(query: string): {
  query: string;
  normalized: string;
  redacted: boolean;
} {
  const redactedText = scrubSensitiveText(query.trim());
  const redacted = redactedText !== query.trim();
  const clipped = redactedText.slice(0, LIMITS.maxFreeTextChars);
  return {
    query: clipped,
    normalized: normaliseSearchQuery(clipped),
    redacted,
  };
}

/**
 * Normalised form used for grouping. Lowercased, whitespace collapsed, and
 * punctuation reduced to single spaces so "Bosch  Brake-Pad" and "bosch brake
 * pad" are one query in the report.
 */
export function normaliseSearchQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.maxFreeTextChars);
}

/**
 * Sanitise a free-text field such as a problem report description or an error
 * message. Redacts secrets, strips control characters, and clips.
 */
export function sanitizeFreeText(
  value: string | null | undefined,
  maxChars: number = LIMITS.maxFreeTextChars,
): string | null {
  if (typeof value !== "string") return null;
  // Control characters (except newline/tab) are stripped rather than encoded:
  // they have no legitimate use in a report and are a log-injection vector.
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return scrubSensitiveText(cleaned).slice(0, maxChars);
}

/**
 * Sanitise a path for storage and for grouping.
 *
 * A path can arrive with a query string, and a query string can carry a search
 * term, an email address in a `?email=` parameter, or a token in a callback URL.
 * Only the pathname is ever stored.
 */
export function sanitizePath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const pathname = value.split("?")[0]?.split("#")[0]?.trim();
  if (!pathname) return null;
  const clipped = pathname.slice(0, LIMITS.maxPathChars);
  return /[\s<>"'\\]/.test(clipped) ? null : clipped;
}

/**
 * Reduce a referrer to a host, dropping the path.
 *
 * A full referrer URL leaks the customer's browsing: `?q=...`, `?session=...`,
 * or an internal host name. Only the scheme-less host is kept, and it is
 * length-capped and character-filtered.
 */
/**
 * A hostname: two or more dot-separated labels, each starting and ending
 * alphanumeric with optional hyphens inside. This is the RFC 1123 shape, and it
 * excludes the things a loose character filter would wave through — an empty
 * label (`a..b`), a leading dot, a trailing hyphen, a credential (`u:p@h`).
 */
const HOSTNAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Host names with no dot in them.
 *
 * A real referrer on the public internet always has a registrable domain, so a
 * single label is almost always junk — `a`, `search`, `intranet`. `localhost` is
 * the one exception that matters: it is the referrer of every page served from
 * a development machine, and silently dropping it would leave the traffic report
 * blank for anyone testing off the public internet.
 */
const DOTLESS_HOSTS: ReadonlySet<string> = new Set(["localhost"]);

export function sanitizeReferrerHost(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  let host = trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    /* Only a real web URL is worth parsing. Anything else — `javascript:`,
       `mailto:`, `data:` — has no host to attribute a visit to, and treating
       the whole string as a host would be worse than refusing it. */
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    // `URL` drops any userinfo, so `https://user:pass@host/` cannot smuggle a
    // credential into the report.
    host = parsed.host;
  } else if (trimmed.includes("://") || trimmed.includes("@")) {
    return null;
  } else {
    // A bare host, possibly with a path or a port, as a Refer-Policy-stripped
    // referrer arrives.
    host = trimmed.split("/")[0] ?? "";
  }

  host = host.replace(/:\d+$/, "");
  if (!host || host.length > 120) return null;
  /* Validate, never repair. Deleting the characters a hostname may not contain
     would turn "not a host" into "notahost" — a plausible-looking referrer that
     never existed, which is worse in a traffic report than no referrer at all. */
  if (!HOSTNAME_PATTERN.test(host) && !DOTLESS_HOSTS.has(host)) return null;
  return host;
}

/* ---------------------------------------------------------------- consent */

export const CONSENT_STATES = ["pending", "granted", "partial", "denied"] as const;
export type ConsentState = (typeof CONSENT_STATES)[number];

export const CONSENT_POLICY_VERSION = "2026-10-analytics-v1";

/**
 * Decide whether an event may be persisted, given a visitor's consent record.
 *
 * Server-side enforcement is the whole point of this function. The client also
 * checks its own preference so it stops queueing, but a client is not a control:
 * if the only enforcement were client-side, clearing local storage and replaying
 * the queue would bypass it. Here the answer is authoritative.
 *
 * Note what is NOT gated: the `error_occurred` family is always accepted.
 * Denying analytics must not mean losing the ability to fix a broken checkout,
 * and an error record carries no behavioural history and no visitor identity
 * that is not already on the row.
 */
export function eventAllowedUnderConsent(
  consentState: ConsentState,
  eventType: AnalyticsEventType,
): boolean {
  if (consentState === "granted") return true;
  if (consentState === "pending") return isOperationalEvent(eventType);
  if (consentState === "partial") {
    return isOperationalEvent(eventType) || eventType === "page_view";
  }
  // denied
  return isOperationalEvent(eventType);
}

/**
 * Events that survive a denied consent because the website must stay
 * diagnosable. Errors only: they describe a fault, not the customer.
 */
export function isOperationalEvent(eventType: AnalyticsEventType): boolean {
  return (
    eventType === "error_occurred" ||
    eventType === "api_error" ||
    eventType === "image_load_failed" ||
    eventType === "search_error" ||
    eventType === "payment_integration_error"
  );
}

/* ------------------------------------------------------------ user export */

/**
 * Fields that describe a customer rather than an analytics measurement.
 *
 * Used by the customer data-export path (`/api/v1/account/analytics-export`) and
 * asserted in tests so a new field cannot quietly join an export.
 */
export const PERSONAL_DATA_FIELDS: readonly string[] = [
  "email",
  "phoneNumber",
  "name",
  "contactName",
  "businessName",
  "shippingAddress",
  "billingAddress",
  "gstin",
  "latitude",
  "longitude",
  "ipAddress",
];

export function responseContainsPersonalData(value: unknown): boolean {
  let text: string;
  try {
    text = JSON.stringify(value) ?? "";
  } catch {
    return false;
  }
  if (!text) return false;
  return PERSONAL_DATA_FIELDS.some((field) =>
    new RegExp(`"${field}"\\s*:`, "i").test(text),
  );
}
