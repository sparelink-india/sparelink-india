import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { vehicle } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

/**
 * Distinct vehicle makes for the homepage vehicle selector.
 *
 * Public catalogue reference data: makes, models and variants are browsable
 * without signing in (the vehicle-fitment pages are public), so this route
 * takes no parameters and requires no session. On a database failure it
 * answers the same sanitised 500 as the search API — never SQL, credentials
 * or a stack trace. The selector treats any failure as "no makes" and stays
 * usable for text search.
 */
export async function GET() {
  try {
    const rows = await getDb()
      .select({ make: vehicle.make })
      .from(vehicle)
      .orderBy(asc(vehicle.make));
    const makes = [...new Set(rows.map((row) => row.make.trim()).filter(Boolean))];
    return NextResponse.json(makes);
  } catch {
    return NextResponse.json(
      { error: "Unable to load vehicle makes right now. Please try again." },
      { status: 500 },
    );
  }
}
