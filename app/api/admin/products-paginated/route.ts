import { NextResponse } from "next/server";
import { and, asc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { dealerListing, part, partCategory, partVehicleCompatibility, vehicle } from "@/drizzle/schema";
import { catalogueImagePublicPath } from "@/lib/catalogue-image-index";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";
import {
  buildProductPredicates,
  normaliseProductFilters,
  resolvePagination,
  type ProductPredicate,
} from "@/lib/admin-vehicle-compatibility";

/**
 * GET /api/admin/products-paginated
 *
 * The product grid behind the read-only compatibility browser.
 *
 * WHY NOT /api/admin/products. That endpoint returns every part with no
 * pagination and issues an extra `count(*)` query per part, so against ~9,000
 * parts it is roughly 9,000 queries for one screen. It is fine for a
 * client-filtered read-only list and unusable here.
 *
 * TWO QUERIES FOR THE PAGE, NOT ONE. A filtered `count(*)` runs first so the
 * requested page can be clamped against a real total; without it a hand-typed
 * `?page=9999` would silently return an empty grid that reads like a search
 * failure. The alternative, `count(*) over()` on the page query, cannot clamp
 * the page it is riding on. Both queries are index-backed aggregates over the
 * same `where`, so the pair is still far cheaper than materialising 9,000 rows.
 *
 * COMPATIBILITY IS A LEFT JOIN, NOT A FLAG. The join is pinned to both
 * `part_id` and the selected `vehicle_id`, so `is_linked` is true exactly when a
 * real `part_vehicle_compatibility` row exists. There is no stored boolean to
 * drift out of step with the table.
 *
 * LISTING COUNTS COME IN ONE GROUPED QUERY. The audit found linked products
 * with zero dealer listings, which means "linked" and "buyable" are different
 * facts and conflating them would mislead an admin. Counting the current page
 * in a single `IN (...)` query keeps that visible without an N+1.
 *
 * READ-ONLY. This file exports GET and nothing else. No POST, no PATCH, no
 * DELETE, no database write of any kind.
 */

export const dynamic = "force-dynamic";

/** Escape LIKE metacharacters so a search for "50%" is a literal search. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toPredicate(value: ProductPredicate) {
  switch (value.kind) {
    case "text":
      return or(
        ...value.columns.map((column) =>
          ilike(column === "partNumber" ? part.partNumber : part.name, `%${escapeLike(value.value)}%`),
        ),
      );
    case "brand":
      return eq(part.brand, value.value);
    case "category":
      return eq(part.categoryId, value.value);
    case "compatibility":
      return value.value === "linked"
        ? isNotNull(partVehicleCompatibility.partId)
        : isNull(partVehicleCompatibility.partId);
  }
}

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const params = new URL(request.url).searchParams;
  const db = getDb();

  const filters = normaliseProductFilters({
    q: params.get("q"),
    brand: params.get("brand"),
    categoryId: params.get("categoryId"),
    status: params.get("status"),
  });

  /* An unverified id must not reach the join. Checked against the real table
     rather than pattern-matched, so a guessed id returns 400 rather than an
     empty grid that looks like a real answer. */
  const requestedVehicleId = params.get("vehicleId")?.trim() || null;
  let vehicleId: string | null = null;
  if (requestedVehicleId) {
    const found = await db
      .select({ id: vehicle.id })
      .from(vehicle)
      .where(eq(vehicle.id, requestedVehicleId))
      .limit(1);
    if (!found.length) {
      return NextResponse.json({ error: "Unknown vehicle." }, { status: 400 });
    }
    vehicleId = found[0].id;
  }

  /* The grand total is needed to clamp the page, so it is fetched first. */
  const where = and(
    ...buildProductPredicates(filters, vehicleId).map(toPredicate),
  );

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(part)
    .leftJoin(partCategory, eq(partCategory.id, part.categoryId))
    .leftJoin(
      partVehicleCompatibility,
      vehicleId
        ? and(
            eq(partVehicleCompatibility.partId, part.id),
            eq(partVehicleCompatibility.vehicleId, vehicleId),
          )
        : sql`false`,
    )
    .where(where);

  const pagination = resolvePagination({
    page: params.get("page"),
    perPage: params.get("perPage"),
    total: Number(total ?? 0),
  });

  /* The unfiltered catalogue size, so the UI can show "N of 9,017" without
     the admin having to guess what the denominator is. */
  const [{ catalogueTotal }] = await db.select({ catalogueTotal: sql<number>`count(*)::int` }).from(part);

  const [rows, brands, categories] = await Promise.all([
    db
      .select({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        brand: part.brand,
        categoryId: part.categoryId,
        categoryName: partCategory.name,
        isLinked: sql<boolean>`${partVehicleCompatibility.partId} is not null`,
      })
      .from(part)
      .leftJoin(partCategory, eq(partCategory.id, part.categoryId))
      .leftJoin(
        partVehicleCompatibility,
        vehicleId
          ? and(
              eq(partVehicleCompatibility.partId, part.id),
              eq(partVehicleCompatibility.vehicleId, vehicleId),
            )
          : sql`false`,
      )
      .where(where)
      .orderBy(asc(part.partNumber))
      .limit(pagination.perPage)
      .offset(pagination.offset),

    /* Facets are unfiltered so the dropdowns never shrink to the current
       result, which is the behaviour an admin expects from a filter. */
    db
      .selectDistinct({ brand: part.brand })
      .from(part)
      .where(and(ne(part.brand, ""), sql`${part.brand} is not null`))
      .then((list) =>
        list
          .map((row) => row.brand)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => a.localeCompare(b)),
      ),

    db
      .select({ id: partCategory.id, name: partCategory.name })
      .from(partCategory)
      .orderBy(asc(partCategory.name)),
  ]);

  /* Listing counts for the current page only, in one grouped query. */
  const pageIds = rows.map((row) => row.id);
  const listingCounts = new Map<string, number>();
  if (pageIds.length) {
    const listed = await db
      .select({ partId: dealerListing.partId, count: sql<number>`count(*)::int` })
      .from(dealerListing)
      .where(inArray(dealerListing.partId, pageIds))
      .groupBy(dealerListing.partId);
    for (const row of listed) listingCounts.set(row.partId, Number(row.count ?? 0));
  }

  return NextResponse.json({
    products: rows.map((row) => ({
      id: row.id,
      partNumber: row.partNumber,
      name: row.name,
      brand: row.brand,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      isLinked: Boolean(row.isLinked),
      imageUrl: catalogueImagePublicPath(row.partNumber),
      listingCount: listingCounts.get(row.id) ?? 0,
    })),
    pagination,
    facets: { brands, categories },
    vehicleId,
    catalogueTotal: Number(catalogueTotal ?? 0),
  });
}
