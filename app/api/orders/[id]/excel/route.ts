import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { gateOrderAccess } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  order,
  orderItem,
  firmOrder,
  firm,
  part,
} from "@/drizzle/schema";
import { extractGSTRate } from "@/lib/gst";
import { splitInclusiveGst } from "@/lib/party-pricing";
import * as XLSX from "xlsx";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const db = getDb();

  const orderRecord = await db.query.order.findFirst({
    where: eq(order.id, orderId),
  });

  if (!orderRecord) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const access = gateOrderAccess(session, orderRecord.buyerId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Fetch items
  const items = await db
    .select({
      id: orderItem.id,
      partNumber: orderItem.partNumber,
      partName: orderItem.partName,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      totalPaise: orderItem.totalPaise,
      partDescription: part.description,
    })
    .from(orderItem)
    .leftJoin(part, eq(orderItem.partId, part.id))
    .where(eq(orderItem.orderId, orderRecord.id));

  // Fetch allocations
  const allocations = await db
    .select({
      id: firmOrder.id,
      allocationNumber: firmOrder.allocationNumber,
      firmName: firm.name,
      firmCode: firm.code,
      accountingReference: firmOrder.paymentAccountingReference,
      amountPaise: firmOrder.amountPaise,
      fulfillmentStatus: firmOrder.fulfillmentStatus,
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .where(eq(firmOrder.orderId, orderRecord.id));

  const gstAmount = Math.max(
    0,
    orderRecord.totalPaise - orderRecord.subtotalPaise - (orderRecord.shippingPaise || 0),
  );

  let buyerGstin = "-";
  if (orderRecord.shippingAddressLine2?.includes("GSTIN:")) {
    const match = orderRecord.shippingAddressLine2.match(/GSTIN:\s*([0-9A-Z]{15})/i);
    if (match) buyerGstin = match[1].toUpperCase();
  }

  // 1. Sheet 1: Order Summary
  const summaryRows = [
    {
      "Order Number": orderRecord.orderNumber,
      "Order Date": new Date(orderRecord.createdAt).toISOString().split("T")[0],
      Customer: orderRecord.shippingName,
      Mobile: orderRecord.shippingPhone,
      "Buyer GSTIN": buyerGstin,
      "Shipping Method": orderRecord.shippingMethod.replace(/_/g, " ").toUpperCase(),
      "Delivery / Transport": orderRecord.transportName || "Direct / Self",
      "Subtotal (₹)": (orderRecord.subtotalPaise / 100).toFixed(2),
      "Total GST (₹)": (gstAmount / 100).toFixed(2),
      "Shipping (₹)": ((orderRecord.shippingPaise || 0) / 100).toFixed(2),
      "Grand Total (₹)": (orderRecord.totalPaise / 100).toFixed(2),
      "Payment Method": orderRecord.paymentMethod.replace(/_/g, " ").toUpperCase(),
      "Payment Status": orderRecord.paymentStatus.toUpperCase(),
      "Order Status": orderRecord.status.toUpperCase(),
    },
  ];

  // 2. Sheet 2: Order Items
  const primaryFirmName = allocations[0]?.firmName || "Ambaji Traders";
  const itemRows = items.map((item) => {
    const gstRate = extractGSTRate(item.partDescription);
    const tax = splitInclusiveGst(item.totalPaise, gstRate);

    return {
      "Part Number": item.partNumber,
      Product: item.partName,
      Firm: primaryFirmName,
      Quantity: item.quantity,
      "Unit Price (₹)": (item.unitPricePaise / 100).toFixed(2),
      "GST (%)": `${gstRate}%`,
      "GST Amount (₹)": (tax.gstPaise / 100).toFixed(2),
      "Subtotal (₹)": (tax.basePaise / 100).toFixed(2),
      "Line Total (₹)": (item.totalPaise / 100).toFixed(2),
    };
  });

  // 3. Sheet 3: Firm-wise Allocation
  const allocationRows = allocations.map((a) => ({
    Firm: a.firmName,
    "Firm Code": a.firmCode,
    "Allocation Reference": a.allocationNumber,
    "Items Count": items.length,
    "Amount (₹)": (a.amountPaise / 100).toFixed(2),
    "Fulfillment Status": a.fulfillmentStatus.toUpperCase(),
    "Accounting / BUSY Reference": a.accountingReference || "-",
  }));

  const workbook = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, wsSummary, "Order Summary");

  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(workbook, wsItems, "Order Items");

  const wsAllocations = XLSX.utils.json_to_sheet(allocationRows);
  XLSX.utils.book_append_sheet(workbook, wsAllocations, "Firm Allocations");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const filename = `SpareLink-Order-${orderRecord.orderNumber}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
