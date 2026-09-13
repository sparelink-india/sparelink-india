import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  order,
  orderItem,
  firmOrder,
  firm,
  part,
  user,
} from "@/drizzle/schema";
import { generateInvoicePDFBuffer } from "@/lib/invoice-pdf";

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

  // Authorization: Only the buyer who placed the order or an admin can access the invoice
  if (session.user.role !== "admin" && orderRecord.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch order items with part details
  const items = await db
    .select({
      id: orderItem.id,
      partId: orderItem.partId,
      partNumber: orderItem.partNumber,
      partName: orderItem.partName,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      totalPaise: orderItem.totalPaise,
      partDescription: part.description,
      partBrand: part.brand,
    })
    .from(orderItem)
    .leftJoin(part, eq(orderItem.partId, part.id))
    .where(eq(orderItem.orderId, orderRecord.id));

  // Fetch firm allocations
  const allocations = await db
    .select({
      id: firmOrder.id,
      allocationNumber: firmOrder.allocationNumber,
      firmName: firm.name,
      firmCode: firm.code,
      accountingReference: firmOrder.paymentAccountingReference,
      amountPaise: firmOrder.amountPaise,
      status: firmOrder.fulfillmentStatus,
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .where(eq(firmOrder.orderId, orderRecord.id));

  try {
    const pdfBuffer = await generateInvoicePDFBuffer({
      orderNumber: orderRecord.orderNumber,
      createdAt: orderRecord.createdAt,
      status: orderRecord.status,
      paymentMethod: orderRecord.paymentMethod,
      paymentStatus: orderRecord.paymentStatus,
      subtotalPaise: orderRecord.subtotalPaise,
      shippingPaise: orderRecord.shippingPaise,
      totalPaise: orderRecord.totalPaise,
      shippingName: orderRecord.shippingName,
      shippingPhone: orderRecord.shippingPhone,
      shippingAddressLine1: orderRecord.shippingAddressLine1,
      shippingAddressLine2: orderRecord.shippingAddressLine2,
      shippingCity: orderRecord.shippingCity,
      shippingState: orderRecord.shippingState,
      shippingPincode: orderRecord.shippingPincode,
      shippingMethod: orderRecord.shippingMethod,
      transportName: orderRecord.transportName,
      transportPhone: orderRecord.transportPhone,
      transportGstin: orderRecord.transportGstin,
      items,
      allocations,
    });

    const filename = `SpareLink-Order-${orderRecord.orderNumber}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (pdfError) {
    console.error("PDF generation error:", pdfError);
    return NextResponse.json(
      { error: "Failed to generate PDF tax invoice." },
      { status: 500 },
    );
  }
}
