import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  order,
  orderItem,
  firmOrder,
  firmOrderItem,
  firm,
  part,
} from "@/drizzle/schema";
import { generateInvoicePDFBuffer } from "@/lib/invoice-pdf";
import { canAccessCustomerOrder } from "@/lib/order-architecture";
import { resolveFirmSellerProfile } from "@/lib/firms";
import { splitInclusiveGst } from "@/lib/party-pricing";
import { denyIfMustChangePassword } from "@/lib/require-role";

function extractHsn(description?: string | null): string | null {
  if (!description?.includes("HSN:")) return null;
  const match = description.match(/HSN:\s*(\d+)/i);
  return match?.[1] ?? null;
}

/**
 * Prefer stored line snapshots. For pre-snapshot orders (zeros), derive a
 * one-time split from the stored inclusive total + stored gstRate only —
 * never from live catalogue price.
 */
function resolveLineTaxSnapshot(item: {
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  gstRate: number;
  lineBasePaise: number;
  lineGstPaise: number;
}): { gstRate: number; lineBasePaise: number; lineGstPaise: number } {
  const gstRate =
    typeof item.gstRate === "number" && item.gstRate >= 0 ? item.gstRate : 18;
  if (item.lineBasePaise > 0 || item.lineGstPaise > 0) {
    return {
      gstRate,
      lineBasePaise: item.lineBasePaise,
      lineGstPaise: item.lineGstPaise,
    };
  }
  const inclusive =
    item.totalPaise > 0
      ? item.totalPaise
      : item.unitPricePaise * Math.max(item.quantity, 1);
  const split = splitInclusiveGst(inclusive, gstRate);
  return {
    gstRate,
    lineBasePaise: split.basePaise,
    lineGstPaise: split.gstPaise,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const { id: orderId } = await params;
  const firmOrderIdParam =
    request.nextUrl.searchParams.get("firmOrderId")?.trim() || null;
  const db = getDb();

  const orderRecord = await db.query.order.findFirst({
    where: eq(order.id, orderId),
  });

  if (!orderRecord) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (
    !canAccessCustomerOrder(
      { role: session.user.role, id: session.user.id },
      orderRecord.buyerId,
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allocations = await db
    .select({
      id: firmOrder.id,
      firmId: firmOrder.firmId,
      allocationNumber: firmOrder.allocationNumber,
      amountPaise: firmOrder.amountPaise,
      subtotalPaise: firmOrder.subtotalPaise,
      gstPaise: firmOrder.gstPaise,
      paymentMethod: firmOrder.paymentMethod,
      paymentStatus: firmOrder.paymentStatus,
      fulfillmentStatus: firmOrder.fulfillmentStatus,
      invoiceReference: firmOrder.invoiceReference,
      accountingReference: firmOrder.paymentAccountingReference,
      firmName: firm.name,
      firmCode: firm.code,
      firmLegalName: firm.legalName,
      firmAddress: firm.address,
      firmPhone: firm.phone,
      firmEmail: firm.email,
      firmGstin: firm.gstin,
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .where(eq(firmOrder.orderId, orderRecord.id));

  if (!allocations.length) {
    return NextResponse.json(
      {
        error:
          "This order has no firm allocation, so a legal seller cannot be determined for the tax invoice.",
      },
      { status: 409 },
    );
  }

  let selected = allocations[0];
  if (firmOrderIdParam) {
    const match = allocations.find((row) => row.id === firmOrderIdParam);
    if (!match) {
      return NextResponse.json(
        { error: "Firm allocation not found for this order." },
        { status: 404 },
      );
    }
    selected = match;
  } else if (allocations.length > 1) {
    return NextResponse.json(
      {
        error:
          "This order contains multiple legal firms. Request a firm-specific invoice with ?firmOrderId=<allocation id>. Do not merge firms into one tax invoice.",
        firmAllocations: allocations.map((row) => ({
          firmOrderId: row.id,
          firmId: row.firmId,
          firmName: row.firmName,
          firmCode: row.firmCode,
          allocationNumber: row.allocationNumber,
          amountPaise: row.amountPaise,
        })),
      },
      { status: 409 },
    );
  }

  const linkedItems = await db
    .select({
      orderItemId: firmOrderItem.orderItemId,
    })
    .from(firmOrderItem)
    .where(eq(firmOrderItem.firmOrderId, selected.id));

  if (!linkedItems.length) {
    return NextResponse.json(
      {
        error:
          "This firm allocation has no line items, so an invoice cannot be generated.",
      },
      { status: 409 },
    );
  }

  const itemRows = await db
    .select({
      id: orderItem.id,
      partNumber: orderItem.partNumber,
      partName: orderItem.partName,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      totalPaise: orderItem.totalPaise,
      gstRate: orderItem.gstRate,
      lineBasePaise: orderItem.lineBasePaise,
      lineGstPaise: orderItem.lineGstPaise,
      partDescription: part.description,
    })
    .from(orderItem)
    .leftJoin(part, eq(orderItem.partId, part.id))
    .where(
      and(
        eq(orderItem.orderId, orderRecord.id),
        inArray(
          orderItem.id,
          linkedItems.map((row) => row.orderItemId),
        ),
      ),
    );

  const items = itemRows.map((row) => {
    const tax = resolveLineTaxSnapshot(row);
    return {
      partNumber: row.partNumber,
      partName: row.partName,
      quantity: row.quantity,
      unitPricePaise: row.unitPricePaise,
      totalPaise: row.totalPaise,
      gstRate: tax.gstRate,
      lineBasePaise: tax.lineBasePaise,
      lineGstPaise: tax.lineGstPaise,
      hsn: extractHsn(row.partDescription),
    };
  });

  const seller = resolveFirmSellerProfile({
    id: selected.firmId,
    name: selected.firmName,
    code: selected.firmCode,
    legalName: selected.firmLegalName,
    address: selected.firmAddress,
    phone: selected.firmPhone,
    email: selected.firmEmail,
    gstin: selected.firmGstin,
  });

  const snapshotSubtotal =
    selected.subtotalPaise > 0
      ? selected.subtotalPaise
      : items.reduce((sum, item) => sum + item.lineBasePaise, 0);
  const snapshotGst =
    selected.gstPaise > 0
      ? selected.gstPaise
      : items.reduce((sum, item) => sum + item.lineGstPaise, 0);
  const merchandiseTotal =
    selected.amountPaise > 0
      ? selected.amountPaise
      : items.reduce((sum, item) => sum + item.totalPaise, 0);

  // Parent shipping applies only when this order has a single firm seller.
  const shippingPaise =
    allocations.length === 1 ? (orderRecord.shippingPaise ?? 0) : 0;
  const invoiceTotal = merchandiseTotal + shippingPaise;
  const invoiceReference =
    selected.invoiceReference || selected.allocationNumber;

  try {
    const pdfBuffer = await generateInvoicePDFBuffer({
      orderNumber: orderRecord.orderNumber,
      invoiceReference,
      createdAt: orderRecord.createdAt,
      status: selected.fulfillmentStatus || orderRecord.status,
      paymentMethod: selected.paymentMethod || orderRecord.paymentMethod,
      paymentStatus: selected.paymentStatus || orderRecord.paymentStatus,
      subtotalPaise: snapshotSubtotal,
      gstPaise: snapshotGst,
      shippingPaise,
      totalPaise: invoiceTotal,
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
      buyerGstin: orderRecord.buyerGstin,
      seller,
      items,
      allocation: {
        allocationNumber: selected.allocationNumber,
        firmName: selected.firmName,
        firmCode: selected.firmCode,
        accountingReference: selected.accountingReference,
      },
    });

    const filename = `Invoice-${invoiceReference}.pdf`;

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
