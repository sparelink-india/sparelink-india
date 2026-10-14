import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { vehicle } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

/**
 * Distinct variants for one make and model, for the homepage vehicle
 * selector.
 *
 * Same contract and safety posture as the sibling `makes` and `models`
 * routes: public reference data, no session, sanitised 500 on database
 * failure. Both parameters are required, length-bounded and matched exactly
 * via bound parameters; variants stored as null or blank are omitted rather
 * than surfaced as empty options.
 */
export async function GET(request: NextRequest) {
  const make = request.nextUrl.searchParams.get("make")?.trim() ?? "";
  const model = request.nextUrl.searchParams.get("model")?.trim() ?? "";
  if (!make || !model) {
    return NextResponse.json(
      { error: "make and model are required" },
      { status: 400 },
    );
  }
  if (make.length > 100 || model.length > 100) {
    return NextResponse.json({ error: "parameters are too long" }, { status: 400 });
  }
  try {
    const rows = await getDb()
      .select({ variant: vehicle.variant })
      .from(vehicle)
      .where(and(eq(vehicle.make, make), eq(vehicle.model, model)))
      .orderBy(asc(vehicle.variant));
    const variants = [
      ...new Set(rows.map((row) => (row.variant ?? "").trim()).filter(Boolean)),
    ];
    return NextResponse.json(variants);
  } catch {
    return NextResponse.json(
      { error: "Unable to load vehicle variants right now. Please try again." },
      { status: 500 },
    );
  }
}
