"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type PaymentOrder = {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  paymentMethod: string;
};

function parentPaymentLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partially Paid";
  return "Pending";
}

export default function OrderConfirmationPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<PaymentOrder | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/orders/${id}/payment`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.order) {
          setOrder(data.order);
        }
      })
      .catch(() => {
        setOrder(null);
      });
  }, [id]);

  const needsPayment =
    order &&
    order.paymentMethod !== "cash_on_delivery" &&
    order.paymentStatus !== "paid";

  return (
    <main className="min-h-screen bg-slate-50/80 px-4 py-16 text-slate-900 sm:px-6 sm:py-24">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-700">
          Order Successfully Placed
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Thank you for your order!
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          Your order{" "}
          {order?.orderNumber ? (
            <strong className="font-mono font-bold text-slate-900">
              #{order.orderNumber}
            </strong>
          ) : (
            ""
          )}{" "}
          has been received and allocated to regional fulfillment partners.
        </p>

        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 space-y-1.5 text-left">
          <div className="flex justify-between">
            <span>Order Reference:</span>
            <span className="font-mono text-slate-700">{id}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment status:</span>
            <span className="text-slate-900 font-medium">
              {order
                ? parentPaymentLabel(order.paymentStatus)
                : "Confirming from SpareLink..."}
            </span>
          </div>
          <div className="flex justify-between">
            <span>GST Tax Invoice:</span>
            <span className="text-slate-900 font-medium">Ready for Download</span>
          </div>
        </div>

        {needsPayment && (
          <Link
            href={`/orders/${id}/payment`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
          >
            {order.paymentStatus === "partial"
              ? "Complete remaining payment"
              : "Pay now"}
          </Link>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <a
            href={`/api/orders/${id}/invoice`}
            target="_blank"
            rel="noreferrer"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <span>📄</span> Download PDF
          </a>
          <a
            href={`/api/orders/${id}/excel`}
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100 transition-colors"
          >
            <span>📊</span> Download Excel
          </a>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center border-t border-slate-100 pt-6">
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
          >
            View My Orders →
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Continue Shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
