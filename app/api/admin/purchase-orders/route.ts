import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { purchaseOrder, purchaseOrderItem, supplier } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import {
  computeInclusiveLine,
  nextB2bDocNumber,
  sumDocumentTotals,
} from "@/lib/b2b-lines";
import { loadActiveListingById } from "@/lib/b2b-listings";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { isAllowedFirmId } from "@/lib/firms";
import { requireAdminApi } from "@/lib/require-role";

const PO_STATUSES = new Set(["draft", "submitted"]);

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const rows = await db
    .select({
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      status: purchaseOrder.status,
      supplierId: purchaseOrder.supplierId,
      supplierName: supplier.name,
      firmId: purchaseOrder.firmId,
      warehouseCode: purchaseOrder.warehouseCode,
      subtotalPaise: purchaseOrder.subtotalPaise,
      gstPaise: purchaseOrder.gstPaise,
      totalPaise: purchaseOrder.totalPaise,
      createdAt: purchaseOrder.createdAt,
    })
    .from(purchaseOrder)
    .leftJoin(supplier, eq(purchaseOrder.supplierId, supplier.id))
    .orderBy(desc(purchaseOrder.createdAt))
    .limit(200);
  return NextResponse.json({ purchaseOrders: rows });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supplierId =
    typeof body.supplierId === "string" ? body.supplierId.trim() : "";
  if (!supplierId) {
    return NextResponse.json({ error: "supplierId is required" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" && PO_STATUSES.has(body.status)
      ? body.status
      : "draft";
  let firmId =
    typeof body.firmId === "string" && body.firmId.trim()
      ? body.firmId.trim()
      : null;
  if (firmId && !isAllowedFirmId(firmId)) {
    return NextResponse.json({ error: "Invalid firmId" }, { status: 400 });
  }

  const db = getDb();
  const supplierRow = await db.query.supplier.findFirst({
    where: eq(supplier.id, supplierId),
  });
  if (!supplierRow) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const itemsRaw = Array.isArray(body.items) ? body.items : [];
  if (itemsRaw.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }

  type PoLine = {
    dealerListingId: string | null;
    partId: string | null;
    partNumber: string;
    partName: string;
    sku: string | null;
    quantity: number;
    unitCostPaise: number;
    gstRate: number;
    lineGstPaise: number;
    lineTotalPaise: number;
  };

  const lines: PoLine[] = [];
  for (const item of itemsRaw) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Invalid item" }, { status: 400 });
    }
    const quantity = Number(item.quantity);
    const unitCostPaise = Number(item.unitCostPaise);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive integer" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(unitCostPaise) || unitCostPaise < 0) {
      return NextResponse.json(
        { error: "unitCostPaise must be an integer >= 0" },
        { status: 400 },
      );
    }

    const dealerListingId =
      typeof item.dealerListingId === "string"
        ? item.dealerListingId.trim()
        : "";

    if (dealerListingId) {
      const listing = await loadActiveListingById(dealerListingId);
      if (!listing) {
        return NextResponse.json(
          { error: `Listing not found: ${dealerListingId}` },
          { status: 400 },
        );
      }
      const gstRate = extractGSTRate(listing.partDescription);
      const priced = computeInclusiveLine({
        unitInclusivePaise: unitCostPaise,
        quantity,
        gstRate,
      });
      if (!firmId && listing.firmId && isAllowedFirmId(listing.firmId)) {
        firmId = listing.firmId;
      }
      lines.push({
        dealerListingId: listing.id,
        partId: listing.partId,
        partNumber: listing.partNumber,
        partName: listing.partName,
        sku: listing.sku,
        quantity: priced.quantity,
        unitCostPaise: priced.unitInclusivePaise,
        gstRate: priced.gstRate,
        lineGstPaise: priced.lineGstPaise,
        lineTotalPaise: priced.lineTotalPaise,
      });
      continue;
    }

    const partNumber =
      typeof item.partNumber === "string" ? item.partNumber.trim() : "";
    const partName =
      typeof item.partName === "string" ? item.partName.trim() : "";
    if (!partNumber || !partName) {
      return NextResponse.json(
        {
          error:
            "Each item needs dealerListingId or partNumber+partName, plus unitCostPaise",
        },
        { status: 400 },
      );
    }
    const gstRate =
      typeof item.gstRate === "number" && Number.isFinite(item.gstRate)
        ? Math.round(item.gstRate)
        : 18;
    const priced = computeInclusiveLine({
      unitInclusivePaise: unitCostPaise,
      quantity,
      gstRate,
    });
    lines.push({
      dealerListingId: null,
      partId: null,
      partNumber,
      partName,
      sku: typeof item.sku === "string" ? item.sku.trim() || null : null,
      quantity: priced.quantity,
      unitCostPaise: priced.unitInclusivePaise,
      gstRate: priced.gstRate,
      lineGstPaise: priced.lineGstPaise,
      lineTotalPaise: priced.lineTotalPaise,
    });
  }

  const totals = sumDocumentTotals(lines);
  const id = randomUUID();
  const poNumber = nextB2bDocNumber("PO");

  await db.transaction(async (tx) => {
    await tx.insert(purchaseOrder).values({
      id,
      poNumber,
      status,
      supplierId,
      firmId,
      warehouseCode:
        typeof body.warehouseCode === "string" && body.warehouseCode.trim()
          ? body.warehouseCode.trim()
          : "MAIN",
      notes:
        typeof body.notes === "string" ? body.notes.trim() || null : null,
      subtotalPaise: totals.subtotalPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      createdByUserId: access.session.user.id,
    });
    for (const line of lines) {
      await tx.insert(purchaseOrderItem).values({
        id: randomUUID(),
        purchaseOrderId: id,
        ...line,
      });
    }
  });

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "purchase_order.create",
    entityType: "purchase_order",
    entityId: id,
    metadata: { poNumber, status, itemCount: lines.length },
  });

  return NextResponse.json(
    { id, poNumber, status, ...totals },
    { status: 201 },
  );
}
