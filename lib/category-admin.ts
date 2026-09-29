/**
 * Category administration - pure rules.
 *
 * THERE IS EXACTLY ONE CATEGORY TAXONOMY AND IT IS NOT THIS MODULE'S TO
 * CHANGE.
 *
 * Categories in this codebase arrive from two places, and neither is a free
 * list:
 *
 *   `part_category`  a real table. `part.category_id` references it, so a
 *                    rename here is a rename the catalogue can see.
 *   config           `lib/category-navigation.ts` owns the navigation tree, the
 *                    WATER_PUMP_SEGMENTS group, the cable and filter type
 *                    definitions, and the slug rules.
 *
 * So this module is deliberately NOT a category builder. It is a safety layer
 * around edits to the table, and it treats the config as read-only.
 *
 * THE THREE THINGS THAT ACTUALLY BREAK, AND WHAT PREVENTS THEM HERE:
 *
 *   a deleted category  takes its products' `category_id` with it, because the
 *                       FK is ON DELETE SET NULL. 9,017 parts would silently
 *                       lose their category and vanish from category routes and
 *                       search facets. Deletion is refused whenever any product
 *                       depends on it.
 *
 *   a changed slug      moves the public URL. `/category/<slug>` is indexed and
 *                       linked. `slugifyCategory` is the canonical derivation
 *                       and it is re-used rather than reimplemented, so a slug
 *                       that disagrees with the config's own rule is refused
 *                       instead of creating a second URL for one category.
 *
 *   a mass rename       `part_category.name` is the value that reaches the
 *                       Typesense `category` field. Rewriting it touches every
 *                       product in that category at once. There is no bulk
 *                       path here for the same reason there is none in Product
 *                       Information: there is no code path that could.
 */

import { slugifyCategory } from "@/lib/category-navigation";

/**
 * THE SLUG RULE IS THE REAL ONE, IMPORTED NOT COPIED.
 *
 * `slugifyCategory` in `lib/category-navigation.ts` is not a tidy little
 * function: it expands `&` to "and", replaces every non-alphanumeric run with a
 * space, collapses whitespace to hyphens, truncates at 80 characters, and falls
 * back to "category" when nothing survives. Reimplementing a five-step rule with
 * that many edge cases is how a category ends up with two URLs, so this imports
 * it, uses it, and re-exports it under a name that says what it is for here.
 *
 * `lib/category-navigation.ts` is already imported by client-rendered category
 * pages, so no server-only dependency is introduced here.
 */
export const slugifyCategoryName = slugifyCategory;

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** How many parts point at this category. The reason deletion is guarded. */
  productCount: number;
};

/* ---------------------------------------------------------------- bounds */

const LIMITS = { name: 120, slug: 160, description: 500 } as const;

/* ----------------------------------------------------------------- read */

export type CategoryImpact = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  /** What happens to a visitor on the existing URL. */
  urlImpact: "unchanged" | "moves" | "broken";
  /** Whether products lose their category. */
  productImpact: "none" | "detached";
};

export function describeCategoryImpact(
  before: CategoryRow,
  after: { name: string; slug: string },
): CategoryImpact {
  const slugMoves = before.slug !== after.slug;
  return {
    id: before.id,
    name: after.name,
    slug: after.slug,
    productCount: before.productCount,
    urlImpact: slugMoves ? "moves" : "unchanged",
    productImpact: "none",
  };
}

/* -------------------------------------------------------------- validate */

export type CategoryFieldError = { field: string; error: string };
export type CategoryValidation =
  | { ok: true; value: { name: string; slug: string; description: string | null } }
  | { ok: false; errors: CategoryFieldError[] };

/**
 * Validate a category edit.
 *
 * THE SLUG RULE IS NOT OPTIONAL. A slug that is not `slugifyCategoryName(name)`
 * is refused, because the config derives URLs from that relationship and a slug
 * that breaks it produces a category whose page and whose nav entry disagree.
 *
 * An admin who genuinely needs a different URL should change the name, not
 * hand-edit the slug into a second address for the same category.
 */
export function validateCategoryEdit(input: {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
}): CategoryValidation {
  const errors: CategoryFieldError[] = [];

  if (typeof input.name !== "string" || !input.name.trim()) {
    errors.push({ field: "name", error: "A category name is required." });
  } else if (input.name.trim().length > LIMITS.name) {
    errors.push({ field: "name", error: `Must be ${LIMITS.name} characters or fewer.` });
  }

  let slug = "";
  if (input.slug === undefined || input.slug === null || input.slug === "") {
    if (typeof input.name === "string" && input.name.trim()) {
      slug = slugifyCategoryName(input.name);
    }
  } else if (typeof input.slug !== "string") {
    errors.push({ field: "slug", error: "Must be text." });
  } else {
    const trimmed = input.slug.trim();
    if (trimmed.length > LIMITS.slug) {
      errors.push({ field: "slug", error: `Must be ${LIMITS.slug} characters or fewer.` });
    } else if (!/^[a-z0-9-]+$/.test(trimmed) || trimmed.startsWith("-") || trimmed.endsWith("-")) {
      errors.push({
        field: "slug",
        error: "Lowercase letters, numbers and single hyphens only.",
      });
    } else {
      slug = trimmed;
    }
  }

  if (slug && typeof input.name === "string" && input.name.trim()) {
    const canonical = slugifyCategoryName(input.name);
    if (slug !== canonical) {
      errors.push({
        field: "slug",
        error: `The slug must match the category name ("${canonical}"). A different slug gives the category a second URL.`,
      });
    }
  }

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      errors.push({ field: "description", error: "Must be text." });
    } else if (input.description.trim().length > LIMITS.description) {
      errors.push({
        field: "description",
        error: `Must be ${LIMITS.description} characters or fewer.`,
      });
    } else {
      description = input.description.trim() || null;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { name: String(input.name).trim(), slug, description } };
}

/* --------------------------------------------------------------- delete */

export type CategoryDeleteDecision =
  | { allowed: true; warning: string | null }
  | { allowed: false; error: string };

/**
 * Decide whether a category may be deleted.
 *
 * REFUSED WHENEVER ANY PRODUCT DEPENDS ON IT, with the count in the message.
 * The FK is ON DELETE SET NULL, so a permitted delete would not error: it would
 * succeed and quietly strip the category from every product in it. That is the
 * failure mode this guards, and it is why the answer is a hard refusal rather
 * than a warning.
 *
 * A category with no products is still reported as a URL removal, because
 * `/category/<slug>` is indexed whether or not anything links to it from the
 * catalogue.
 */
export function decideCategoryDelete(
  category: CategoryRow,
): CategoryDeleteDecision {
  if (category.productCount > 0) {
    return {
      allowed: false,
      error: `${category.name} is used by ${category.productCount} product(s). Move them to another category first; deleting it would detach all of them.`,
    };
  }
  return {
    allowed: true,
    warning: `/category/${category.slug} will stop resolving. The name is unique, so nothing else will take its place.`,
  };
}

/* ----------------------------------------------------------- collisions */

export type CategoryCollisionDecision =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Reject a slug or name that another category already holds.
 *
 * Both columns are UNIQUE in the schema, so this is not decoration: without the
 * check the insert fails at the database with a raw constraint error instead of
 * a message an admin can act on.
 */
export function checkCategoryCollisions(
  candidate: { name: string; slug: string },
  others: readonly { id: string; name: string; slug: string }[],
  selfId: string,
): CategoryCollisionDecision {
  const nameKey = candidate.name.trim().toLowerCase();
  const slugKey = candidate.slug.trim().toLowerCase();
  for (const other of others) {
    if (other.id === selfId) continue;
    if (other.slug.trim().toLowerCase() === slugKey) {
      return {
        ok: false,
        error: `Another category already uses the slug "${candidate.slug}".`,
      };
    }
    if (other.name.trim().toLowerCase() === nameKey) {
      return {
        ok: false,
        error: `Another category is already named "${candidate.name}".`,
      };
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------ nav check */

/**
 * The category ids the config owns, which this module must not duplicate or
 * rename. `WATER_PUMP_SEGMENTS` lives here, and so does the group id.
 */
export const CONFIG_OWNED_CATEGORY_IDS = [
  "water-pump-assy",
  "heavy-commercial-vehicle",
  "passenger-vehicle",
  "agriculture",
  "earthmover",
] as const;

export function isConfigOwnedCategoryId(value: string): boolean {
  return (CONFIG_OWNED_CATEGORY_IDS as readonly string[]).includes(value);
}
