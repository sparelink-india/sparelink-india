import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { warehouse } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const rows = await db.select().from(warehouse).orderBy(asc(warehouse.code));
  return NextResponse.json({ warehouses: rows });
}

export async function POST() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const existing = await db.query.warehouse.findFirst({
    where: eq(warehouse.code, "MAIN"),
  });
  if (existing) {
    return NextResponse.json({ warehouse: existing, created: false });
  }

  const id = randomUUID();
  const row = {
    id,
    code: "MAIN",
    name: "Main Warehouse",
    address: null as string | null,
    city: null as string | null,
    state: null as string | null,
    pincode: null as string | null,
    firmId: null as string | null,
    isActive: true,
  };
  await db.insert(warehouse).values(row);
  return NextResponse.json({ warehouse: row, created: true }, { status: 201 });
}
