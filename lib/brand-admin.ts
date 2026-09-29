/**
 * Brand administration - pure rules.
 *
 * THE AUDIT'S ANSWER: BRAND MEMBERSHIP IS NOT ADMINISTRABLE, AND THAT IS
 * CORRECT.
 *
 * `PUBLIC_BRANDS` in `lib/public-brands.ts` is a config registry of nine
 * approved customer-facing brands. It is the authority for WHICH brands appear
 * on /brands and in the homepage grid. There is no brand table in the schema,
 * and `part.brand` is free text that Typesense facets on.
 *
 * Those are three different things and conflating them is the trap:
 *
 *   PUBLIC_BRANDS      the approved presentation list. Nine entries. Code.
 *   brand_profile      where admin-editable presentation overrides live.
 *   part.brand         the catalogue value on 9,017 rows, free text.
 *
 * `part.brand` is NEVER TOUCHED BY THIS MODULE. A brand's display name changing
 * from "Super Seal" to "Superseal" is a presentation decision; rewriting 9,017
 * rows to match would break search facets, break any listing whose brand string
 * differs by a space, and could not be undone from an audit record. So the
 * overlay below can change what a brand LOOKS like and never what it IS.
 *
 * PERSISTENCE IS NECESSARY HERE, and it is worth being explicit about why,
 * because the brief says not to invent it. Vercel's filesystem is read-only at
 * runtime, so a config registry cannot be edited by an admin at all; the only
 * writable store is the database. An admin editor that cannot persist is not an
 * editor. Hence one additive overlay table, keyed by the existing registry id,
 * holding optional overrides and nothing else.
 */

import { PUBLIC_BRANDS, type PublicBrand } from "@/lib/public-brands";

/** The registry is the authority for membership, so it is the id space. */
export const PUBLIC_BRAND_IDS = PUBLIC_BRANDS.map((b) => b.id);

/**
 * What an admin may override. Every field is OPTIONAL: a null means "use the
 * registry value", so a brand with no overlay row renders exactly as it does
 * today. That is what makes this safe to ship with zero rows.
 */
export type BrandProfileOverrides = {
  displayName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  relationship?: string | null;
  searchQuery?: string | null;
  displayOrder?: number | null;
  isVisible?: boolean | null;
};

export type BrandProfileRow = BrandProfileOverrides & {
  id: string;
};

export type ResolvedBrand = Omit<PublicBrand, "description"> & {
  /**
   * Widened to include null because clearing an approved description is a real
   * operation: the registry type says description is there so approved copy can
   * be added later, and approved copy has to be withdrawable again.
   */
  description?: string | null;
  /** Which fields this brand's overlay actually changes. */
  overridden: string[];
  hasProfile: boolean;
  /** Only false when an overlay explicitly hides it; undefined means visible. */
  isVisible?: boolean;
};

/**
 * Merge one overlay row onto its registry entry.
 *
 * THE REGISTRY WINS FOR MEMBERSHIP, ALWAYS. An overlay row whose id is not in
 * the registry is discarded rather than rendered, because a row that adds a
 * brand is a second taxonomy appearing from behind the admin screen.
 */
export function resolveBrand(
  registry: PublicBrand,
  overlay: BrandProfileRow | undefined,
): ResolvedBrand {
  if (!overlay) {
    return { ...registry, overridden: [], hasProfile: false };
  }
  const overridden: string[] = [];
  const merged: ResolvedBrand = { ...registry, overridden, hasProfile: true };

  if (typeof overlay.displayName === "string" && overlay.displayName.trim()) {
    merged.name = overlay.displayName.trim();
    overridden.push("name");
  }
  /* The text fields distinguish ABSENT from EXPLICITLY NULL, because they mean
     different things: absent means "keep the registry value", and an explicit
     null means "clear this field". Collapsing the two would make it impossible
     to ever remove an approved description, which the type itself says exists
     so approved copy can be added later and withdrawn again. */
  for (const field of ["description", "logoUrl", "searchQuery"] as const) {
    if (!(field in overlay)) continue;
    const raw = overlay[field];
    if (raw === null) {
      /* Clearing a logo or a search query leaves an empty destination rather
         than the registry value, so an emptied logo renders as a broken image
         and an emptied query renders as a link to nothing. Both are visible
         mistakes; falling back to the registry value would hide them. */
      if (field === "description") merged.description = null;
      if (field === "logoUrl") merged.logo = "";
      if (field === "searchQuery") merged.searchQuery = "";
      overridden.push(field === "logoUrl" ? "logo" : field);
      continue;
    }
    if (typeof raw === "string" && raw.trim()) {
      if (field === "description") merged.description = raw.trim();
      if (field === "logoUrl") merged.logo = raw.trim();
      if (field === "searchQuery") merged.searchQuery = raw.trim();
      overridden.push(field === "logoUrl" ? "logo" : field);
    }
  }
  if (
    overlay.relationship === "distributor" ||
    overlay.relationship === "trader"
  ) {
    merged.relationship = overlay.relationship;
    overridden.push("relationship");
  }
  if (typeof overlay.searchQuery === "string" && overlay.searchQuery.trim()) {
    merged.searchQuery = overlay.searchQuery.trim();
    overridden.push("searchQuery");
  }
  if (typeof overlay.displayOrder === "number" && Number.isFinite(overlay.displayOrder)) {
    overridden.push("displayOrder");
  }
  if (typeof overlay.isVisible === "boolean") {
    merged.isVisible = overlay.isVisible;
    overridden.push("isVisible");
  }
  return merged;
}

/** Resolve the whole registry against every overlay at once. */
export function resolveAllBrands(overlays: readonly BrandProfileRow[]): {
  brands: ResolvedBrand[];
  visible: ResolvedBrand[];
  ignoredOverlayIds: string[];
} {
  const byId = new Map(overlays.map((o) => [o.id, o]));
  const brands = PUBLIC_BRANDS.map((b) => resolveBrand(b, byId.get(b.id)));
  /* Reported rather than silently dropped, so an admin can see that a row they
     thought was doing something is not in the registry at all. */
  const ignoredOverlayIds = [...byId.keys()].filter((id) => !PUBLIC_BRAND_IDS.includes(id));
  const visible = brands
    .filter((b) => b.isVisible !== false)
    .sort((a, b) => {
      const ao = byId.get(a.id)?.displayOrder;
      const bo = byId.get(b.id)?.displayOrder;
      if (typeof ao === "number" && typeof bo === "number" && ao !== bo) return ao - bo;
      if (typeof ao === "number" && typeof bo !== "number") return -1;
      if (typeof bo === "number" && typeof ao !== "number") return 1;
      return 0;
    });
  return { brands, visible, ignoredOverlayIds };
}

/* ------------------------------------------------------------ validation */

const LIMITS = {
  displayName: 80,
  description: 400,
  logoUrl: 500,
  searchQuery: 120,
} as const;

/**
 * Only these keys are accepted.
 *
 * `id` is the target, not an editable field, and `part.brand` is not in the list
 * because it is not editable from here at all. An unknown key is an error, not
 * something ignored, so a form that posts a brand rename as `partBrand` fails
 * loudly instead of appearing to succeed.
 */
export const BRAND_OVERRIDE_FIELDS = [
  "displayName",
  "description",
  "logoUrl",
  "relationship",
  "searchQuery",
  "displayOrder",
  "isVisible",
] as const;

export type BrandFieldError = { field: string; error: string };
export type BrandValidation =
  | { ok: true; value: BrandProfileOverrides }
  | { ok: false; errors: BrandFieldError[] };

export function validateBrandOverrides(input: Record<string, unknown>): BrandValidation {
  const errors: BrandFieldError[] = [];
  const value: BrandProfileOverrides = {};

  for (const key of Object.keys(input)) {
    if (!(BRAND_OVERRIDE_FIELDS as readonly string[]).includes(key)) {
      errors.push({
        field: key,
        error:
          key === "partBrand"
            ? "The catalogue's part.brand value is not editable here. Brand presentation and catalogue data are separate on purpose."
            : "Unknown field.",
      });
    }
  }

  for (const field of BRAND_OVERRIDE_FIELDS) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (raw === undefined) continue;

    if (field === "isVisible") {
      if (typeof raw !== "boolean") {
        errors.push({ field, error: "Must be true or false." });
      } else {
        value.isVisible = raw;
      }
      continue;
    }

    if (field === "displayOrder") {
      if (raw === null || raw === "") {
        value.displayOrder = null;
        continue;
      }
      const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
      if (!Number.isInteger(n) || n < 0 || n > 999) {
        errors.push({ field, error: "Must be a whole number between 0 and 999." });
      } else {
        value.displayOrder = n;
      }
      continue;
    }

    if (field === "relationship") {
      if (raw === null || raw === "") continue;
      if (raw !== "distributor" && raw !== "trader") {
        errors.push({ field, error: 'Must be "distributor" or "trader".' });
      } else {
        value.relationship = raw;
      }
      continue;
    }

    const limit = LIMITS[field as keyof typeof LIMITS];
    if (raw === null) {
      // An explicit null clears the override, restoring the registry value.
      value[field] = null;
      continue;
    }
    if (typeof raw !== "string") {
      errors.push({ field, error: "Must be text." });
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed.length > limit) {
      errors.push({ field, error: `Must be ${limit} characters or fewer.` });
      continue;
    }
    value[field] = trimmed;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/* --------------------------------------------------------------- reset */

/**
 * Removing an overlay row restores the registry value exactly, which is the
 * reason the merge treats absent as "use the registry" rather than storing a
 * copy of it. There is therefore no need for a soft-delete column.
 */
export function describeReset(brand: PublicBrand): string {
  return `"${brand.name}" returns to its registry values: ${brand.relationship}, ${brand.searchQuery}.`;
}
