import { asc } from "drizzle-orm";

import { promotionalBanner } from "@/drizzle/schema";
import { getDb, isDatabaseConfigured } from "@/lib/db";

/**
 * Promotional banners — the storefront advertisement slider.
 *
 * ARCHITECTURAL BOUNDARY. This module is intentionally standalone. It does not
 * import from `lib/vehicle-fitment`, `lib/garage`, `lib/brand-logo`, or the
 * hero, and the banner table has no foreign key to `vehicle` or `part`. A
 * banner cannot change what a part fits, and a fitment change cannot affect a
 * banner.
 */

/** The storefront-facing shape. Only what the carousel needs. */
export type PublicBanner = {
  id: string;
  title: string;
  imageUrl: string;
  altText: string;
  /** Sanitised, or null when the admin set no destination. */
  href: string | null;
};

/** The admin-facing shape, including the fields the storefront must not see. */
export type AdminBanner = {
  id: string;
  title: string;
  imageKey: string;
  imageUrl: string;
  altText: string | null;
  destinationUrl: string | null;
  isEnabled: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type BannerRow = {
  id: string;
  title: string;
  imageKey: string;
  altText: string | null;
  destinationUrl: string | null;
  isEnabled: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * True when the string contains a C0 control character or DEL.
 *
 * Written as a code-point loop rather than a regex character class on purpose:
 * `[\u0000-\u001f\u007f]` is the obvious way to say this, but a literal
 * NUL byte in a source file is a hazard — it makes the module unreadable to
 * some tooling and survives a copy/paste in a way an escape sequence does not.
 * The intent is the same and the hazard is not.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Sanitise an admin-authored banner destination.
 *
 * This value ends up as the `href` of a customer-facing link, so it is treated
 * as untrusted input even though an admin typed it: one compromised or
 * careless admin account must not be able to inject a script URL, a `data:`
 * payload, or a protocol-relative link that resolves off-origin.
 *
 * Accepted, and nothing else:
 *   - a site-relative path (`/offers`, `/category/filters`)
 *   - an absolute http/https URL
 *
 * Everything else returns null, which the storefront renders as "not a link"
 * rather than as a broken or hostile one.
 *
 * Exported separately from the loader so it is unit-testable without a
 * database, and so the write path and the read path share one definition.
 */
export function normaliseBannerDestination(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  // A control character anywhere disqualifies the value, before any parsing, so
  // a newline can never reach a header or an attribute.
  if (hasControlCharacter(raw)) return null;

  // Protocol-relative (`//evil.example`) would resolve against our own host and
  // bypass a naive "starts with /" check, so it is rejected explicitly.
  if (raw.startsWith("//")) return null;

  if (raw.startsWith("/")) return raw;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

/**
 * The public URL for a stored banner image.
 *
 * Returns null when the image host is not configured. A banner with no
 * resolvable image is not rendered at all — see `loadEnabledBanners` — because
 * a broken <img> in a premium banner slot is worse than one fewer slide.
 */
export function bannerImageUrl(imageKey: string): string | null {
  const base = readPublicBaseUrl();
  if (!base) return null;
  const key = imageKey.replace(/^\/+/, "");
  if (!key) return null;
  return `${base.replace(/\/+$/, "")}/${key}`;
}

/**
 * Public base URL for banner images.
 *
 * `CATALOGUE_IMAGE_ORIGIN` is the variable this project already uses for its
 * Cloudflare-backed asset host (see `lib/catalogue-image-index.ts`), and it is
 * the one set in production. `R2_PUBLIC_BASE_URL` is accepted as an explicit
 * banner override so banners can be served from a different bucket prefix
 * without a code change. Reading both means this module follows the existing
 * convention instead of introducing a competing one.
 */
function readPublicBaseUrl(): string | null {
  for (const name of ["R2_PUBLIC_BASE_URL", "CATALOGUE_IMAGE_ORIGIN"]) {
    const value = process.env[name];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function toPublic(row: BannerRow): PublicBanner | null {
  const imageUrl = bannerImageUrl(row.imageKey);
  // A banner we cannot render an image for is not a banner. Dropping it here,
  // rather than in the component, keeps one rule in one place and means the
  // carousel can trust every slide it is given.
  if (!imageUrl) return null;
  return {
    id: row.id,
    title: row.title,
    imageUrl,
    altText: row.altText?.trim() || row.title,
    href: normaliseBannerDestination(row.destinationUrl),
  };
}

function toAdmin(row: BannerRow): AdminBanner {
  return {
    id: row.id,
    title: row.title,
    imageKey: row.imageKey,
    imageUrl: bannerImageUrl(row.imageKey) ?? "",
    altText: row.altText,
    destinationUrl: row.destinationUrl,
    isEnabled: row.isEnabled,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Enabled banners, in display order — what the storefront carousel renders.
 *
 * Returns an empty array when the database is not configured, so a build or a
 * preview deployment without Postgres renders the empty state instead of
 * throwing. `isEnabled` is filtered in JS here purely so the two call sites
 * can share one query shape; the row never leaves the server.
 */
export async function loadEnabledBanners(): Promise<PublicBanner[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb()
    .select()
    .from(promotionalBanner)
    .orderBy(asc(promotionalBanner.displayOrder), asc(promotionalBanner.createdAt));
  return rows
    .filter((row) => row.isEnabled)
    .map(toPublic)
    .filter((banner): banner is PublicBanner => banner !== null);
}

/** Every banner, enabled or not, in display order — the admin manager. */
export async function loadAllBanners(): Promise<AdminBanner[]> {
  if (!isDatabaseConfigured()) return [];
  const rows = await getDb()
    .select()
    .from(promotionalBanner)
    .orderBy(asc(promotionalBanner.displayOrder), asc(promotionalBanner.createdAt));
  return rows.map(toAdmin);
}

/**
 * Guard used by the create path: a new banner is never enabled implicitly.
 * Exported so the API and the schema default cannot drift apart.
 */
export const BANNER_DEFAULTS = {
  isEnabled: false,
  displayOrder: 0,
} as const;
