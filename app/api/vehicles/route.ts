import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { vehicle } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

export async function GET() {
  const vehicles = await getDb()
    .select({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
    })
    .from(vehicle)
    .orderBy(asc(vehicle.make), asc(vehicle.model), asc(vehicle.variant));

  return NextResponse.json({ vehicles });
}
