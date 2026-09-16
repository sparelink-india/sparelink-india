import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { dealer, dealerListing, inventory, part } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const inventoryData = await db
      .select({
        id: inventory.id,
        dealerListingId: inventory.dealerListingId,
        partName: part.name,
        dealerName: dealer.businessName,
        quantity: inventory.quantity,
        price: dealerListing.pricePaise,
        lastUpdated: inventory.updatedAt,
      })
      .from(inventory)
      .innerJoin(dealerListing, eq(inventory.dealerListingId, dealerListing.id))
      .innerJoin(part, eq(dealerListing.partId, part.id))
      .innerJoin(dealer, eq(dealerListing.dealerId, dealer.id))
      .orderBy(desc(inventory.updatedAt));

    return NextResponse.json({ inventory: inventoryData });
  } catch (error) {
    console.error("Inventory fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load inventory" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const inventoryId =
    typeof body.inventoryId === "string" ? body.inventoryId.trim() : "";
  const dealerListingId =
    typeof body.dealerListingId === "string"
      ? body.dealerListingId.trim()
      : "";
  const quantity = Number(body.quantity);
  const reason =
    typeof body.reason === "string" ? body.reason.trim() || null : null;

  if (!inventoryId && !dealerListingId) {
    return NextResponse.json(
      { error: "inventoryId or dealerListingId is required" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return NextResponse.json(
      { error: "quantity must be a non-negative integer" },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = inventoryId
    ? await db.query.inventory.findFirst({
        where: eq(inventory.id, inventoryId),
      })
    : await db.query.inventory.findFirst({
        where: eq(inventory.dealerListingId, dealerListingId),
      });

  if (!existing) {
    return NextResponse.json(
      { error: "Inventory record not found" },
      { status: 404 },
    );
  }

  await db
    .update(inventory)
    .set({ quantity, updatedAt: new Date() })
    .where(eq(inventory.id, existing.id));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "inventory.quantity_update",
    entityType: "inventory",
    entityId: existing.id,
    metadata: {
      previousQuantity: existing.quantity,
      quantity,
      reason,
      dealerListingId: existing.dealerListingId,
    },
  });

  return NextResponse.json({ success: true, quantity });
}
