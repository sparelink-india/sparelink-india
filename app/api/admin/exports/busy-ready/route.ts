import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { firm, salesOrder, salesOrderItem } from "@/drizzle/schema";
import { toCsv } from "@/lib/b2b-lines";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const rows = await db
    .select({
      soNumber: salesOrder.soNumber,
      partyName: salesOrder.partyName,
      status: salesOrder.status,
      firmName: firm.name,
      ledgerReference: firm.ledgerReference,
      partNumber: salesOrderItem.partNumber,
      partName: salesOrderItem.partName,
      quantity: salesOrderItem.quantity,
      unitPricePaise: salesOrderItem.unitPricePaise,
      gstRate: salesOrderItem.gstRate,
      lineGstPaise: salesOrderItem.lineGstPaise,
      lineTotalPaise: salesOrderItem.lineTotalPaise,
      totalPaise: salesOrder.totalPaise,
      createdAt: salesOrder.createdAt,
    })
    .from(salesOrder)
    .innerJoin(salesOrderItem, eq(salesOrderItem.salesOrderId, salesOrder.id))
    .leftJoin(firm, eq(salesOrder.firmId, firm.id))
    .where(eq(salesOrder.status, "submitted"));

  const headers = [
    "so_number",
    "party",
    "firm",
    "ledger_reference",
    "part_number",
    "part_name",
    "qty",
    "unit_price_paise",
    "gst_rate",
    "line_gst_paise",
    "line_total_paise",
    "so_total_paise",
    "created_at",
  ];
  const csvRows = rows.map((r) => [
    r.soNumber,
    r.partyName,
    r.firmName ?? "",
    r.ledgerReference ?? "",
    r.partNumber,
    r.partName,
    r.quantity,
    r.unitPricePaise,
    r.gstRate,
    r.lineGstPaise,
    r.lineTotalPaise,
    r.totalPaise,
    r.createdAt?.toISOString?.() ?? String(r.createdAt),
  ]);

  const csv = toCsv(headers, csvRows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="busy-ready-sales-orders.csv"',
    },
  });
}
