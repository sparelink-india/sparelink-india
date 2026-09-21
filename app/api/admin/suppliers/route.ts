import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { supplier } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { isAllowedFirmId } from "@/lib/firms";
import { requireAdminApi } from "@/lib/require-role";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const rows = await db
    .select()
    .from(supplier)
    .orderBy(desc(supplier.createdAt));
  return NextResponse.json({ suppliers: rows });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const firmId =
    typeof body.firmId === "string" && body.firmId.trim()
      ? body.firmId.trim()
      : null;
  if (firmId && !isAllowedFirmId(firmId)) {
    return NextResponse.json({ error: "Invalid firmId" }, { status: 400 });
  }

  const str = (key: string) =>
    typeof body[key] === "string" ? body[key].trim() || null : null;

  // Only persist gstin/pan if explicitly provided — never invent.
  const gstin = str("gstin");
  const pan = str("pan");

  const id = randomUUID();
  const db = getDb();
  await db.insert(supplier).values({
    id,
    name,
    contactName: str("contactName"),
    phone: str("phone"),
    email: str("email"),
    address: str("address"),
    city: str("city"),
    state: str("state"),
    pincode: str("pincode"),
    gstin,
    pan,
    paymentTerms: str("paymentTerms"),
    firmId,
    notes: str("notes"),
    isActive: body.isActive === false ? false : true,
  });

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "supplier.create",
    entityType: "supplier",
    entityId: id,
    metadata: { name },
  });

  return NextResponse.json({ id, name }, { status: 201 });
}
