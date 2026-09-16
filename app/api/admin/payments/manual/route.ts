import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import {
  firmOrder,
  manualPaymentSubmission,
  order,
  user,
} from "@/drizzle/schema";
import { isAllowedFirmId } from "@/lib/firms";
import { syncParentOrderPaymentStatus } from "@/lib/payment-rollup";

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
        firmOrderId: manualPaymentSubmission.firmOrderId,
        firmId: manualPaymentSubmission.firmId,
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
  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim() : null;

  if (
    typeof submissionId !== "string" ||
    !submissionId ||
    !action ||
    !["approve", "reject"].includes(action)
  ) {
    return NextResponse.json(
      {
        error:
          "submissionId and valid action ('approve' | 'reject') are required.",
      },
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

  if (submission.status !== "submitted") {
    return NextResponse.json(
      { error: "This submission has already been reviewed." },
      { status: 409 },
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
    const parentStatus = await db.transaction(async (tx) => {
      const newStatus = action === "approve" ? "approved" : "rejected";

      await tx
        .update(manualPaymentSubmission)
        .set({
          status: newStatus,
          adminNote:
            adminNote ||
            (action === "approve"
              ? "Verified and approved by administrator"
              : "Rejected upon verification"),
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(manualPaymentSubmission.id, submission.id));

      if (action !== "approve") {
        return syncParentOrderPaymentStatus(tx, orderRecord.id);
      }

      if (!submission.firmOrderId) {
        throw new Error("ALLOCATION_REQUIRED");
      }

      const allocationRows = await tx
        .select()
        .from(firmOrder)
        .where(
          and(
            eq(firmOrder.id, submission.firmOrderId),
            eq(firmOrder.orderId, orderRecord.id),
          ),
        )
        .for("update");
      const allocation = allocationRows[0];

      if (!allocation) {
        throw new Error("ALLOCATION_MISSING");
      }

      if (!isAllowedFirmId(allocation.firmId)) {
        throw new Error("FIRM_NOT_ALLOWED");
      }

      if (allocation.paymentStatus !== "paid") {
        await tx
          .update(firmOrder)
          .set({
            paymentStatus: "paid",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(firmOrder.id, allocation.id),
              eq(firmOrder.orderId, orderRecord.id),
              eq(firmOrder.firmId, allocation.firmId),
            ),
          );
      }

      return syncParentOrderPaymentStatus(tx, orderRecord.id);
    });

    return NextResponse.json({
      success: true,
      parentPaymentStatus: parentStatus,
      message:
        action === "approve"
          ? `UTR for Order #${orderRecord.orderNumber} approved for this allocation.`
          : `UTR submission for Order #${orderRecord.orderNumber} has been rejected.`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALLOCATION_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "This UTR is not linked to a firm allocation and cannot be approved.",
        },
        { status: 400 },
      );
    }

    if (err instanceof Error && err.message === "ALLOCATION_MISSING") {
      return NextResponse.json(
        { error: "Firm allocation not found for this UTR." },
        { status: 404 },
      );
    }

    if (err instanceof Error && err.message === "FIRM_NOT_ALLOWED") {
      return NextResponse.json(
        { error: "This allocation is not assigned to a valid fulfillment firm." },
        { status: 400 },
      );
    }

    console.error("Failed to update payment submission:", err);
    return NextResponse.json(
      { error: "Failed to process payment review." },
      { status: 500 },
    );
  }
}
