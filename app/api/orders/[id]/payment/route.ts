import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getServerSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import {
  order,
  manualPaymentSubmission,
  orderItem,
  payment,
  firm,
  firmOrder,
} from "@/drizzle/schema";
import {
  getBankPaymentConfig,
  getFirmBankPaymentConfig,
} from "@/lib/bank-payment-config";
import { isCashfreeConfiguredForFirm, ACTIVE_CASHFREE_PAYMENT_STATUSES } from "@/lib/cashfree";
import { isAllowedFirmId } from "@/lib/firms";
import { canAccessCustomerOrder } from "@/lib/order-architecture";
import { denyIfMustChangePassword } from "@/lib/require-role";
import { isBankTransferPaymentMethod } from "@/lib/payment-security";

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
       paymentMethod: firmOrder.paymentMethod,
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
      shippingName: orderRecord.shippingName,
      shippingPhone: orderRecord.shippingPhone,
      shippingAddressLine1: orderRecord.shippingAddressLine1,
      shippingAddressLine2: orderRecord.shippingAddressLine2,
      shippingCity: orderRecord.shippingCity,
      shippingState: orderRecord.shippingState,
      shippingPincode: orderRecord.shippingPincode,
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

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const { id: orderId } = await params;
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

  if (!isBankTransferPaymentMethod(orderRecord.paymentMethod)) {
    return NextResponse.json(
      { error: "UTR submission is only available for bank transfer orders." },
      { status: 400 },
    );
  }

  if (
    orderRecord.status === "cancelled" ||
    orderRecord.status === "returned" ||
    orderRecord.paymentStatus === "paid"
  ) {
    return NextResponse.json(
      { error: "This order cannot accept a manual payment submission." },
      { status: 409 },
    );
  }

  try {
    const formData = await request.formData();
    const firmOrderId = formData.get("firmOrderId")?.toString().trim() ?? "";
    const utrReference = formData
      .get("utrReference")
      ?.toString()
      .replace(/\s+/g, "")
      .toUpperCase();
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

    if (
      !isBankTransferPaymentMethod(allocation.paymentMethod) ||
      allocation.fulfillmentStatus === "cancelled"
    ) {
      return NextResponse.json(
        { error: "This allocation does not accept manual bank transfers." },
        { status: 409 },
      );
    }

    const submissionId = randomUUID();

    // Captured from inside the transaction, because the audit row below has to be
    // written after the commit and so cannot read the locked rows. Assigning them
    // once the payable guards have passed means the audit describes exactly what
    // was locked and paid, not what the request asked for.
    let paidOrderNumber = "";
    let paidFirmOrderId = "";
    let paidFirmId = "";
    let paidAmountPaise = 0;

    await db.transaction(async (tx) => {
      const orderRows = await tx
        .select()
        .from(order)
        .where(eq(order.id, orderRecord.id))
        .for("update");
      const lockedOrder = orderRows[0];
      if (
        !lockedOrder ||
        lockedOrder.paymentMethod !== "bank_transfer" ||
        lockedOrder.status === "cancelled" ||
        lockedOrder.status === "returned" ||
        lockedOrder.paymentStatus === "paid"
      ) {
        throw new Error("ORDER_NOT_PAYABLE");
      }

      const allocationRows = await tx
        .select()
        .from(firmOrder)
        .where(eq(firmOrder.id, allocation.id))
        .for("update");
      const lockedAllocation = allocationRows[0];
      if (
        !lockedAllocation ||
        lockedAllocation.orderId !== lockedOrder.id ||
        lockedAllocation.paymentMethod !== "bank_transfer" ||
        lockedAllocation.fulfillmentStatus === "cancelled" ||
        lockedAllocation.fulfillmentStatus === "returned" ||
        lockedAllocation.paymentStatus === "paid"
      ) {
        throw new Error("ALLOCATION_NOT_PAYABLE");
      }

      // Everything below this line writes money-related rows, so capture the
      // identity of what is being paid while the rows are still locked.
      paidOrderNumber = lockedOrder.orderNumber;
      paidFirmOrderId = lockedAllocation.id;
      paidFirmId = lockedAllocation.firmId;
      paidAmountPaise = lockedAllocation.amountPaise;

      const activeCashfree = await tx
        .select({ id: payment.id })
        .from(payment)
        .where(
          and(
            eq(payment.firmOrderId, lockedAllocation.id),
            eq(payment.provider, "cashfree"),
            inArray(payment.status, [...ACTIVE_CASHFREE_PAYMENT_STATUSES]),
          ),
        )
        .limit(1);
      if (activeCashfree.length) {
        throw new Error("ONLINE_PAYMENT_ALREADY_STARTED");
      }

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${utrReference}))`,
      );

      const duplicateUtr = await tx
        .select({ id: manualPaymentSubmission.id })
        .from(manualPaymentSubmission)
        .where(eq(manualPaymentSubmission.utrReference, utrReference))
        .limit(1);
      if (duplicateUtr.length) {
        throw new Error("UTR_ALREADY_USED");
      }

      const pendingSubmission = await tx
        .select({ id: manualPaymentSubmission.id })
        .from(manualPaymentSubmission)
        .where(
          and(
            eq(manualPaymentSubmission.firmOrderId, lockedAllocation.id),
            eq(manualPaymentSubmission.status, "submitted"),
          ),
        )
        .limit(1);
      if (pendingSubmission.length) {
        throw new Error("SUBMISSION_ALREADY_EXISTS");
      }

      await tx.insert(manualPaymentSubmission).values({
        id: submissionId,
        orderId: lockedOrder.id,
        firmOrderId: lockedAllocation.id,
        firmId: lockedAllocation.firmId,
        buyerId: lockedOrder.buyerId,
        amountPaise: lockedAllocation.amountPaise,
        utrReference,
        paymentDate,
        proofFileUrl: null,
        proofFileName: null,
        proofFileType: null,
        status: "submitted",
      });
    });

    // A UTR submission is a claim that money has moved. It is the customer's own
    // assertion about a payment the platform cannot yet see, on a specific firm
    // allocation, and it is the input an admin acts on when marking a firm order
    // paid. It carried no audit record, so the question "who declared this
    // payment, for which firm, and how much" had no answer anywhere in the trail.
    //
    // Recorded after the transaction commits, for the same reason as every other
    // call site: `writeAuditLog` swallows its own errors so an audit-table problem
    // can never reject a customer's payment submission.
    await writeAuditLog({
      actorUserId: session.user.id,
      action: "payment.utr_submitted",
      entityType: "manual_payment_submission",
      entityId: submissionId,
      metadata: {
        orderId: orderRecord.id,
        orderNumber: paidOrderNumber,
        firmOrderId: paidFirmOrderId,
        firmId: paidFirmId,
        amountPaise: paidAmountPaise,
        paymentDate,
        // The UTR reference itself is deliberately NOT recorded. It is a bank
        // instrument reference, the row already carries it for the admin who must
        // reconcile it, and duplicating it into a metadata blob would put a second
        // unredacted copy in a table that has no retention policy.
        utrReferencePresent: true,
      },
    });

    return NextResponse.json({
      success: true,
      submissionId,
      message: "Payment details submitted successfully. Awaiting admin review.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ORDER_NOT_PAYABLE") {
      return NextResponse.json(
        { error: "This order cannot accept a manual payment submission." },
        { status: 409 },
      );
    }
    if (message === "ALLOCATION_NOT_PAYABLE") {
      return NextResponse.json(
        { error: "This firm allocation cannot accept a manual payment." },
        { status: 409 },
      );
    }
    if (message === "ONLINE_PAYMENT_ALREADY_STARTED") {
      return NextResponse.json(
        { error: "Online payment is already in progress for this allocation." },
        { status: 409 },
      );
    }
    if (message === "UTR_ALREADY_USED") {
      return NextResponse.json(
        { error: "This UTR has already been submitted." },
        { status: 409 },
      );
    }
    if (message === "SUBMISSION_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "A payment submission is already awaiting review." },
        { status: 409 },
      );
    }

    console.error("Manual payment submission error:", error);

    return NextResponse.json(
      { error: "Failed to submit payment details. Please try again." },
      { status: 500 },
    );
  }
}
