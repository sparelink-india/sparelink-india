import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { count, desc, eq } from "drizzle-orm";
import { dealer, dealerListing, user } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getDb();

  try {
    const dealers = await db
      .select({
        id: dealer.id,
        businessName: dealer.businessName,
        ownerName: dealer.ownerName,
        gstin: dealer.gstin,
        pan: dealer.pan,
        phone: dealer.phone,
        city: dealer.city,
        state: dealer.state,
        email: dealer.email,
        approvalStatus: dealer.approvalStatus,
        creditLimitPaise: dealer.creditLimitPaise,
        priceGroup: dealer.priceGroup,
        rejectionReason: dealer.rejectionReason,
        createdAt: dealer.createdAt,
      })
      .from(dealer)
      .orderBy(desc(dealer.createdAt));

    const dealerIds = dealers.map((d) => d.id);

    const listingCounts = await Promise.all(
      dealerIds.map(async (dealerId) => {
        const result = await db
          .select({ count: count() })
          .from(dealerListing)
          .where(eq(dealerListing.dealerId, dealerId));
        return { dealerId, count: result[0]?.count ?? 0 };
      }),
    );

    const countMap = new Map(
      listingCounts.map((item) => [item.dealerId, item.count]),
    );

    const dealersWithCounts = dealers.map((d) => ({
      ...d,
      listingCount: countMap.get(d.id) ?? 0,
    }));

    return NextResponse.json({ dealers: dealersWithCounts });
  } catch (error) {
    console.error("Dealers fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load dealers" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const dealerId =
    typeof body.dealerId === "string" ? body.dealerId.trim() : "";
  const action = body.action === "approve" || body.action === "reject"
    ? body.action
    : null;
  const rejectionReason =
    typeof body.rejectionReason === "string"
      ? body.rejectionReason.trim() || null
      : null;

  const db = getDb();

  if (!dealerId || !action) {
    // Allow credit/price-group configuration without approve/reject.
    if (dealerId && body.action === "configure") {
      const updates: {
        creditLimitPaise?: number;
        priceGroup?: string;
        paymentTerms?: string | null;
        updatedAt: Date;
      } = { updatedAt: new Date() };

      if (body.creditLimitPaise !== undefined) {
        const creditLimitPaise = Number(body.creditLimitPaise);
        if (!Number.isInteger(creditLimitPaise) || creditLimitPaise < 0) {
          return NextResponse.json(
            { error: "creditLimitPaise must be a non-negative integer" },
            { status: 400 },
          );
        }
        updates.creditLimitPaise = creditLimitPaise;
      }
      if (typeof body.priceGroup === "string" && body.priceGroup.trim()) {
        updates.priceGroup = body.priceGroup.trim();
      }
      if (body.paymentTerms !== undefined) {
        updates.paymentTerms =
          typeof body.paymentTerms === "string"
            ? body.paymentTerms.trim() || null
            : null;
      }

      const existing = await db.query.dealer.findFirst({
        where: eq(dealer.id, dealerId),
      });
      if (!existing) {
        return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
      }

      await db.update(dealer).set(updates).where(eq(dealer.id, dealerId));
      await writeAuditLog({
        actorUserId: session.user.id,
        action: "dealer.configure",
        entityType: "dealer",
        entityId: dealerId,
        metadata: {
          previous: {
            creditLimitPaise: existing.creditLimitPaise,
            priceGroup: existing.priceGroup,
            paymentTerms: existing.paymentTerms,
          },
          updates,
        },
      });
      return NextResponse.json({ success: true, ...updates });
    }

    return NextResponse.json(
      { error: "dealerId and action (approve|reject|configure) are required" },
      { status: 400 },
    );
  }

  const existing = await db.query.dealer.findFirst({
    where: eq(dealer.id, dealerId),
  });

  if (!existing) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  if (action === "approve") {
    await db
      .update(dealer)
      .set({
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedBy: session.user.id,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(dealer.id, dealerId));

    await db
      .update(user)
      .set({ role: "dealer", updatedAt: new Date() })
      .where(eq(user.id, existing.userId));

    await writeAuditLog({
      actorUserId: session.user.id,
      action: "dealer.approve",
      entityType: "dealer",
      entityId: dealerId,
      metadata: { userId: existing.userId },
    });

    return NextResponse.json({
      success: true,
      approvalStatus: "approved",
    });
  }

  await db
    .update(dealer)
    .set({
      approvalStatus: "rejected",
      rejectionReason,
      approvedAt: null,
      approvedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(dealer.id, dealerId));

  await writeAuditLog({
    actorUserId: session.user.id,
    action: "dealer.reject",
    entityType: "dealer",
    entityId: dealerId,
    metadata: { rejectionReason },
  });

  return NextResponse.json({
    success: true,
    approvalStatus: "rejected",
  });
}
