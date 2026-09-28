import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";

import { partVehicleCompatibility, vehicle } from "@/drizzle/schema";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

/**
 * GET /api/admin/vehicles
 *
 * The vehicle picker for the compatibility browser. Admin-only, read-only, and
 * it returns the REAL link count per vehicle so the picker can say "7 linked
 * products" without a second round trip.
 *
 * The public `app/api/vehicles/route.ts` already returns vehicles, but it is
 * unauthenticated, carries no link counts and is a different concern; reusing it
 * would leak the picker shape to the storefront and still need a second request
 * for the counts.
 *
 * Eleven rows, so this is deliberately unpaginated. A `vehicle` table large
 * enough to need paging would be a different problem, and inventing a cursor
 * here would be complexity with no user.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  /* One grouped query: link counts come from the join, not an N+1 per vehicle. */
  const rows = await getDb()
    .select({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      linkCount: sql<number>`count(${partVehicleCompatibility.partId})::int`,
    })
    .from(vehicle)
    .leftJoin(partVehicleCompatibility, eq(partVehicleCompatibility.vehicleId, vehicle.id))
    .groupBy(vehicle.id, vehicle.make, vehicle.model, vehicle.variant)
    .orderBy(asc(vehicle.make), asc(vehicle.model), asc(vehicle.variant));

  return NextResponse.json({
    vehicles: rows.map((row) => ({
      id: row.id,
      make: row.make,
      model: row.model,
      variant: row.variant,
      linkCount: Number(row.linkCount ?? 0),
    })),
  });
}
