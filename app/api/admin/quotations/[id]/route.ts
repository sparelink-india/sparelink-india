import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  quotation,
  quotationItem,
  salesOrder,
  salesOrderItem,
} from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  nextB2bDocNumber,
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

const PATCH_STATUSES = new Set(["draft", "submitted", "cancelled", "converted"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const db = getDb();
  const header = await db.query.quotation.findFirst({
    where: eq(quotation.id, id),
  });
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = await db
    .select()
    .from(quotationItem)
    .where(eq(quotationItem.quotationId, id));
  return NextResponse.json({ quotation: header, items });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status =
    body && typeof body.status === "string" ? body.status.trim() : "";
  if (!PATCH_STATUSES.has(status) || status === "converted") {
    return NextResponse.json(
      { error: "status must be draft|submitted|cancelled (use POST convert)" },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db.query.quotation.findFirst({
    where: eq(quotation.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(quotation)
    .set({ status, updatedAt: new Date() })
    .where(eq(quotation.id, id));

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "quotation.status_update",
    entityType: "quotation",
    entityId: id,
    metadata: { previous: existing.status, status },
  });

  return NextResponse.json({ id, status });
}

/** Convert quotation → sales order with revalidated listing prices. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action =
    body && typeof body.action === "string" ? body.action.trim() : "convert";
  if (action !== "convert") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const db = getDb();
  const header = await db.query.quotation.findFirst({
    where: eq(quotation.id, id),
  });
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (header.convertedSalesOrderId) {
    return NextResponse.json(
      {
        error: "Already converted",
        salesOrderId: header.convertedSalesOrderId,
      },
      { status: 409 },
    );
  }

  const items = await db
    .select()
    .from(quotationItem)
    .where(eq(quotationItem.quotationId, id));
  if (items.length === 0) {
    return NextResponse.json({ error: "Quotation has no items" }, { status: 400 });
  }

  const resolved: ResolvedListingLine[] = [];
  for (const item of items) {
    if (!item.dealerListingId) {
      return NextResponse.json(
        { error: `Line ${item.partNumber} has no listing to revalidate` },
        { status: 400 },
      );
    }
    const listing = await loadActiveListingById(item.dealerListingId);
    if (!listing) {
      return NextResponse.json(
        {
          error: `Active listing missing for ${item.partNumber}; cannot convert`,
        },
        { status: 400 },
      );
    }
    resolved.push(resolveSalesLineFromListing(listing, item.quantity));
  }

  let firmId = header.firmId;
  if (firmId && !isAllowedFirmId(firmId)) firmId = null;
  if (!firmId) {
    firmId =
      resolved.find((r) => r.firmId && isAllowedFirmId(r.firmId))?.firmId ??
      null;
  }

  const totals = sumDocumentTotals(resolved);
  const soId = randomUUID();
  const soNumber = nextB2bDocNumber("SO");

  await db.transaction(async (tx) => {
    await tx.insert(salesOrder).values({
      id: soId,
      soNumber,
      status: "draft",
      firmId,
      dealerId: header.dealerId,
      partyName: header.partyName,
      partyPhone: header.partyPhone,
      notes: header.notes,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      createdByUserId: access.session.user.id,
      quotationId: id,
    });
    for (const line of resolved) {
      await tx.insert(salesOrderItem).values({
        id: randomUUID(),
        salesOrderId: soId,
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
    await tx
      .update(quotation)
      .set({
        status: "converted",
        convertedSalesOrderId: soId,
        updatedAt: new Date(),
      })
      .where(eq(quotation.id, id));
  });

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "quotation.convert",
    entityType: "quotation",
    entityId: id,
    metadata: { salesOrderId: soId, soNumber },
  });

  return NextResponse.json(
    { salesOrderId: soId, soNumber, ...totals },
    { status: 201 },
  );
}
