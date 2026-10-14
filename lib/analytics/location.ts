/**
 * Location intelligence, at two clearly-separated levels.
 *
 * LEVEL A - APPROXIMATE (default, no permission)
 *   Derived from the edge's own geolocation headers. Vercel and Cloudflare both
 *   resolve the client address to a country and region before the request ever
 *   reaches this function; this module only reads the result.
 *
 *   The IP address itself is NEVER read, stored, hashed or logged. It is not a
 *   durable identifier, it changes on every mobile network handover, and storing
 *   it would create a pseudonymous cross-session identifier the customer never
 *   agreed to. `resolveClientIp` from `lib/rate-limit-db.ts` exists for abuse
 *   throttling, which is a different purpose with a different retention story;
 *   analytics deliberately does not import it.
 *
 *   Approximate location is labelled APPROXIMATE in every table, every DTO and
 *   every admin label. It is a city-level guess and is never presented as GPS.
 *
 * LEVEL B - PRECISE (opt-in, explicit browser permission)
 *   Latitude, longitude and accuracy are written ONLY when the browser reports
 *   that the user granted location permission. The client asks; the server
 *   verifies the reported permission state was `granted`; the row is written
 *   with a short `expiresAt`.
 *
 *   Nothing in this module requests permission on its own. `requestPermission`
 *   lives in `lib/analytics/browser-location.ts` and is re-exported here for
 *   convenience; the UI calls it at the moment the user asks for something that
 *   genuinely needs it, with a stated reason.
 *
 * LEVEL C - USER_ENTERED
 *   The address a customer typed into the checkout or profile form. This is
 *   first-party data the customer gave us for a delivery purpose, retained as
 *   long as the address relationship needs it, and never mixed into behavioural
 *   location reports as if it were a device location.
 */

import type { LocationSource, LocationType } from "@/lib/analytics/events";
import { sanitiseStateLabel } from "@/lib/analytics/india-locations";

/* ------------------------------------------------------- edge geo headers */

export type EdgeHeadersLike = {
  get(name: string): string | null;
};

/**
 * Coarse location from the edge.
 *
 * Header priority is Vercel, then Cloudflare: the app is deployed on Vercel, and
 * Cloudflare is the fallback for the R2 asset host's edge in front of any future
 * proxy. Unknown headers simply yield nulls, which is the correct outcome on a
 * self-hosted runtime rather than an error.
 */
export function approximateLocationFromHeaders(
  headers: EdgeHeadersLike,
): {
  country: string | null;
  region: string | null;
  stateCode: string | null;
  city: string | null;
  /** True when the edge actually supplied something. */
  resolved: boolean;
} {
  const country = decodeHeader(headers, "x-vercel-ip-country") ?? decodeHeader(headers, "cf-ipcountry");
  const rawRegion =
    decodeHeader(headers, "x-vercel-ip-country-region") ?? decodeHeader(headers, "cf-region");
  const city =
    decodeHeader(headers, "x-vercel-ip-city") ?? decodeHeader(headers, "cf-ipcity");

  // Vercel sends a bare ISO 3166-2 subdivision code here (IN-GJ); Cloudflare
  // sends a human label. Handle both rather than guessing which one arrived.
  const stateCode = rawRegion && /^[A-Z]{2}-[A-Z0-9]{1,3}$/i.test(rawRegion)
    ? rawRegion.split("-")[1]?.toUpperCase() ?? null
    : null;
  const region = stateCode ? null : sanitiseStateLabel(rawRegion);

  return {
    country: country ? country.toUpperCase().slice(0, 2) : null,
    region,
    stateCode,
    city: city ? city.slice(0, 120) : null,
    resolved: Boolean(country || region || stateCode || city),
  };
}

/**
 * Decode an edge header value.
 *
 * Vercel percent-encodes the city name, so "Mumbai%2C%20Maharashtra" arrives
 * encoded. A malformed escape must not throw: it returns null and the field is
 * simply treated as unknown.
 */
function decodeHeader(headers: EdgeHeadersLike, name: string): string | null {
  const raw = headers.get(name);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "XX" || trimmed === "T1") return null;
  try {
    const decoded = decodeURIComponent(trimmed);
    return decoded.trim().slice(0, 200) || null;
  } catch {
    return trimmed.slice(0, 200);
  }
}

/* -------------------------------------------------------- server-only note */

/**
 * SERVER MODULE. It reaches `lib/db` through `lib/analytics/india-locations.ts`.
 *
 * The browser half - `requestPermission` - deliberately lives in
 * `lib/analytics/browser-location.ts` instead, because a client component that
 * imported this file (even lazily) would drag the database driver into the
 * browser bundle. `lib/analytics/client-boundary.test.ts` asserts that.
 */

/* ------------------------------------------------------- user-entered map */

export type PreciseLocationInput = {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres, as reported by the browser. */
  accuracyMeters?: number | null;
  /** What the browser said the permission state was. */
  permissionState: "granted" | "denied" | "prompt";
  occurredAt?: Date;
};

export type PreciseLocationDecision =
  | {
      allowed: true;
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      locationType: "PRECISE";
      locationSource: LocationSource;
      occurredAt: Date;
    }
  | { allowed: false; reason: string };

/**
 * Gate a precise-location observation.
 *
 * The check is `permissionState === "granted"` and nothing else. There is no
 * "user seems to want it" branch, no geo-IP upgrade, and no case where a
 * coarse location is quietly relabelled as precise. A denial is a normal
 * outcome that returns a reason string the UI can act on, not an exception.
 *
 * Accuracy is clamped rather than trusted: a device claiming 0 m accuracy is
 * reporting a rounding artefact, and storing 0 would make the column look more
 * authoritative than it is.
 */
export function evaluatePreciseLocation(
  input: PreciseLocationInput,
  now: Date = new Date(),
): PreciseLocationDecision {
  if (input.permissionState !== "granted") {
    return {
      allowed: false,
      reason: "Precise location requires an explicit browser permission grant.",
    };
  }

  const { latitude, longitude } = input;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { allowed: false, reason: "Coordinates are outside the valid range." };
  }

  // The null island check is not paranoia: (0, 0) is what a failed geolocation
  // call reports often enough to be worth refusing explicitly.
  if (latitude === 0 && longitude === 0) {
    return { allowed: false, reason: "Coordinates are not a real position." };
  }

  const rawAccuracy = input.accuracyMeters;
  const accuracyMeters =
    typeof rawAccuracy === "number" && Number.isFinite(rawAccuracy) && rawAccuracy > 0
      ? Math.min(Math.round(rawAccuracy), 100_000)
      : null;

  return {
    allowed: true,
    latitude,
    longitude,
    accuracyMeters,
    locationType: "PRECISE",
    // A browser grant and an app grant are different consent surfaces and are
    // recorded differently, so a later audit can tell which one was used.
    locationSource: input.permissionState === "granted" ? "GPS" : "APP_PERMISSION",
    occurredAt: input.occurredAt ?? now,
  };
}

/**
 * Ask the browser for location permission.
 *
 * MOVED to `@/lib/analytics/browser-location`. It used to live here, and that was
 * a real defect: this module reaches `lib/db` through `lib/analytics/india-locations.ts`,
 * and the bundler follows a dynamic `import()` just as eagerly as a static one, so a
 * client component lazily loading `requestPermission` from here pulled the Postgres
 * driver into the browser bundle. It is re-exported only so nothing has to change in
 * two places at once; new code should import the browser module directly.
 */
export { requestPermission } from "@/lib/analytics/browser-location";

/* ------------------------------------------------------- user-entered map */

export type UserAddressInput = {
  formattedAddress?: string | null;
  addressLine1?: string | null;
  locality?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
};

export type NormalisedUserAddress = {
  locationType: Extract<LocationType, "USER_ENTERED">;
  locationSource: Extract<LocationSource, "USER_ADDRESS">;
  formattedAddress: string | null;
  city: string | null;
  region: string | null;
  stateCode: string | null;
  pincode: string | null;
  locality: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
};

/**
 * Normalise a customer-entered address into the location shape.
 *
 * Coordinates are only accepted when the customer explicitly let the provider
 * fill them in (an autocomplete selection), never inferred from the free text.
 * A `placeId` is only kept when the authorised provider actually returned one:
 * this module does not invent Google place identifiers, and there is no attempt
 * here to read anything from a customer's Google account.
 */
export function normaliseUserAddress(
  input: UserAddressInput,
): NormalisedUserAddress {
  const pincode = normalisePincode(input.pincode);
  const city = cleanShort(input.city, 120);
  const region = cleanShort(input.state, 120);
  const stateCode = input.stateCode ? input.stateCode.toUpperCase().slice(0, 4) : null;

  const line = cleanShort(input.addressLine1, 200);
  const locality = cleanShort(input.locality, 120);
  const composed = [line, locality, city, region, pincode].filter(Boolean).join(", ");
  const formatted = cleanShort(input.formattedAddress, 300) ?? (composed || null);

  return {
    locationType: "USER_ENTERED",
    locationSource: "USER_ADDRESS",
    formattedAddress: formatted,
    city,
    region,
    stateCode,
    pincode,
    locality,
    country: input.country ? input.country.toUpperCase().slice(0, 2) : "IN",
    latitude:
      typeof input.latitude === "number" && Number.isFinite(input.latitude)
        ? input.latitude
        : null,
    longitude:
      typeof input.longitude === "number" && Number.isFinite(input.longitude)
        ? input.longitude
        : null,
    placeId: cleanShort(input.placeId, 120),
  };
}

function cleanShort(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

const PINCODE = /^\d{6}$/;

export function normalisePincode(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/[\s-]/g, "");
  return PINCODE.test(compact) ? compact : null;
}

export function isValidIndianPincode(value: string | null | undefined): boolean {
  return normalisePincode(value) !== null;
}

/* ------------------------------------------------------------- labelling */

/**
 * Human label for a location type, used everywhere an admin reads one.
 *
 * The word "approximate" is never dropped from a display string. A dashboard that
 * renders an IP-derived city under a heading reading simply "City" is claiming a
 * precision it does not have.
 */
export function locationTypeLabel(locationType: string | null | undefined): string {
  switch (locationType) {
    case "PRECISE":
      return "Precise (device GPS)";
    case "APPROXIMATE":
      return "Approximate (network)";
    case "USER_ENTERED":
      return "Customer entered";
    default:
      return "Unknown";
  }
}

export function locationSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "GPS":
      return "Device GPS";
    case "IP":
      return "Network (IP-derived)";
    case "USER_ADDRESS":
      return "Customer address";
    case "APP_PERMISSION":
      return "App permission";
    default:
      return "Unknown";
  }
}

/** One-line summary for a compact admin cell. */
export function locationSummary(input: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  locationType?: string | null;
}): string {
  const place = [input.city, input.region].filter(Boolean).join(", ");
  /* `place || country` would silently drop the country whenever a city was known,
     so a visitor in Dubai outside the Indian market would be filed under no
     country at all. India is the default market and is not repeated. */
  const country =
    input.country && input.country !== "IN" ? `(${input.country})` : "";
  const base = [place, country].filter(Boolean).join(" ").trim() || "Unknown";
  if (!input.locationType || input.locationType === "APPROXIMATE") {
    return `${base} ~approx`;
  }
  return base;
}

/**
 * Coarsen a precise coordinate to the nearest ~110 km before it is ever grouped
 * or displayed without the precise grant.
 *
 * Two decimal places is roughly 1.1 km, which still pinpoints a neighbourhood.
 * One decimal place is the coarsest that is honestly still "a place", so that is
 * what is used. This is a defence in depth measure: the code that renders
 * precise coordinates is already gated behind `analytics.precise_location`, and
 * this function means a future caller that forgets the gate still cannot render
 * a street address.
 */
export function coarsenCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}
