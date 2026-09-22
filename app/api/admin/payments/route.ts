import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  firm,
  firmOrder,
  manualPaymentSubmission,
  order,
  payment,
  user,
} from "@/drizzle/schema";
import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getDb();

  try {
    const orders = await db
      .select({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalPaise: order.totalPaise,
        createdAt: order.createdAt,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        buyerName: user.name,
        buyerEmail: user.email,
        buyerPhone: user.phoneNumber,
      })
      .from(order)
      .innerJoin(user, eq(order.buyerId, user.id))
      .orderBy(desc(order.createdAt));

    if (!orders.length) {
      return NextResponse.json({ orders: [] });
    }

    const orderIds = orders.map((item) => item.id);

    const allocations = await db
      .select({
        firmOrderId: firmOrder.id,
        orderId: firmOrder.orderId,
        firmId: firmOrder.firmId,
        firmName: firm.name,
        firmCode: firm.code,
        allocationNumber: firmOrder.allocationNumber,
        amountPaise: firmOrder.amountPaise,
        paymentStatus: firmOrder.paymentStatus,
      })
      .from(firmOrder)
      .innerJoin(firm, eq(firmOrder.firmId, firm.id))
      .where(inArray(firmOrder.orderId, orderIds));

    const payments = await db
      .select({
        firmOrderId: payment.firmOrderId,
        orderId: payment.orderId,
        firmId: payment.firmId,
        provider: payment.provider,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        amountPaise: payment.amountPaise,
        status: payment.status,
        gatewayStatus: payment.gatewayStatus,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
      })
      .from(payment)
      .where(inArray(payment.orderId, orderIds));

    const submissions = await db
      .select({
        id: manualPaymentSubmission.id,
        orderId: manualPaymentSubmission.orderId,
        firmOrderId: manualPaymentSubmission.firmOrderId,
        firmId: manualPaymentSubmission.firmId,
        amountPaise: manualPaymentSubmission.amountPaise,
        utrReference: manualPaymentSubmission.utrReference,
        status: manualPaymentSubmission.status,
        paymentDate: manualPaymentSubmission.paymentDate,
        createdAt: manualPaymentSubmission.createdAt,
        adminNote: manualPaymentSubmission.adminNote,
      })
      .from(manualPaymentSubmission)
      .where(inArray(manualPaymentSubmission.orderId, orderIds))
      .orderBy(desc(manualPaymentSubmission.createdAt));

    const paymentsByAllocation = new Map<string, (typeof payments)[number]>();
    for (const row of payments) {
      paymentsByAllocation.set(row.firmOrderId, row);
    }

    const submissionsByAllocation = new Map<string, typeof submissions>();
    for (const row of submissions) {
      const key = row.firmOrderId ?? `order:${row.orderId}`;
      const list = submissionsByAllocation.get(key) ?? [];
      list.push(row);
      submissionsByAllocation.set(key, list);
    }

    const allocationsByOrder = new Map<string, typeof allocations>();
    for (const row of allocations) {
      const list = allocationsByOrder.get(row.orderId) ?? [];
      list.push(row);
      allocationsByOrder.set(row.orderId, list);
    }

    return NextResponse.json({
      orders: orders.map((item) => ({
        ...item,
        allocations: (allocationsByOrder.get(item.id) ?? []).map(
          (allocation) => {
            const gateway = paymentsByAllocation.get(allocation.firmOrderId);
            return {
              firmOrderId: allocation.firmOrderId,
              firmId: allocation.firmId,
              firmName: allocation.firmName,
              firmCode: allocation.firmCode,
              allocationNumber: allocation.allocationNumber,
              amountPaise: allocation.amountPaise,
              paymentStatus: allocation.paymentStatus,
              gatewayPayment: gateway
                ? {
                    provider: gateway.provider,
                    providerOrderId: gateway.providerOrderId,
                    providerPaymentId: gateway.providerPaymentId,
                    amountPaise: gateway.amountPaise,
                    status: gateway.status,
                    gatewayStatus: gateway.gatewayStatus,
                    paidAt: gateway.paidAt,
                    failedAt: gateway.failedAt,
                  }
                : null,
              manualSubmissions:
                submissionsByAllocation.get(allocation.firmOrderId) ?? [],
            };
          },
        ),
      })),
    });
  } catch (error) {
    console.error("Failed to load admin payment overview:", error);
    return NextResponse.json(
      { error: "Failed to load payment overview." },
      { status: 500 },
    );
  }
}
