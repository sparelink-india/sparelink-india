import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { part } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const rows = await getDb()
      .select({ brand: part.brand })
      .from(part)
      .where(sql`${part.brand} is not null and ${part.brand} <> ''`)
      .groupBy(part.brand)
      .orderBy(part.brand);
    return NextResponse.json({
      brands: rows.map((row) => row.brand).filter((name): name is string => Boolean(name)),
    });
  } catch {
    return NextResponse.json({ brands: [] });
  }
}
