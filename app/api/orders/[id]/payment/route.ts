import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  order,
  manualPaymentSubmission,
  orderItem,
  firm,
  firmOrder,
} from "@/drizzle/schema";
import {
  getBankPaymentConfig,
  getFirmBankPaymentConfig,
} from "@/lib/bank-payment-config";
import { isCashfreeConfiguredForFirm } from "@/lib/cashfree";
import { isAllowedFirmId } from "@/lib/firms";

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

  if (session.user.role !== "admin" && orderRecord.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await db
    .select({
      id: orderItem.id,
      partNumber: orderItem.partNumber,
      partName: orderItem.partName,
      quantity: orderItem.quantity,
      unitPricePaise: orderItem.unitPricePaise,
      totalPaise: orderItem.totalPaise,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderRecord.id));

  const submissions = await db
    .select({
      id: manualPaymentSubmission.id,
      firmOrderId: manualPaymentSubmission.firmOrderId,
      firmId: manualPaymentSubmission.firmId,
      amountPaise: manualPaymentSubmission.amountPaise,
      utrReference: manualPaymentSubmission.utrReference,
      paymentDate: manualPaymentSubmission.paymentDate,
      proofFileUrl: manualPaymentSubmission.proofFileUrl,
      proofFileName: manualPaymentSubmission.proofFileName,
      proofFileType: manualPaymentSubmission.proofFileType,
      status: manualPaymentSubmission.status,
      adminNote: manualPaymentSubmission.adminNote,
      reviewedAt: manualPaymentSubmission.reviewedAt,
      createdAt: manualPaymentSubmission.createdAt,
    })
    .from(manualPaymentSubmission)
    .where(eq(manualPaymentSubmission.orderId, orderRecord.id))
    .orderBy(desc(manualPaymentSubmission.createdAt));

  const firmAllocations = await db
    .select({
      firmOrderId: firmOrder.id,
      firmId: firmOrder.firmId,
      firmName: firm.name,
      firmCode: firm.code,
      allocationNumber: firmOrder.allocationNumber,
      amountPaise: firmOrder.amountPaise,
      fulfillmentStatus: firmOrder.fulfillmentStatus,
      paymentStatus: firmOrder.paymentStatus,
      paymentAccountingReference: firmOrder.paymentAccountingReference,
    })
    .from(firmOrder)
    .innerJoin(firm, eq(firmOrder.firmId, firm.id))
    .where(eq(firmOrder.orderId, orderRecord.id));

  const firmPayments = firmAllocations.map((allocation) => ({
    ...allocation,
    onlinePaymentConfigured: isCashfreeConfiguredForFirm(allocation.firmId),
    bankConfig: getFirmBankPaymentConfig(
      allocation.firmId,
      allocation.firmName,
      allocation.amountPaise,
    ),
  }));

  return NextResponse.json({
    order: {
      id: orderRecord.id,
      orderNumber: orderRecord.orderNumber,
      totalPaise: orderRecord.totalPaise,
      subtotalPaise: orderRecord.subtotalPaise,
      shippingPaise: orderRecord.shippingPaise,
      status: orderRecord.status,
      paymentStatus: orderRecord.paymentStatus,
      paymentMethod: orderRecord.paymentMethod,
      createdAt: orderRecord.createdAt,
      items,
    },
    bankConfig: getBankPaymentConfig(),
    firmPayments,
    submissions,
    latestSubmission: submissions[0] || null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();

  if (!session || session.user.role === "suspended") {
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

  if (session.user.role !== "admin" && orderRecord.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (orderRecord.paymentMethod === "cash_on_delivery") {
    return NextResponse.json(
      { error: "Cash on delivery orders do not use UTR submission." },
      { status: 400 },
    );
  }

  try {
    const formData = await request.formData();
    const firmOrderId = formData.get("firmOrderId")?.toString().trim() ?? "";
    const utrReference = formData.get("utrReference")?.toString().trim();
    const paymentDateStr = formData.get("paymentDate")?.toString().trim();

    if (!firmOrderId) {
      return NextResponse.json(
        { error: "firmOrderId is required." },
        { status: 400 },
      );
    }

    if (!utrReference || utrReference.length < 4 || utrReference.length > 50) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid UTR / Transaction Reference number (4-50 characters).",
        },
        { status: 400 },
      );
    }

    if (!paymentDateStr) {
      return NextResponse.json(
        { error: "Payment date is required." },
        { status: 400 },
      );
    }

    const paymentDate = new Date(paymentDateStr);

    if (isNaN(paymentDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid payment date provided." },
        { status: 400 },
      );
    }

    const allocation = await db.query.firmOrder.findFirst({
      where: eq(firmOrder.id, firmOrderId),
    });

    if (!allocation || allocation.orderId !== orderRecord.id) {
      return NextResponse.json(
        { error: "Firm allocation not found for this order." },
        { status: 404 },
      );
    }

    if (!isAllowedFirmId(allocation.firmId)) {
      return NextResponse.json(
        {
          error:
            "This allocation is not assigned to a valid fulfillment firm.",
        },
        { status: 400 },
      );
    }

    if (allocation.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "This firm allocation has already been marked as paid." },
        { status: 400 },
      );
    }

    const submissionId = randomUUID();

    await db.insert(manualPaymentSubmission).values({
      id: submissionId,
      orderId: orderRecord.id,
      firmOrderId: allocation.id,
      firmId: allocation.firmId,
      buyerId: orderRecord.buyerId,
      amountPaise: allocation.amountPaise,
      utrReference,
      paymentDate,
      proofFileUrl: null,
      proofFileName: null,
      proofFileType: null,
      status: "submitted",
    });

    return NextResponse.json({
      success: true,
      submissionId,
      message: "Payment details submitted successfully. Awaiting admin review.",
    });
  } catch (error) {
    console.error("Manual payment submission error:", error);

    return NextResponse.json(
      { error: "Failed to submit payment details. Please try again." },
      { status: 500 },
    );
  }
}
