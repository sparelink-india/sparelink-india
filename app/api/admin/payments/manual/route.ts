import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  order,
  manualPaymentSubmission,
  user,
} from "@/drizzle/schema";

export async function GET() {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const submissions = await db
      .select({
        id: manualPaymentSubmission.id,
        orderId: manualPaymentSubmission.orderId,
        buyerId: manualPaymentSubmission.buyerId,
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
        orderNumber: order.orderNumber,
        orderTotalPaise: order.totalPaise,
        orderStatus: order.status,
        orderPaymentStatus: order.paymentStatus,
        orderPaymentMethod: order.paymentMethod,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        buyerName: user.name,
        buyerEmail: user.email,
        buyerPhone: user.phoneNumber,
      })
      .from(manualPaymentSubmission)
      .innerJoin(order, eq(manualPaymentSubmission.orderId, order.id))
      .innerJoin(user, eq(manualPaymentSubmission.buyerId, user.id))
      .orderBy(desc(manualPaymentSubmission.createdAt));

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("Failed to load manual payment submissions:", error);
    return NextResponse.json(
      { error: "Failed to load payment submissions" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const submissionId = body?.submissionId;
  const action = body?.action; // "approve" | "reject"
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim() : null;

  if (typeof submissionId !== "string" || !submissionId || !action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "submissionId and valid action ('approve' | 'reject') are required." },
      { status: 400 },
    );
  }

  const db = getDb();

  const submission = await db.query.manualPaymentSubmission.findFirst({
    where: eq(manualPaymentSubmission.id, submissionId),
  });

  if (!submission) {
    return NextResponse.json(
      { error: "Payment submission not found." },
      { status: 404 },
    );
  }

  const orderRecord = await db.query.order.findFirst({
    where: eq(order.id, submission.orderId),
  });

  if (!orderRecord) {
    return NextResponse.json(
      { error: "Associated order not found." },
      { status: 404 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      const newStatus = action === "approve" ? "approved" : "rejected";

      // 1. Update manual payment submission status
      await tx
        .update(manualPaymentSubmission)
        .set({
          status: newStatus,
          adminNote: adminNote || (action === "approve" ? "Verified and approved by administrator" : "Rejected upon verification"),
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(manualPaymentSubmission.id, submission.id));

      // 2. On approval, update order paymentStatus to "paid"
      if (action === "approve") {
        await tx
          .update(order)
          .set({
            paymentStatus: "paid",
            status: orderRecord.status === "payment_pending" ? "placed" : orderRecord.status,
            updatedAt: new Date(),
          })
          .where(eq(order.id, orderRecord.id));
      } else {
        // On rejection, keep paymentStatus as pending (or unpaid)
        await tx
          .update(order)
          .set({
            paymentStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(order.id, orderRecord.id));
      }
    });

    return NextResponse.json({
      success: true,
      message: action === "approve"
        ? `Payment for Order #${orderRecord.orderNumber} approved successfully. Order is marked as paid.`
        : `Payment submission for Order #${orderRecord.orderNumber} has been rejected.`,
    });
  } catch (err) {
    console.error("Failed to update payment submission:", err);
    return NextResponse.json(
      { error: "Failed to process payment review." },
      { status: 500 },
    );
  }
}
