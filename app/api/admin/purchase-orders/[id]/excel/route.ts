import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  firm,
  purchaseOrder,
  purchaseOrderItem,
  supplier,
} from "@/drizzle/schema";
import { toCsv } from "@/lib/b2b-lines";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const db = getDb();
  const header = await db.query.purchaseOrder.findFirst({
    where: eq(purchaseOrder.id, id),
  });
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supplierRow = await db.query.supplier.findFirst({
    where: eq(supplier.id, header.supplierId),
  });
  const firmRow = header.firmId
    ? await db.query.firm.findFirst({ where: eq(firm.id, header.firmId) })
    : null;
  const items = await db
    .select()
    .from(purchaseOrderItem)
    .where(eq(purchaseOrderItem.purchaseOrderId, id));

  const headers = [
    "po_number",
    "supplier",
    "firm",
    "part_number",
    "part_name",
    "qty",
    "unit_cost_paise",
    "gst_rate",
    "line_total",
    "tax",
    "total",
  ];
  const rows = items.map((item) => [
    header.poNumber,
    supplierRow?.name ?? "",
    firmRow?.name ?? "",
    item.partNumber,
    item.partName,
    item.quantity,
    item.unitCostPaise,
    item.gstRate,
    item.lineTotalPaise,
    item.lineGstPaise,
    header.totalPaise,
  ]);

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="PO-${header.poNumber}.csv"`,
    },
  });
}
