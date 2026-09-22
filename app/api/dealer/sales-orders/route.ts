import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  dealer,
  salesOrder,
  salesOrderItem,
} from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  nextB2bDocNumber,
  stripClientMoneyFields,
  sumDocumentTotals,
} from "@/lib/b2b-lines";
import {
  loadActiveListingById,
  resolveSalesLineFromListing,
  type ResolvedListingLine,
} from "@/lib/b2b-listings";
import { getDb } from "@/lib/db";
import { isAllowedFirmId } from "@/lib/firms";
import { resolvePartyEffectivePrice } from "@/lib/pricing-rules-service";
import { requireDealerApi } from "@/lib/require-role";

export async function GET() {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;

  const profile = await getDb().query.dealer.findFirst({
    where: eq(dealer.userId, auth.session.user.id),
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Dealer profile not found" },
      { status: 404 },
    );
  }

  const rows = await getDb()
    .select()
    .from(salesOrder)
    .where(eq(salesOrder.dealerId, profile.id))
    .orderBy(desc(salesOrder.createdAt))
    .limit(100);
  return NextResponse.json({ salesOrders: rows });
}

export async function POST(request: Request) {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;

  const profile = await getDb().query.dealer.findFirst({
    where: eq(dealer.userId, auth.session.user.id),
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Dealer profile not found" },
      { status: 404 },
    );
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = stripClientMoneyFields(raw as Record<string, unknown>);
  const partyName =
    typeof body.partyName === "string" && body.partyName.trim()
      ? body.partyName.trim()
      : profile.businessName;

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  if (itemsRaw.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  const resolved: ResolvedListingLine[] = [];
  for (const item of itemsRaw) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Invalid item" }, { status: 400 });
    }
    const clean = stripClientMoneyFields(item as Record<string, unknown>);
    const dealerListingId =
      typeof clean.dealerListingId === "string"
        ? clean.dealerListingId.trim()
        : "";
    const quantity = Number(clean.quantity);
    if (!dealerListingId || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Each item needs dealerListingId and positive quantity" },
        { status: 400 },
      );
    }
    const listing = await loadActiveListingById(dealerListingId);
    if (!listing || listing.dealerId !== profile.id) {
      return NextResponse.json(
        { error: `Active listing not found: ${dealerListingId}` },
        { status: 400 },
      );
    }
    const priced = await resolvePartyEffectivePrice({
      listInclusivePaise: listing.pricePaise,
      dealerId: profile.id,
      customerUserId: auth.session.user.id,
      applyVerificationFallback: false,
    });
    resolved.push(
      resolveSalesLineFromListing(listing, quantity, priced.netInclusivePaise),
    );
  }

  const firmId =
    resolved.find((r) => r.firmId && isAllowedFirmId(r.firmId))?.firmId ??
    null;

  const totals = sumDocumentTotals(resolved);
  const id = randomUUID();
  const soNumber = nextB2bDocNumber("SO");
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.insert(salesOrder).values({
      id,
      soNumber,
      status: "draft",
      firmId,
      dealerId: profile.id,
      partyName,
      deliveryAddress:
        typeof body.deliveryAddress === "string"
          ? body.deliveryAddress.trim() || null
          : null,
      notes:
        typeof body.notes === "string" ? body.notes.trim() || null : null,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      createdByUserId: auth.session.user.id,
    });
    for (const line of resolved) {
      await tx.insert(salesOrderItem).values({
        id: randomUUID(),
        salesOrderId: id,
        dealerListingId: line.dealerListingId,
        partId: line.partId,
        partNumber: line.partNumber,
        partName: line.partName,
        sku: line.sku,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        gstRate: line.gstRate,
        lineGstPaise: line.lineGstPaise,
        lineTotalPaise: line.lineTotalPaise,
      });
    }
  });

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "dealer.sales_order.create",
    entityType: "sales_order",
    entityId: id,
    metadata: { soNumber, dealerId: profile.id },
  });

  return NextResponse.json(
    { id, soNumber, status: "draft", ...totals },
    { status: 201 },
  );
}
