import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { customerVehicle } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { denyIfMustChangePassword } from "@/lib/require-role";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "buyer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const db = getDb();
  const vehicles = await db
    .select()
    .from(customerVehicle)
    .where(eq(customerVehicle.userId, session.user.id))
    .orderBy(desc(customerVehicle.createdAt));

  return NextResponse.json({ vehicles });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "buyer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const make = typeof body.make === "string" ? body.make.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!make || !model) {
    return NextResponse.json(
      { error: "make and model are required" },
      { status: 400 },
    );
  }

  const vehicleType =
    typeof body.vehicleType === "string" && body.vehicleType.trim()
      ? body.vehicleType.trim()
      : "car";
  const year =
    body.year !== undefined && body.year !== null && body.year !== ""
      ? Number(body.year)
      : null;
  const variant =
    typeof body.variant === "string" ? body.variant.trim() || null : null;
  const registrationNumber =
    typeof body.registrationNumber === "string"
      ? body.registrationNumber.trim().toUpperCase() || null
      : null;
  const vin =
    typeof body.vin === "string" ? body.vin.trim().toUpperCase() || null : null;
  const isPrimary = Boolean(body.isPrimary);

  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();

  if (isPrimary) {
    await db
      .update(customerVehicle)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(customerVehicle.userId, session.user.id));
  }

  await db.insert(customerVehicle).values({
    id,
    userId: session.user.id,
    vehicleType,
    make,
    model,
    year,
    variant,
    registrationNumber,
    vin,
    isPrimary,
  });

  return NextResponse.json({ success: true, id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "buyer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const id =
    typeof body?.id === "string"
      ? body.id.trim()
      : typeof body?.vehicleId === "string"
        ? body.vehicleId.trim()
        : "";

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.query.customerVehicle.findFirst({
    where: and(
      eq(customerVehicle.id, id),
      eq(customerVehicle.userId, session.user.id),
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  await db.delete(customerVehicle).where(eq(customerVehicle.id, id));

  return NextResponse.json({ success: true });
}
