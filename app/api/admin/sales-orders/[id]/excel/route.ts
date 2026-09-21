import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { firm, salesOrder, salesOrderItem } from "@/drizzle/schema";
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
  const header = await db.query.salesOrder.findFirst({
    where: eq(salesOrder.id, id),
  });
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const firmRow = header.firmId
    ? await db.query.firm.findFirst({ where: eq(firm.id, header.firmId) })
    : null;

  const items = await db
    .select()
    .from(salesOrderItem)
    .where(eq(salesOrderItem.salesOrderId, id));

  const headers = [
    "so_number",
    "firm",
    "party",
    "part_number",
    "qty",
    "unit_price_paise",
    "gst_rate",
    "line_total",
    "taxable_estimate",
    "tax",
    "total",
  ];
  const rows = items.map((item) => {
    const taxable = item.lineTotalPaise - item.lineGstPaise;
    return [
      header.soNumber,
      firmRow?.name ?? "",
      header.partyName,
      item.partNumber,
      item.quantity,
      item.unitPricePaise,
      item.gstRate,
      item.lineTotalPaise,
      taxable,
      item.lineGstPaise,
      header.totalPaise,
    ];
  });

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="SO-${header.soNumber}.csv"`,
    },
  });
}
