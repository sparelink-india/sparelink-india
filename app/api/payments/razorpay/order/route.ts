import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { order, payment } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session || session.user.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Online payments are not configured yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.orderId !== "string" || !body.orderId) {
    return NextResponse.json(
      { error: "orderId is required." },
      { status: 400 },
    );
  }

  const db = getDb();
  const buyerOrder = await db.query.order.findFirst({
    where: and(eq(order.id, body.orderId), eq(order.buyerId, session.user.id)),
  });
  if (!buyerOrder || buyerOrder.paymentMethod !== "razorpay") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (
    buyerOrder.paymentStatus === "paid" ||
    buyerOrder.paymentStatus === "authorized"
  ) {
    return NextResponse.json(
      { error: "This order has already been paid." },
      { status: 409 },
    );
  }

  const existingPayment = await db.query.payment.findFirst({
    where: eq(payment.orderId, buyerOrder.id),
  });
  if (existingPayment) {
    return NextResponse.json({
      keyId: env.RAZORPAY_KEY_ID,
      providerOrderId: existingPayment.providerOrderId,
      amountPaise: existingPayment.amountPaise,
      currency: existingPayment.currency,
      orderNumber: buyerOrder.orderNumber,
      buyerName: session.user.name,
      buyerEmail: session.user.email,
      buyerPhone: buyerOrder.shippingPhone,
    });
  }

  try {
    const razorpayOrder = await createRazorpayOrder(
      buyerOrder.totalPaise,
      buyerOrder.orderNumber,
    );
    await db.insert(payment).values({
      id: randomUUID(),
      orderId: buyerOrder.id,
      provider: "razorpay",
      providerOrderId: razorpayOrder.id,
      amountPaise: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
    return NextResponse.json({
      keyId: env.RAZORPAY_KEY_ID,
      providerOrderId: razorpayOrder.id,
      amountPaise: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderNumber: buyerOrder.orderNumber,
      buyerName: session.user.name,
      buyerEmail: session.user.email,
      buyerPhone: buyerOrder.shippingPhone,
    });
  } catch (error) {
    console.error("Unable to create Razorpay payment", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to start payment.",
      },
      { status: 502 },
    );
  }
}
