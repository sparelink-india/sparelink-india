/**
 * PostgreSQL-backed parts retrieval for `GET /api/search/parts`.
 *
 * WHY THIS EXISTS
 *   The storefront search used to fan out to Typesense Cloud. That made
 *   every search depend on a second hosted service, a second credential, a
 *   separately synced index, and a ranking-fallback dance for query shapes
 *   stricter deployments reject. Every field the search needs already lives
 *   in Postgres (`part`, `part_category`, `partVehicleCompatibility`,
 *   `vehicle`), and every commercial read after retrieval (visibility,
 *   listings, pricing, stock) already queries Postgres — so retrieval moves
 *   to Postgres too and the response contract stays byte-compatible.
 *
 * WHAT IS (AND IS NOT) PRESERVED
 *   Preserved: exact part-number matches, prefix/partial matches, brand and
 *   category filters, vehicle scoping, customer-visibility rules, pagination
 *   semantics, facet payloads, result counts, and the `{hits, found,
 *   facet_counts}` shape the route already processes downstream (including
 *   `rankSearchHits` / `filterAutocompleteHits`, which keep running
 *   unchanged on these rows).
 *   NOT preserved: typo tolerance (`num_typos`) and infix ranking. Those
 *   need trigram indexes (`pg_trgm`, unproven on this provider and
 *   untestable without the isolated QA database), so misspelled queries
 *   match less generously than before. This is a documented gap, not a
 *   silent change.
 *
 * SAFETY
 *   Every user-supplied value travels as a bound parameter through the
 *   Drizzle query builder. LIKE metacharacters in user input are escaped, so
 *   `%`/`_` can never widen a match. No raw SQL string ever contains user
 *   input. Nothing here invents products, prices, or stock.
 */

import { and, asc, desc, eq, exists, ilike, inArray, isNull, not, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  dealerListing,
  inventory,
  part,
  partCategory,
} from "@/drizzle/schema";

export type Database = ReturnType<typeof getDb>;

export type PostgresDocument = {
  id?: string;
  part_number?: string;
  name?: string;
  description?: string;
  brand?: string;
  category?: string;
};

export type PostgresHit = {
  document: PostgresDocument;
};

export type PostgresFacetCounts = Array<{
  field_name?: string;
  counts?: Array<{ value?: string; count?: number }>;
}>;

export type PostgresSearchResult = {
  hits: PostgresHit[];
  found: number;
  facet_counts: PostgresFacetCounts;
};

export type PostgresTextFilter = {
  /** Already-normalised search text (intent-processed upstream). */
  text: string;
  /** Exact brand value, or null when unfiltered. */
  brand: string | null;
  /** Resolved category names, or [] when unfiltered. */
  categoryNames: string[];
  /** Vehicle-scoped part ids, or null when unscoped. */
  scopedPartIds: string[] | null;
  /** Admins see pending/unpublished rows; everyone else sees approved + published only. */
  isAdmin: boolean;
  /**
   * Server-side result ordering. Relevance (default) keeps the existing
   * ts_rank order; the name orders sort on part-level fields with a
   * deterministic id tie-break. There is deliberately no price order: the
   * price a customer pays is viewer- and firm-specific (party pricing is
   * resolved downstream per listing), so no single part-level price exists
   * to sort on without misrepresenting the catalogue.
   */
  sort?: SearchSort;
  /**
   * Stock filter over authoritative physical state (an ACTIVE listing with
   * sellable units, i.e. quantity - reservedQuantity > 0, counting every
   * firm). True keeps only in-stock parts, false only out-of-stock parts,
   * undefined leaves stock unfiltered. Firm allow-listing is enforced
   * downstream at cart/order time, never weakened by this merchandising
   * filter: cart and checkout re-validate stock and firm server-side.
   */
  inStock?: boolean;
};

/**
 * Allow-listed server sort keys. Anything else falls back to relevance so
 * an unknown value can never reach SQL text or change ordering semantics.
 */
export const SEARCH_SORTS = ["relevance", "name_asc", "name_desc"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export function parseSearchSort(value: unknown): SearchSort {
  return (SEARCH_SORTS as readonly string[]).includes(
    typeof value === "string" ? value : "",
  )
    ? (value as SearchSort)
    : "relevance";
}

type SearchColumns = {
  partNumber: typeof part.partNumber;
  name: typeof part.name;
  description: typeof part.description;
  brand: typeof part.brand;
};

type MatchFn =
  | ((cols: SearchColumns) => ReturnType<typeof and> | undefined)
  | undefined;

/**
 * Escape LIKE metacharacters so user input can only ever narrow a match.
 * Postgres LIKE treats backslash as the default escape character.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Split search text into non-empty tokens. Pure and unit-tested. */
export function tokenizeSearchText(text: string): string[] {
  return text.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

/**
 * Customer-visibility predicate, mirroring `isCustomerVisibleProduct`
 * exactly: published AND (approvalStatus is APPROVED, defaulting null to
 * APPROVED, case-insensitively). Admins skip it entirely.
 */
export function visibilityConditions(isAdmin: boolean) {
  if (isAdmin) return undefined;
  return and(
    eq(part.isPublished, true),
    or(
      sql`upper(${part.approvalStatus}) = 'APPROVED'`,
      isNull(part.approvalStatus),
    ),
  );
}

type PartRow = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
};

function toDocument(row: PartRow): PostgresDocument {
  return {
    id: row.id,
    part_number: row.partNumber,
    name: row.name,
    description: row.description ?? undefined,
    brand: row.brand ?? undefined,
    category: row.categoryName ?? undefined,
  };
}

/** Shared WHERE assembly: visibility + brand + vehicle scope + text + category + stock. */
function filterConditions(
  db: Database,
  filter: PostgresTextFilter,
  match: MatchFn,
) {
  const conditions = [];
  const visibility = visibilityConditions(filter.isAdmin);
  if (visibility) conditions.push(visibility);
  if (filter.brand) conditions.push(eq(part.brand, filter.brand));
  if (filter.scopedPartIds) conditions.push(inArray(part.id, filter.scopedPartIds));
  const textCondition = match
    ? match({
        partNumber: part.partNumber,
        name: part.name,
        description: part.description,
        brand: part.brand,
      })
    : undefined;
  if (textCondition) conditions.push(textCondition);
  if (filter.categoryNames.length > 0) {
    conditions.push(inArray(partCategory.name, filter.categoryNames));
  }
  if (filter.inStock !== undefined) {
    const stocked = stockExistsCondition(db);
    conditions.push(filter.inStock ? stocked : not(stocked));
  }
  return conditions;
}

/**
 * Correlated sellable-stock predicate: at least one ACTIVE listing for the
 * part whose inventory holds quantity - reservedQuantity > 0. A missing
 * inventory row joins to nothing, i.e. zero sellable units — the same
 * semantics `validateAvailableStock` enforces at cart time.
 */
function stockExistsCondition(db: Database) {
  return exists(
    db
      .select({ one: sql<number>`1` })
      .from(dealerListing)
      .innerJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
      .where(
        and(
          eq(dealerListing.partId, part.id),
          eq(dealerListing.status, "active"),
          sql`${inventory.quantity} - ${inventory.reservedQuantity} > 0`,
        ),
      ),
  );
}

function baseFrom(db: Database) {
  return db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      description: part.description,
      brand: part.brand,
      categoryName: partCategory.name,
    })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .$dynamic();
}

/**
 * Default text matcher: every token must match at least one of part number
 * (prefix), name, description or brand (substring). Tokens AND together;
 * fields OR within a token.
 */
export function defaultTextMatch(text: string): MatchFn {
  const tokens = tokenizeSearchText(text);
  if (tokens.length === 0) return undefined;
  return (cols: SearchColumns) =>
    and(
      ...tokens.map((token) => {
        const escaped = escapeLikePattern(token);
        return or(
          ilike(cols.partNumber, `${escaped}%`),
          ilike(cols.name, `%${escaped}%`),
          ilike(cols.description, `%${escaped}%`),
          ilike(cols.brand, `%${escaped}%`),
        );
      }),
    );
}

async function facetCountsFor(
  db: Database,
  filter: PostgresTextFilter,
  match: MatchFn,
): Promise<PostgresFacetCounts> {
  const conditions = filterConditions(db, filter, match);
  let brandQuery = db
    .select({ value: part.brand, count: sql<number>`count(*)` })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .groupBy(part.brand)
    .$dynamic();
  let categoryQuery = db
    .select({ value: partCategory.name, count: sql<number>`count(*)` })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .groupBy(partCategory.name)
    .$dynamic();
  if (conditions.length > 0) {
    brandQuery = brandQuery.where(and(...conditions));
    categoryQuery = categoryQuery.where(and(...conditions));
  }
  const [brandRows, categoryRows] = await Promise.all([brandQuery, categoryQuery]);
  const toCounts = (rows: Array<{ value: string | null; count: number | string }>) =>
    rows
      .map((row) => ({ value: String(row.value || "").trim(), count: Number(row.count || 0) }))
      .filter((row) => row.value && row.count > 0)
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return [
    { field_name: "brand", counts: toCounts(brandRows) },
    { field_name: "category", counts: toCounts(categoryRows) },
  ];
}

async function countFor(
  db: Database,
  filter: PostgresTextFilter,
  match: MatchFn,
): Promise<number> {
  const conditions = filterConditions(db, filter, match);
  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Server result ordering. Relevance keeps the existing ts_rank order;
 * the name orders sort on part-level fields only (there is no single
 * part-level price — see the `sort` field docs). Every branch ends in
 * `asc(part.id)` so pagination is deterministic even on ties.
 */
function rowsOrder(text: string, sort: SearchSort = "relevance") {
  if (sort === "name_asc") return [asc(part.name), asc(part.id)];
  if (sort === "name_desc") return [desc(part.name), asc(part.id)];
  const trimmed = text.trim();
  if (!trimmed) return [asc(part.id)];
  return [
    sql`ts_rank(to_tsvector('english', coalesce(${part.name}, '') || ' ' || coalesce(${part.description}, '') || ' ' || coalesce(${part.brand}, '')), plainto_tsquery('english', ${trimmed})) DESC`,
    asc(part.id),
  ];
}

/**
 * General text search with server-side pagination: one page of rows in
 * ts_rank order, plus totals and facets over the full filtered set.
 */
export async function searchPartsPage(
  db: Database,
  filter: PostgresTextFilter,
  page: number,
  perPage: number,
): Promise<PostgresSearchResult> {
  const match = defaultTextMatch(filter.text);
  const conditions = filterConditions(db, filter, match);
  let rowsQuery = baseFrom(db);
  if (conditions.length > 0) rowsQuery = rowsQuery.where(and(...conditions));
  rowsQuery = rowsQuery.orderBy(...rowsOrder(filter.text, filter.sort));
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const rows = await rowsQuery.limit(safePerPage).offset((safePage - 1) * safePerPage);

  const [facet_counts, found] = await Promise.all([
    facetCountsFor(db, filter, match),
    countFor(db, filter, match),
  ]);

  return {
    hits: rows.map((row) => ({ document: toDocument(row) })),
    found,
    facet_counts,
  };
}

/**
 * Unpaged superset retrieval for flows the route ranks and slices in memory
 * (vehicle/post-filter/part-number flows): up to `fetchSize` rows in stable
 * id order, plus totals and facets over the full filtered set. Accepts an
 * optional custom matcher (e.g. exact-or-prefix part numbers).
 */
export async function searchPartsFetch(
  db: Database,
  filter: PostgresTextFilter,
  fetchSize: number,
  match?: MatchFn,
): Promise<PostgresSearchResult> {
  const resolvedMatch = match ?? defaultTextMatch(filter.text);
  const conditions = filterConditions(db, filter, resolvedMatch);
  let rowsQuery = baseFrom(db);
  if (conditions.length > 0) rowsQuery = rowsQuery.where(and(...conditions));
  // Unpaged flows are re-ranked in memory downstream, so an explicit name
  // sort is honoured here while the legacy id order stays the default.
  const fetchOrder =
    filter.sort === "name_asc" || filter.sort === "name_desc"
      ? rowsOrder(filter.text, filter.sort)
      : [asc(part.id)];
  const rows = await rowsQuery.orderBy(...fetchOrder).limit(Math.max(1, fetchSize));

  const [facet_counts, found] = await Promise.all([
    facetCountsFor(db, filter, resolvedMatch),
    countFor(db, filter, resolvedMatch),
  ]);

  return {
    hits: rows.map((row) => ({ document: toDocument(row) })),
    found,
    facet_counts,
  };
}

/**
 * Part-number retrieval merging several query variants (exact, digits-only),
 * mirroring the merged semantics the route previously assembled from
 * multiple Typesense calls: exact matches first, then prefix matches,
 * de-duplicated, with `found` covering the merged set. Facets come from the
 * first variant that produced any, exactly as before.
 */
export async function searchPartNumbersPostgres(
  db: Database,
  queries: string[],
  filter: Omit<PostgresTextFilter, "text">,
  fetchSize: number,
): Promise<PostgresSearchResult> {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  const merged: PostgresHit[] = [];
  const seen = new Set<string>();
  let found = 0;
  let facet_counts: PostgresFacetCounts = [];
  for (const q of uniqueQueries) {
    const escaped = escapeLikePattern(q);
    const match: MatchFn = (cols) =>
      or(eq(cols.partNumber, q), ilike(cols.partNumber, `${escaped}%`));
    const result = await searchPartsFetch(db, { ...filter, text: q }, fetchSize, match);
    found += result.found;
    if (facet_counts.length === 0) facet_counts = result.facet_counts;
    for (const hit of result.hits) {
      const key = String(hit.document.id || hit.document.part_number || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
    if (merged.length > 0) break;
  }
  return { hits: merged, found: Math.max(found, merged.length), facet_counts };
}
