import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { firmOrder, order, payment, user } from "@/drizzle/schema";
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

  try {
    const orderRecord = await db.query.order.findFirst({
      where: eq(order.id, orderId),
    });

    if (!orderRecord) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (
      session.user.role !== "admin" &&
      orderRecord.buyerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (orderRecord.status === "cancelled") {
      return NextResponse.json(
        { error: "This order cannot accept payment." },
        { status: 400 },
      );
    }

    if (orderRecord.paymentMethod === "cash_on_delivery") {
      return NextResponse.json(
        { error: "Cash on delivery orders cannot be paid online." },
        { status: 400 },
      );
    }

    const reused = await db.transaction(async (tx) => {
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

      if (allocation.fulfillmentStatus === "cancelled") {
        return {
          error: "This allocation cannot accept payment.",
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

    const providerOrderId = buildCashfreeOrderId(allocation.id);
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

    const paymentId = existing?.id ?? randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      const allocations = await tx
        .select()
        .from(firmOrder)
        .where(eq(firmOrder.id, allocation.id))
        .for("update");
      const locked = allocations[0];
      if (!locked || locked.paymentStatus === "paid") {
        throw new Error("ALLOCATION_PAID");
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
