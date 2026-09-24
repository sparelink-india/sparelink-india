import { and, eq, ne } from "drizzle-orm";
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
import { canAccessCustomerOrder } from "@/lib/order-architecture";
import { denyIfMustChangePassword } from "@/lib/require-role";
import {
  canAcceptPaymentForAllocationStatus,
  canAcceptPaymentForOrderStatus,
  isCashfreePaymentMethod,
} from "@/lib/payment-security";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role === "suspended") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

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
      !canAccessCustomerOrder(
        { role: session.user.role, id: session.user.id },
        orderRecord.buyerId,
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isCashfreePaymentMethod(orderRecord.paymentMethod)) {
      return NextResponse.json(
        { error: "This order does not use online payment." },
        { status: 409 },
      );
    }

    if (!canAcceptPaymentForOrderStatus(orderRecord.status)) {
      return NextResponse.json(
        { error: "This order cannot accept payment." },
        { status: 409 },
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
        { error: "This allocation is not assigned to a valid fulfillment firm." },
        { status: 400 },
      );
    }

    if (
      !isCashfreePaymentMethod(allocation.paymentMethod) ||
      !canAcceptPaymentForAllocationStatus(allocation.fulfillmentStatus)
    ) {
      return NextResponse.json(
        { error: "This allocation cannot accept online payment." },
        { status: 409 },
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

    if (allocation.paymentStatus === "paid") {
      return NextResponse.json({
        status: "paid",
        gatewayStatus: paymentRecord.gatewayStatus,
        providerOrderId: paymentRecord.providerOrderId,
        firmOrderPaymentStatus: "paid",
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
      if (paymentRecord.currency !== "INR") {
        return NextResponse.json(
          { error: "Payment currency could not be verified." },
          { status: 409 },
        );
      }

      if (
        gatewayOrder.orderAmountPaise === null ||
        gatewayOrder.orderAmountPaise !== paymentRecord.amountPaise ||
        paymentRecord.amountPaise !== allocation.amountPaise
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

      if (gatewayOrder.orderCurrency !== "INR") {
        return NextResponse.json(
          { error: "Payment currency could not be verified." },
          { status: 409 },
        );
      }

      const applied = await db.transaction(async (tx) => {
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
          lockedAllocation.orderId !== lockedParent.id ||
          lockedAllocation.amountPaise !== paymentRecord.amountPaise ||
          !isCashfreePaymentMethod(lockedAllocation.paymentMethod) ||
          !canAcceptPaymentForAllocationStatus(lockedAllocation.fulfillmentStatus)
        ) {
          throw new Error("ALLOCATION_NOT_PAYABLE");
        }

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
            ne(firmOrder.paymentStatus, "paid"),
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
    if (
      error instanceof Error &&
      (error.message === "ORDER_NOT_PAYABLE" ||
        error.message === "ALLOCATION_NOT_PAYABLE")
    ) {
      return NextResponse.json(
        { error: "This order or allocation can no longer accept payment." },
        { status: 409 },
      );
    }

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
