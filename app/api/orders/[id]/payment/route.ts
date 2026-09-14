import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  order,
  manualPaymentSubmission,
  orderItem,
  user,
} from "@/drizzle/schema";
import { getBankPaymentConfig } from "@/lib/bank-payment-config";

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

  // Ownership authorization
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

  const bankConfig = getBankPaymentConfig();

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
    bankConfig,
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

  // Ownership authorization
  if (session.user.role !== "admin" && orderRecord.buyerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (orderRecord.paymentStatus === "paid") {
    return NextResponse.json(
      { error: "This order has already been marked as paid." },
      { status: 400 },
    );
  }

  try {
    const formData = await request.formData();
    const utrReference = formData.get("utrReference")?.toString().trim();
    const paymentDateStr = formData.get("paymentDate")?.toString().trim();
    const proofFile = formData.get("proofFile") as File | null;

    if (!utrReference || utrReference.length < 4 || utrReference.length > 50) {
      return NextResponse.json(
        { error: "Please enter a valid UTR / Transaction Reference number (4-50 characters)." },
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

    // Payment amount is always authoritative from the server-side order total.\r\n    const amountPaise = orderRecord.totalPaise;

    let proofFileUrl: string | null = null;
    let proofFileName: string | null = null;
    let proofFileType: string | null = null;


    const amountPaise = orderRecord.totalPaise;

    const submissionId = randomUUID();

    await db.insert(manualPaymentSubmission).values({
      id: submissionId,
      orderId: orderRecord.id,
      buyerId: orderRecord.buyerId,
      amountPaise,
      utrReference,
      paymentDate,
      proofFileUrl,
      proofFileName,
      proofFileType,
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




