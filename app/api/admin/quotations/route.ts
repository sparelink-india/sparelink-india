import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { quotation, quotationItem } from "@/drizzle/schema";
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
import { requireAdminApi } from "@/lib/require-role";

const QT_STATUSES = new Set(["draft", "submitted"]);

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const rows = await db
    .select()
    .from(quotation)
    .orderBy(desc(quotation.createdAt))
    .limit(200);
  return NextResponse.json({ quotations: rows });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = stripClientMoneyFields(raw as Record<string, unknown>);
  const partyName =
    typeof body.partyName === "string" ? body.partyName.trim() : "";
  if (!partyName) {
    return NextResponse.json({ error: "partyName is required" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" && QT_STATUSES.has(body.status)
      ? body.status
      : "draft";
  const dealerId =
    typeof body.dealerId === "string" && body.dealerId.trim()
      ? body.dealerId.trim()
      : null;
  let firmId =
    typeof body.firmId === "string" && body.firmId.trim()
      ? body.firmId.trim()
      : null;
  if (firmId && !isAllowedFirmId(firmId)) {
    return NextResponse.json({ error: "Invalid firmId" }, { status: 400 });
  }

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
    if (!listing) {
      return NextResponse.json(
        { error: `Active listing not found: ${dealerListingId}` },
        { status: 400 },
      );
    }
    resolved.push(resolveSalesLineFromListing(listing, quantity));
  }

  if (!firmId) {
    const fromLine = resolved.find((r) => r.firmId && isAllowedFirmId(r.firmId));
    firmId = fromLine?.firmId ?? null;
  }

  const totals = sumDocumentTotals(resolved);
  const id = randomUUID();
  const quotationNumber = nextB2bDocNumber("QT");
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.insert(quotation).values({
      id,
      quotationNumber,
      status,
      firmId,
      dealerId,
      partyName,
      partyPhone:
        typeof body.partyPhone === "string"
          ? body.partyPhone.trim() || null
          : null,
      notes:
        typeof body.notes === "string" ? body.notes.trim() || null : null,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      createdByUserId: access.session.user.id,
    });
    for (const line of resolved) {
      await tx.insert(quotationItem).values({
        id: randomUUID(),
        quotationId: id,
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
    actorUserId: access.session.user.id,
    action: "quotation.create",
    entityType: "quotation",
    entityId: id,
    metadata: { quotationNumber, status, itemCount: resolved.length },
  });

  return NextResponse.json(
    { id, quotationNumber, status, ...totals },
    { status: 201 },
  );
}
