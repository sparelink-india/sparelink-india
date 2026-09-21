import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import {
  goodsReceipt,
  goodsReceiptItem,
  purchaseOrder,
  purchaseOrderItem,
  supplier,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  confirmGoodsReceipt,
  listGoodsReceipts,
} from "@/lib/goods-receipt-service";
import { requireAdminApi } from "@/lib/require-role";
import { toCsv } from "@/lib/b2b-lines";

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const format = url.searchParams.get("format");

  if (id) {
    const header = await getDb().query.goodsReceipt.findFirst({
      where: eq(goodsReceipt.id, id),
    });
    if (!header) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const items = await getDb()
      .select()
      .from(goodsReceiptItem)
      .where(eq(goodsReceiptItem.goodsReceiptId, id));
    const po = await getDb().query.purchaseOrder.findFirst({
      where: eq(purchaseOrder.id, header.purchaseOrderId),
    });
    const supplierRow = await getDb().query.supplier.findFirst({
      where: eq(supplier.id, header.supplierId),
    });
    return NextResponse.json({
      receipt: header,
      items,
      purchaseOrder: po,
      supplier: supplierRow
        ? {
            id: supplierRow.id,
            name: supplierRow.name,
            // Admin may see GSTIN; never expose to buyer APIs.
            gstin: supplierRow.gstin,
          }
        : null,
    });
  }

  const rows = await listGoodsReceipts(200);

  if (format === "csv") {
    const csv = toCsv(
      [
        "receipt_number",
        "po_number",
        "supplier_name",
        "warehouse_code",
        "status",
        "created_at",
      ],
      rows.map((r) => [
        r.receiptNumber,
        r.poNumber,
        r.supplierName,
        r.warehouseCode,
        r.status,
        r.createdAt?.toISOString?.() ?? String(r.createdAt),
      ]),
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="goods-receipts.csv"',
      },
    });
  }

  return NextResponse.json({ receipts: rows });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const purchaseOrderId =
    typeof body.purchaseOrderId === "string"
      ? body.purchaseOrderId.trim()
      : "";
  if (!purchaseOrderId) {
    return NextResponse.json(
      { error: "purchaseOrderId is required" },
      { status: 400 },
    );
  }

  const itemsRaw = Array.isArray(body.lines)
    ? body.lines
    : Array.isArray(body.items)
      ? body.items
      : [];
  const lines = itemsRaw.map((item: unknown) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      purchaseOrderItemId:
        typeof row.purchaseOrderItemId === "string"
          ? row.purchaseOrderItemId.trim()
          : "",
      quantityReceived: Number(row.quantityReceived),
    };
  });

  // Optional preview of PO pending quantities for UI convenience.
  if (body.preview === true) {
    const po = await getDb().query.purchaseOrder.findFirst({
      where: eq(purchaseOrder.id, purchaseOrderId),
    });
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }
    const poItems = await getDb()
      .select()
      .from(purchaseOrderItem)
      .where(eq(purchaseOrderItem.purchaseOrderId, purchaseOrderId));
    return NextResponse.json({
      purchaseOrder: po,
      items: poItems.map((item) => ({
        id: item.id,
        partNumber: item.partNumber,
        partName: item.partName,
        quantity: item.quantity,
        receivedQuantity: item.receivedQuantity ?? 0,
        pendingQuantity: Math.max(
          0,
          item.quantity - (item.receivedQuantity ?? 0),
        ),
        dealerListingId: item.dealerListingId,
        // unitCostPaise intentionally omitted from generic list responses that
        // might leak; this is admin-only so include for receipt UI.
        unitCostPaise: item.unitCostPaise,
      })),
    });
  }

  const result = await confirmGoodsReceipt({
    purchaseOrderId,
    lines,
    supplierId:
      typeof body.supplierId === "string" ? body.supplierId.trim() : null,
    warehouseCode:
      typeof body.warehouseCode === "string" ? body.warehouseCode.trim() : null,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    idempotencyKey:
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey.trim() || null
        : null,
    actorUserId: access.session.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      id: result.receipt.id,
      receiptNumber: result.receipt.receiptNumber,
      created: result.created,
      stockIncreases: result.stockIncreases,
      status: result.receipt.status,
    },
    { status: result.created ? 201 : 200 },
  );
}
