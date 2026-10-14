import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { vehicle } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

/**
 * Distinct models for one make, for the homepage vehicle selector.
 *
 * Same contract and safety posture as the sibling `makes` route: public
 * reference data, no session, sanitised 500 on database failure. `make` is
 * required and matched exactly via a bound parameter; anything else is a 400
 * answered before any database access.
 */
export async function GET(request: NextRequest) {
  const make = request.nextUrl.searchParams.get("make")?.trim() ?? "";
  if (!make) {
    return NextResponse.json({ error: "make is required" }, { status: 400 });
  }
  if (make.length > 100) {
    return NextResponse.json({ error: "make is too long" }, { status: 400 });
  }
  try {
    const rows = await getDb()
      .select({ model: vehicle.model })
      .from(vehicle)
      .where(eq(vehicle.make, make))
      .orderBy(asc(vehicle.model));
    const models = [...new Set(rows.map((row) => row.model.trim()).filter(Boolean))];
    return NextResponse.json(models);
  } catch {
    return NextResponse.json(
      { error: "Unable to load vehicle models right now. Please try again." },
      { status: 500 },
    );
  }
}
