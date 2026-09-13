import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { order, payment } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: "Online payments are not configured yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const providerOrderId = body?.razorpay_order_id;
  const providerPaymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;
  if (
    [providerOrderId, providerPaymentId, signature].some(
      (value) => typeof value !== "string" || !value,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid payment confirmation." },
      { status: 400 },
    );
  }

  const db = getDb();
  const paymentRecord = await db.query.payment.findFirst({
    where: and(
      eq(payment.provider, "razorpay"),
      eq(payment.providerOrderId, providerOrderId),
    ),
  });
  if (!paymentRecord) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const buyerOrder = await db.query.order.findFirst({
    where: and(
      eq(order.id, paymentRecord.orderId),
      eq(order.buyerId, session.user.id),
    ),
  });
  if (!buyerOrder) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${paymentRecord.providerOrderId}|${providerPaymentId}`)
    .digest("hex");
  const valid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  if (!valid) {
    return NextResponse.json(
      { error: "Payment signature verification failed." },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payment)
      .set({ status: "authorized", providerPaymentId, updatedAt: new Date() })
      .where(eq(payment.id, paymentRecord.id));
    await tx
      .update(order)
      .set({
        status: "payment_authorized",
        paymentStatus: "authorized",
        updatedAt: new Date(),
      })
      .where(eq(order.id, buyerOrder.id));
  });
  return NextResponse.json({
    ok: true,
    orderId: buyerOrder.id,
    orderNumber: buyerOrder.orderNumber,
  });
}
