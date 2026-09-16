import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { firmOrder, payment } from "@/drizzle/schema";
import { syncParentOrderPaymentStatus } from "@/lib/payment-rollup";
import {
  extractCashfreeWebhookPayment,
  credentialsBelongToFirm,
  getCashfreeCredentialsForFirm,
  getCashfreeWebhookSigningSecret,
  verifyCashfreeWebhookSignature,
  type SpareLinkPaymentStatus,
} from "@/lib/cashfree";
import { getDb } from "@/lib/db";
import { isAllowedFirmId } from "@/lib/firms";

function ok(extra?: Record<string, unknown>) {
  return NextResponse.json({ received: true, ...extra });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-webhook-signature")?.trim() ?? "";

  if (!rawBody || !timestamp || !signature) {
    return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const extracted = extractCashfreeWebhookPayment(payload);
  if (!extracted) {
    console.error("Cashfree webhook missing provider order id");
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const db = getDb();

  try {
    const paymentRecord = await db.query.payment.findFirst({
      where: and(
        eq(payment.providerOrderId, extracted.providerOrderId),
        eq(payment.provider, "cashfree"),
      ),
    });

    if (!paymentRecord) {
      console.error("Cashfree webhook unknown provider order", {
        providerOrderId: extracted.providerOrderId,
      });
      return ok({ ignored: true });
    }

    if (!isAllowedFirmId(paymentRecord.firmId)) {
      console.error("Cashfree webhook firm not allowlisted", {
        paymentId: paymentRecord.id,
      });
      return NextResponse.json({ error: "Invalid webhook." }, { status: 403 });
    }

    const credentials = getCashfreeCredentialsForFirm(paymentRecord.firmId);
    if (!credentialsBelongToFirm(credentials, paymentRecord.firmId)) {
      console.error("Cashfree webhook missing firm credentials", {
        firmCode: paymentRecord.firmId,
        paymentId: paymentRecord.id,
      });
      return NextResponse.json(
        { error: "Payment webhook is not configured." },
        { status: 503 },
      );
    }

    const validSignature = verifyCashfreeWebhookSignature(
      rawBody,
      timestamp,
      signature,
      getCashfreeWebhookSigningSecret(credentials),
    );

    if (!validSignature) {
      console.error("Cashfree webhook signature rejected", {
        paymentId: paymentRecord.id,
        firmCode: credentials.firmCode,
      });
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    if (extracted.providerOrderId !== paymentRecord.providerOrderId) {
      console.error("Cashfree webhook provider order mismatch", {
        paymentId: paymentRecord.id,
      });
      return NextResponse.json({ error: "Invalid webhook." }, { status: 409 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      const paymentRows = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, paymentRecord.id))
        .for("update");
      const lockedPayment = paymentRows[0];
      if (!lockedPayment) {
        return;
      }

      if (lockedPayment.status === "paid") {
        await syncParentOrderPaymentStatus(tx, lockedPayment.orderId);
        return;
      }

      if (
        lockedPayment.providerOrderId !== extracted.providerOrderId ||
        lockedPayment.firmId !== paymentRecord.firmId ||
        lockedPayment.firmOrderId !== paymentRecord.firmOrderId
      ) {
        throw new Error("WEBHOOK_GUARD");
      }

      const allocationRows = await tx
        .select()
        .from(firmOrder)
        .where(eq(firmOrder.id, lockedPayment.firmOrderId))
        .for("update");
      const allocation = allocationRows[0];
      if (!allocation || allocation.firmId !== lockedPayment.firmId) {
        throw new Error("WEBHOOK_GUARD");
      }

      const mapped: SpareLinkPaymentStatus = extracted.mappedStatus;

      if (mapped === "paid") {
        if (
          extracted.amountPaise === null ||
          extracted.amountPaise !== lockedPayment.amountPaise ||
          lockedPayment.amountPaise !== allocation.amountPaise
        ) {
          console.error("Cashfree webhook amount rejected", {
            paymentId: lockedPayment.id,
            firmCode: credentials.firmCode,
            expectedPaise: lockedPayment.amountPaise,
          });
          return;
        }

        if (extracted.currency && extracted.currency !== "INR") {
          console.error("Cashfree webhook currency rejected", {
            paymentId: lockedPayment.id,
            firmCode: credentials.firmCode,
          });
          return;
        }

        await tx
          .update(payment)
          .set({
            status: "paid",
            gatewayStatus: extracted.gatewayStatus,
            ...(extracted.providerPaymentId && !lockedPayment.providerPaymentId
              ? { providerPaymentId: extracted.providerPaymentId }
              : {}),
            paidAt: lockedPayment.paidAt ?? now,
            failedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(payment.id, lockedPayment.id),
              eq(payment.firmOrderId, lockedPayment.firmOrderId),
              eq(payment.firmId, lockedPayment.firmId),
              eq(payment.providerOrderId, extracted.providerOrderId),
              eq(payment.amountPaise, lockedPayment.amountPaise),
            ),
          );

        await tx
          .update(firmOrder)
          .set({
            paymentStatus: "paid",
            updatedAt: now,
          })
          .where(
            and(
              eq(firmOrder.id, lockedPayment.firmOrderId),
              eq(firmOrder.firmId, lockedPayment.firmId),
            ),
          );

        await syncParentOrderPaymentStatus(tx, lockedPayment.orderId);

        console.info("Cashfree webhook marked paid", {
          paymentId: lockedPayment.id,
          firmCode: credentials.firmCode,
          providerOrderId: extracted.providerOrderId,
        });
        return;
      }

      const failedAt =
        mapped === "failed" || mapped === "expired" || mapped === "user_dropped"
          ? now
          : null;

      await tx
        .update(payment)
        .set({
          status: mapped,
          gatewayStatus: extracted.gatewayStatus,
          failedAt,
          updatedAt: now,
        })
        .where(eq(payment.id, lockedPayment.id));

      console.info("Cashfree webhook updated", {
        paymentId: lockedPayment.id,
        firmCode: credentials.firmCode,
        status: mapped,
      });
    });

    return ok();
  } catch (error) {
    if (error instanceof Error && error.message === "WEBHOOK_GUARD") {
      return NextResponse.json({ error: "Invalid webhook." }, { status: 409 });
    }

    console.error("Cashfree webhook processing failed", {
      providerOrderId: extracted.providerOrderId,
    });
    return NextResponse.json(
      { error: "Unable to process webhook." },
      { status: 500 },
    );
  }
}
