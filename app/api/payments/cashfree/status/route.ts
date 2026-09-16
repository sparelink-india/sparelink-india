import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { firmOrder, order, payment } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import {
  CashfreeRequestError,
  credentialsBelongToFirm,
  getCashfreeCredentialsForFirm,
  getCashfreeOrder,
  mapCashfreeOrderStatus,
  type SpareLinkPaymentStatus,
} from "@/lib/cashfree";
import { getDb } from "@/lib/db";
import { isAllowedFirmId } from "@/lib/firms";
import { syncParentOrderPaymentStatus } from "@/lib/payment-rollup";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = request.nextUrl.searchParams.get("orderId")?.trim() ?? "";
  const firmOrderId =
    request.nextUrl.searchParams.get("firmOrderId")?.trim() ?? "";

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
        { error: "This allocation is not assigned to a valid fulfillment firm." },
        { status: 400 },
      );
    }

    const paymentRecord = await db.query.payment.findFirst({
      where: and(
        eq(payment.firmOrderId, allocation.id),
        eq(payment.orderId, orderRecord.id),
        eq(payment.provider, "cashfree"),
      ),
    });

    if (!paymentRecord) {
      return NextResponse.json({
        status: allocation.paymentStatus === "paid" ? "paid" : "unpaid",
        firmOrderPaymentStatus: allocation.paymentStatus,
      });
    }

    if (paymentRecord.status === "paid") {
      return NextResponse.json({
        status: "paid",
        gatewayStatus: paymentRecord.gatewayStatus,
        providerOrderId: paymentRecord.providerOrderId,
        firmOrderPaymentStatus: "paid",
      });
    }

    const credentials = getCashfreeCredentialsForFirm(allocation.firmId);
    if (!credentialsBelongToFirm(credentials, allocation.firmId)) {
      return NextResponse.json(
        { error: "Online payment is not configured for this firm." },
        { status: 503 },
      );
    }

    const gatewayOrder = await getCashfreeOrder(
      credentials,
      paymentRecord.providerOrderId,
    );

    if (gatewayOrder.orderId !== paymentRecord.providerOrderId) {
      console.error("Cashfree provider order mismatch", {
        firmOrderId: allocation.id,
      });
      return NextResponse.json(
        { error: "Payment reference could not be verified." },
        { status: 409 },
      );
    }

    const mapped = mapCashfreeOrderStatus(gatewayOrder.orderStatus);
    const now = new Date();

    if (mapped === "paid") {
      if (
        gatewayOrder.orderAmountPaise === null ||
        gatewayOrder.orderAmountPaise !== paymentRecord.amountPaise ||
        paymentRecord.amountPaise !== allocation.amountPaise
      ) {
        if (
          gatewayOrder.orderAmountPaise !== null &&
          gatewayOrder.orderAmountPaise !== paymentRecord.amountPaise
        ) {
          console.error("Cashfree amount mismatch", {
            firmOrderId: allocation.id,
            expectedPaise: paymentRecord.amountPaise,
          });
          return NextResponse.json(
            { error: "Payment amount could not be verified." },
            { status: 409 },
          );
        }

        return NextResponse.json({
          status: "pending",
          gatewayStatus: gatewayOrder.orderStatus,
          providerOrderId: paymentRecord.providerOrderId,
          firmOrderPaymentStatus: allocation.paymentStatus,
        });
      }

      if (
        gatewayOrder.orderCurrency &&
        gatewayOrder.orderCurrency !== "INR"
      ) {
        return NextResponse.json(
          { error: "Payment currency could not be verified." },
          { status: 409 },
        );
      }

      const applied = await db.transaction(async (tx) => {
        const paymentRows = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, paymentRecord.id))
          .for("update");
        const lockedPayment = paymentRows[0];
        if (!lockedPayment) {
          return null;
        }

        if (lockedPayment.status === "paid") {
          await syncParentOrderPaymentStatus(tx, orderRecord.id);
          return "paid" as SpareLinkPaymentStatus;
        }

        if (
          lockedPayment.firmOrderId !== allocation.id ||
          lockedPayment.firmId !== allocation.firmId ||
          lockedPayment.providerOrderId !== gatewayOrder.orderId ||
          lockedPayment.amountPaise !== paymentRecord.amountPaise
        ) {
          throw new Error("PAYMENT_GUARD");
        }

        const updated = await tx
          .update(payment)
          .set({
            status: "paid",
            gatewayStatus: gatewayOrder.orderStatus,
            paidAt: now,
            failedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(payment.id, lockedPayment.id),
              eq(payment.firmOrderId, allocation.id),
              eq(payment.firmId, allocation.firmId),
              eq(payment.providerOrderId, gatewayOrder.orderId),
              eq(payment.amountPaise, paymentRecord.amountPaise),
            ),
          )
          .returning({ id: payment.id });

        if (!updated.length) {
          throw new Error("PAYMENT_GUARD");
        }

        await tx
          .update(firmOrder)
          .set({
            paymentStatus: "paid",
            updatedAt: now,
          })
          .where(
            and(
              eq(firmOrder.id, allocation.id),
              eq(firmOrder.orderId, orderRecord.id),
              eq(firmOrder.firmId, allocation.firmId),
            ),
          );

        await syncParentOrderPaymentStatus(tx, orderRecord.id);

        return "paid" as SpareLinkPaymentStatus;
      });

      return NextResponse.json({
        status: applied ?? "paid",
        gatewayStatus: gatewayOrder.orderStatus,
        providerOrderId: paymentRecord.providerOrderId,
        firmOrderPaymentStatus: "paid",
      });
    }

    const failedAt =
      mapped === "failed" || mapped === "expired" || mapped === "user_dropped"
        ? now
        : null;

    await db
      .update(payment)
      .set({
        status: mapped,
        gatewayStatus: gatewayOrder.orderStatus,
        failedAt,
        updatedAt: now,
      })
      .where(
        and(eq(payment.id, paymentRecord.id), eq(payment.status, paymentRecord.status)),
      );

    if (mapped !== "pending" && mapped !== "created") {
      await db
        .update(firmOrder)
        .set({
          paymentStatus: mapped,
          updatedAt: now,
        })
        .where(
          and(
            eq(firmOrder.id, allocation.id),
            eq(firmOrder.orderId, orderRecord.id),
          ),
        );
    }

    return NextResponse.json({
      status: mapped,
      gatewayStatus: gatewayOrder.orderStatus,
      providerOrderId: paymentRecord.providerOrderId,
      firmOrderPaymentStatus:
        mapped === "pending" || mapped === "created"
          ? "pending"
          : mapped,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_GUARD") {
      return NextResponse.json(
        { error: "Payment could not be updated safely." },
        { status: 409 },
      );
    }

    if (error instanceof CashfreeRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.httpStatus >= 500 ? 502 : 400 },
      );
    }

    console.error("Cashfree status check failed", { orderId, firmOrderId });
    return NextResponse.json(
      { error: "Unable to verify payment status. Please try again." },
      { status: 500 },
    );
  }
}
