import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  firmOrder,
  manualPaymentSubmission,
  order,
  payment,
  user,
} from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import {
  ACTIVE_CASHFREE_PAYMENT_STATUSES,
  CashfreeRequestError,
  RETRYABLE_CASHFREE_PAYMENT_STATUSES,
  buildCashfreeOrderId,
  buildCashfreeReturnUrl,
  createCashfreeOrder,
  credentialsBelongToFirm,
  getCashfreeConfig,
  getCashfreeCredentialsForFirm,
  toCashfreeCustomerPhone,
} from "@/lib/cashfree";
import { getDb } from "@/lib/db";
import { isAllowedFirmId } from "@/lib/firms";
import { canAccessCustomerOrder } from "@/lib/order-architecture";
import { denyIfMustChangePassword } from "@/lib/require-role";
import {
  canAcceptPaymentForAllocationStatus,
  canAcceptPaymentForOrderStatus,
  isCashfreePaymentMethod,
} from "@/lib/payment-security";

function publicCreateResponse(
  paymentSessionId: string,
  providerOrderId: string,
) {
  return {
    paymentSessionId,
    cashfreeEnvironment: getCashfreeConfig().environment,
    providerOrderId,
  };
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session || session.user.role === "suspended") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const orderId =
    typeof body?.orderId === "string" ? body.orderId.trim() : "";
  const firmOrderId =
    typeof body?.firmOrderId === "string" ? body.firmOrderId.trim() : "";

  if (!orderId || !firmOrderId) {
    return NextResponse.json(
      { error: "orderId and firmOrderId are required." },
      { status: 400 },
    );
  }

  const db = getDb();
  let localPaymentId: string | null = null;

  try {
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

    if (!canAcceptPaymentForOrderStatus(orderRecord.status)) {
      return NextResponse.json(
        { error: "This order cannot accept payment." },
        { status: 400 },
      );
    }

    if (!isCashfreePaymentMethod(orderRecord.paymentMethod)) {
      return NextResponse.json(
        { error: "Online payment is only available for online payment orders." },
        { status: 400 },
      );
    }

    const paymentId = randomUUID();
    localPaymentId = paymentId;
    const providerOrderId = buildCashfreeOrderId(firmOrderId);

    const reused = await db.transaction(async (tx) => {
      const parentRows = await tx
        .select()
        .from(order)
        .where(eq(order.id, orderRecord.id))
        .for("update");
      const lockedParent = parentRows[0];
      if (
        !lockedParent ||
        !isCashfreePaymentMethod(lockedParent.paymentMethod) ||
        !canAcceptPaymentForOrderStatus(lockedParent.status)
      ) {
        return {
          error: "This order cannot accept online payment.",
          status: 409 as const,
        };
      }

      const allocations = await tx
        .select()
        .from(firmOrder)
        .where(eq(firmOrder.id, firmOrderId))
        .for("update");
      const allocation = allocations[0];

      if (!allocation || allocation.orderId !== orderRecord.id) {
        return { error: "Firm allocation not found for this order.", status: 404 as const };
      }

      if (!isAllowedFirmId(allocation.firmId)) {
        return {
          error: "This allocation is not assigned to a valid fulfillment firm.",
          status: 400 as const,
        };
      }

      if (!canAcceptPaymentForAllocationStatus(allocation.fulfillmentStatus)) {
        return {
          error: "This allocation cannot accept payment.",
          status: 400 as const,
        };
      }

      if (!isCashfreePaymentMethod(allocation.paymentMethod)) {
        return {
          error: "This allocation is not configured for online payment.",
          status: 400 as const,
        };
      }

      if (allocation.amountPaise <= 0) {
        return { error: "This allocation has an invalid amount.", status: 400 as const };
      }

      if (allocation.paymentStatus === "paid") {
        return {
          error: "This firm allocation has already been paid.",
          status: 409 as const,
        };
      }

      if (!getCashfreeCredentialsForFirm(allocation.firmId)) {
        return {
          error: "Online payment is not configured for this firm.",
          status: 503 as const,
        };
      }

      const existingRows = await tx
        .select()
        .from(payment)
        .where(
          and(
            eq(payment.firmOrderId, allocation.id),
            eq(payment.orderId, orderRecord.id),
          ),
        )
        .for("update");
      const existing = existingRows[0];

      if (existing?.status === "paid") {
        return {
          error: "This firm allocation has already been paid.",
          status: 409 as const,
        };
      }

      const pendingManual = await tx
        .select({ id: manualPaymentSubmission.id })
        .from(manualPaymentSubmission)
        .where(
          and(
            eq(manualPaymentSubmission.firmOrderId, allocation.id),
            eq(manualPaymentSubmission.status, "submitted"),
          ),
        )
        .limit(1);
      if (pendingManual.length) {
        return {
          error: "A bank transfer submission is already awaiting review.",
          status: 409 as const,
        };
      }

      if (
        existing &&
        ACTIVE_CASHFREE_PAYMENT_STATUSES.includes(
          existing.status as (typeof ACTIVE_CASHFREE_PAYMENT_STATUSES)[number],
        ) &&
        existing.provider === "cashfree" &&
        existing.paymentSessionId
      ) {
        return {
          reuse: {
            paymentSessionId: existing.paymentSessionId,
            providerOrderId: existing.providerOrderId,
          },
        };
      }

      if (!existing) {
        await tx.insert(payment).values({
          id: paymentId,
          orderId: orderRecord.id,
          firmOrderId: allocation.id,
          firmId: allocation.firmId,
          provider: "cashfree",
          providerOrderId,
          amountPaise: allocation.amountPaise,
          currency: "INR",
          status: "created",
          idempotencyKey: `cashfree:${allocation.id}:${providerOrderId}`,
        });
        return { allocation, existing: null };
      }

      if (existing.status === "created" && !existing.paymentSessionId) {
        return {
          error: "Online payment creation is already in progress. Please retry shortly.",
          status: 409 as const,
        };
      }

      return { allocation, existing };
    });

    if ("error" in reused && reused.error) {
      return NextResponse.json(
        { error: reused.error },
        { status: reused.status },
      );
    }

    if ("reuse" in reused && reused.reuse) {
      return NextResponse.json(publicCreateResponse(
        reused.reuse.paymentSessionId,
        reused.reuse.providerOrderId,
      ));
    }

    if (!("allocation" in reused) || !reused.allocation) {
      return NextResponse.json(
        { error: "Unable to start payment for this allocation." },
        { status: 400 },
      );
    }

    const allocation = reused.allocation;
    const existing = reused.existing;
    localPaymentId = existing?.id ?? paymentId;

    if (
      existing &&
      !RETRYABLE_CASHFREE_PAYMENT_STATUSES.includes(
        existing.status as (typeof RETRYABLE_CASHFREE_PAYMENT_STATUSES)[number],
      ) &&
      !ACTIVE_CASHFREE_PAYMENT_STATUSES.includes(
        existing.status as (typeof ACTIVE_CASHFREE_PAYMENT_STATUSES)[number],
      )
    ) {
      return NextResponse.json(
        { error: "A payment already exists for this allocation." },
        { status: 409 },
      );
    }

    const credentials = getCashfreeCredentialsForFirm(allocation.firmId);
    if (!credentialsBelongToFirm(credentials, allocation.firmId)) {
      return NextResponse.json(
        { error: "Online payment is not configured for this firm." },
        { status: 503 },
      );
    }

    const buyer = await db.query.user.findFirst({
      where: eq(user.id, orderRecord.buyerId),
    });

    const customerPhone = toCashfreeCustomerPhone(
      buyer?.phoneNumber ?? orderRecord.shippingPhone,
    );
    if (!customerPhone) {
      return NextResponse.json(
        { error: "A valid mobile number is required to start online payment." },
        { status: 400 },
      );
    }

    const customerName = buyer?.name?.trim() || orderRecord.shippingName;
    const customerEmail = buyer?.email?.trim();

    const cashfreeOrder = await createCashfreeOrder(credentials, {
      orderId: providerOrderId,
      amountPaise: allocation.amountPaise,
      returnUrl: buildCashfreeReturnUrl(orderRecord.id, allocation.id),
      orderNote: `SpareLink allocation ${allocation.allocationNumber}`,
      customer: {
        customer_id: orderRecord.buyerId,
        customer_phone: customerPhone,
        ...(customerName ? { customer_name: customerName } : {}),
        ...(customerEmail ? { customer_email: customerEmail } : {}),
      },
    });

    const now = new Date();

    await db.transaction(async (tx) => {
      const parentRows = await tx
        .select()
        .from(order)
        .where(eq(order.id, orderRecord.id))
        .for("update");
      const lockedParent = parentRows[0];
      if (
        !lockedParent ||
        lockedParent.paymentMethod !== "online_payment" ||
        lockedParent.status === "cancelled" ||
        lockedParent.status === "returned"
      ) {
        throw new Error("ORDER_NOT_PAYABLE");
      }

      const allocations = await tx
        .select()
        .from(firmOrder)
        .where(eq(firmOrder.id, allocation.id))
        .for("update");
      const locked = allocations[0];
      if (
        !locked ||
        locked.orderId !== lockedParent.id ||
        locked.paymentMethod !== "online_payment" ||
        locked.fulfillmentStatus === "cancelled" ||
        locked.fulfillmentStatus === "returned" ||
        locked.paymentStatus === "paid"
      ) {
        throw new Error("ALLOCATION_NOT_PAYABLE");
      }

      const currentRows = await tx
        .select()
        .from(payment)
        .where(eq(payment.firmOrderId, allocation.id))
        .for("update");
      const current = currentRows[0];

      if (current?.status === "paid") {
        throw new Error("ALLOCATION_PAID");
      }

      if (
        current &&
        ACTIVE_CASHFREE_PAYMENT_STATUSES.includes(
          current.status as (typeof ACTIVE_CASHFREE_PAYMENT_STATUSES)[number],
        ) &&
        current.paymentSessionId
      ) {
        throw new Error(`REUSE:${current.paymentSessionId}:${current.providerOrderId}`);
      }

      const values = {
        orderId: orderRecord.id,
        firmOrderId: allocation.id,
        firmId: allocation.firmId,
        provider: "cashfree",
        providerOrderId: cashfreeOrder.orderId,
        amountPaise: allocation.amountPaise,
        currency: "INR",
        status: "created",
        paymentSessionId: cashfreeOrder.paymentSessionId,
        gatewayStatus: cashfreeOrder.orderStatus,
        idempotencyKey: `cashfree:${allocation.id}:${cashfreeOrder.orderId}`,
        paidAt: null,
        failedAt: null,
        updatedAt: now,
      };

      if (current) {
        await tx
          .update(payment)
          .set(values)
          .where(eq(payment.id, current.id));
      } else {
        await tx.insert(payment).values({
          id: paymentId,
          ...values,
        });
      }

      await tx
        .update(firmOrder)
        .set({
          paymentStatus: "pending",
          updatedAt: now,
        })
        .where(eq(firmOrder.id, allocation.id));
    });

    return NextResponse.json(
      publicCreateResponse(
        cashfreeOrder.paymentSessionId ?? "",
        cashfreeOrder.orderId,
      ),
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REUSE:")) {
      const [, sessionId, providerOrderId] = error.message.split(":");
      return NextResponse.json(publicCreateResponse(sessionId, providerOrderId));
    }

    if (error instanceof Error && error.message === "ALLOCATION_PAID") {
      return NextResponse.json(
        { error: "This firm allocation has already been paid." },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      (error.message === "ORDER_NOT_PAYABLE" ||
        error.message === "ALLOCATION_NOT_PAYABLE")
    ) {
      await db
        .update(payment)
        .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(payment.id, localPaymentId ?? ""),
            eq(payment.status, "created"),
            isNull(payment.paymentSessionId),
          ),
        );
      return NextResponse.json(
        { error: "This order or allocation can no longer accept payment." },
        { status: 409 },
      );
    }

    await db
      .update(payment)
      .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(payment.id, localPaymentId ?? ""),
          eq(payment.status, "created"),
          isNull(payment.paymentSessionId),
        ),
      );

    if (error instanceof CashfreeRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.httpStatus >= 500 ? 502 : 400 },
      );
    }

    console.error("Cashfree order create failed", {
      orderId,
      firmOrderId,
    });
    return NextResponse.json(
      { error: "Unable to start online payment. Please try again." },
      { status: 500 },
    );
  }
}
