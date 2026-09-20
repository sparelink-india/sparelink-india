import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { firmOrder, order, firm } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const allocationsData = await db
      .select({
        id: firmOrder.id,
        orderNumber: order.orderNumber,
        firmName: firm.name,
        firmCode: firm.code,
        allocationNumber: firmOrder.allocationNumber,
        amountPaise: firmOrder.amountPaise,
        fulfillmentStatus: firmOrder.fulfillmentStatus,
        paymentAccountingReference: firmOrder.paymentAccountingReference,
        createdAt: firmOrder.createdAt,
      })
      .from(firmOrder)
      .innerJoin(order, eq(firmOrder.orderId, order.id))
      .innerJoin(firm, eq(firmOrder.firmId, firm.id))
      .orderBy(desc(firmOrder.createdAt));

    const rows = allocationsData.map((a) => ({
      "Allocation Number": a.allocationNumber,
      "Firm Name": a.firmName,
      "Firm Code": a.firmCode,
      "Order Number": a.orderNumber,
      Date: new Date(a.createdAt).toISOString().split("T")[0],
      "Allocation Amount (₹)": (a.amountPaise / 100).toFixed(2),
      "Fulfillment Status": a.fulfillmentStatus,
      "BUSY / Accounting Ref": a.paymentAccountingReference,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Allocations");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sparelink_firm_allocations_${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Allocations export error:", error);
    return NextResponse.json(
      { error: "Failed to export allocations" },
      { status: 500 },
    );
  }
}
