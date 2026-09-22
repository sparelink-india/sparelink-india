import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { salesOrder, salesOrderItem } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  nextB2bDocNumber,
  sumDocumentTotals,
} from "@/lib/b2b-lines";
import {
  loadActiveListingsByPartNumbers,
  resolveSalesLineFromListing,
  type ResolvedListingLine,
} from "@/lib/b2b-listings";
import { getDb } from "@/lib/db";
import { isAllowedFirmId } from "@/lib/firms";
import { requireAdminApi } from "@/lib/require-role";

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const action = body.action === "confirm" ? "confirm" : "validate";
  const partyName =
    typeof body.partyName === "string" ? body.partyName.trim() : "";
  let firmId =
    typeof body.firmId === "string" && body.firmId.trim()
      ? body.firmId.trim()
      : null;
  if (firmId && !isAllowedFirmId(firmId)) {
    return NextResponse.json({ error: "Invalid firmId" }, { status: 400 });
  }

  const rowsRaw = Array.isArray(body.rows) ? body.rows : [];
  if (rowsRaw.length === 0) {
    return NextResponse.json({ error: "rows required" }, { status: 400 });
  }

  const parsed: Array<{ partNumber: string; quantity: number }> = [];
  for (const row of rowsRaw) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "Invalid row" }, { status: 400 });
    }
    const partNumber =
      typeof row.partNumber === "string" ? row.partNumber.trim() : "";
    const quantity = Number(row.quantity);
    if (!partNumber || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Each row needs partNumber and positive quantity" },
        { status: 400 },
      );
    }
    parsed.push({ partNumber, quantity });
  }

  const listingMap = await loadActiveListingsByPartNumbers(
    parsed.map((r) => r.partNumber),
  );

  const results = parsed.map((row) => {
    const listing = listingMap.get(row.partNumber);
    if (!listing) {
      return {
        partNumber: row.partNumber,
        quantity: row.quantity,
        ok: false as const,
        error: "No active listing for part number",
      };
    }
    const line = resolveSalesLineFromListing(listing, row.quantity);
    return {
      partNumber: row.partNumber,
      quantity: row.quantity,
      ok: true as const,
      dealerListingId: line.dealerListingId,
      partName: line.partName,
      unitPricePaise: line.unitPricePaise,
      gstRate: line.gstRate,
      lineTotalPaise: line.lineTotalPaise,
      stock: line.stock,
      firmId: line.firmId,
    };
  });

  const invalid = results.filter((r) => !r.ok);
  if (action === "validate" || invalid.length > 0) {
    return NextResponse.json({
      action: "validate",
      ok: invalid.length === 0,
      results,
      errors: invalid,
    });
  }

  if (!partyName) {
    return NextResponse.json(
      { error: "partyName is required to confirm" },
      { status: 400 },
    );
  }

  const okLines = results.filter((r) => r.ok);
  const resolved: ResolvedListingLine[] = [];
  for (const r of okLines) {
    const listing = listingMap.get(r.partNumber)!;
    resolved.push(resolveSalesLineFromListing(listing, r.quantity));
  }

  if (!firmId) {
    firmId =
      resolved.find((r) => r.firmId && isAllowedFirmId(r.firmId))?.firmId ??
      null;
  }

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
      partyName,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      createdByUserId: access.session.user.id,
      notes: "Created from bulk order import",
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
    actorUserId: access.session.user.id,
    action: "bulk_order.confirm",
    entityType: "sales_order",
    entityId: id,
    metadata: { soNumber, rows: resolved.length },
  });

  return NextResponse.json(
    {
      action: "confirm",
      ok: true,
      salesOrderId: id,
      soNumber,
      ...totals,
      results,
    },
    { status: 201 },
  );
}
