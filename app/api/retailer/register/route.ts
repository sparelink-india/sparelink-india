import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dealer } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const businessName =
    typeof body.businessName === "string" ? body.businessName.trim() : "";
  if (!businessName) {
    return NextResponse.json(
      { error: "businessName is required" },
      { status: 400 },
    );
  }

  const ownerName =
    typeof body.ownerName === "string" ? body.ownerName.trim() : null;
  const gstin =
    typeof body.gstin === "string"
      ? body.gstin.trim().toUpperCase() || null
      : null;
  const pan =
    typeof body.pan === "string" ? body.pan.trim().toUpperCase() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase() || null
      : session.user.email || null;
  const address =
    typeof body.address === "string" ? body.address.trim() || null : null;
  const billingAddress =
    typeof body.billingAddress === "string"
      ? body.billingAddress.trim() || null
      : null;
  const city = typeof body.city === "string" ? body.city.trim() || null : null;
  const state =
    typeof body.state === "string" ? body.state.trim() || null : null;
  const pincode =
    typeof body.pincode === "string" ? body.pincode.trim() || null : null;

  const db = getDb();

  const existing = await db.query.dealer.findFirst({
    where: eq(dealer.userId, session.user.id),
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a dealer profile" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  await db.insert(dealer).values({
    id,
    userId: session.user.id,
    businessName,
    ownerName,
    gstin,
    pan,
    phone,
    email,
    address,
    billingAddress,
    city,
    state,
    pincode,
    approvalStatus: "pending",
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "retailer.register",
    entityType: "dealer",
    entityId: id,
    metadata: { businessName, approvalStatus: "pending" },
  });

  return NextResponse.json(
    {
      success: true,
      dealerId: id,
      approvalStatus: "pending",
      message:
        "Retailer registration submitted. An admin will review your application.",
    },
    { status: 201 },
  );
}
