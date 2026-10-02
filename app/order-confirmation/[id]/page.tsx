"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";

type PaymentOrder = {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  paymentMethod: string;
};

type FirmAllocation = {
  firmOrderId: string;
  firmName: string;
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
  const [firmAllocations, setFirmAllocations] = useState<FirmAllocation[]>([]);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/orders/${id}/payment`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.order) {
          setOrder(data.order);
          const payments = Array.isArray(data.firmPayments)
            ? data.firmPayments
            : [];
          setFirmAllocations(
            payments.map(
              (row: { firmOrderId: string; firmName: string }) => ({
                firmOrderId: row.firmOrderId,
                firmName: row.firmName,
              }),
            ),
          );
        }
      })
      .catch(() => {
        setOrder(null);
        setFirmAllocations([]);
      });
  }, [id]);

  const needsPayment =
    order &&
    order.paymentMethod !== "cash_on_delivery" &&
    order.paymentStatus !== "paid";

  const multiFirm = firmAllocations.length > 1;

  return (
    <main className="min-h-screen bg-[var(--v3-sunk)] px-4 py-16 text-[var(--v3-text)] sm:px-6 sm:py-24">
      <section className="mx-auto max-w-xl rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-8 sm:p-10 text-center ">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-ok-soft)] text-[var(--v3-ok)]">
          <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-[var(--v3-ok)]">
          Order Successfully Placed
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--v3-text)] sm:text-3xl">
          Thank you for your order!
        </h1>

        <p className="mt-3 text-sm text-[var(--v3-text-2)]">
          Your order{" "}
          {order?.orderNumber ? (
            <strong className="font-mono font-bold text-[var(--v3-text)]">
              #{order.orderNumber}
            </strong>
          ) : (
            ""
          )}{" "}
          has been received and allocated to regional fulfillment partners.
        </p>

        <div className="mt-6 rounded-[var(--v3-r)] bg-[var(--v3-sunk)] border border-[var(--v3-rule)] p-4 text-xs text-[var(--v3-text-3)] space-y-1.5 text-left">
          <div className="flex justify-between">
            <span>Order Reference:</span>
            <span className="font-mono text-[var(--v3-text-2)]">{id}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment status:</span>
            <span className="text-[var(--v3-text)] font-medium">
              {order
                ? parentPaymentLabel(order.paymentStatus)
                : "Confirming from SpareLink..."}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>GST Tax Invoice:</span>
            <span className="text-[var(--v3-text)] font-medium text-right">
              {multiFirm
                ? "One invoice per fulfillment firm"
                : "Ready for Download"}
            </span>
          </div>
        </div>

        {needsPayment && (
          <Link
            href={`/orders/${id}/payment`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--v3-brand-hover)]"
          >
            {order.paymentStatus === "partial"
              ? "Complete remaining payment"
              : "Pay now"}
          </Link>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {id ? (
            <InvoiceDownloadLinks
              orderId={id}
              allocations={firmAllocations}
              className="flex flex-wrap items-center justify-center gap-2.5"
              linkClassName="inline-flex items-center gap-1.5 rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] px-3.5 py-2 text-xs font-bold text-[var(--v3-text)] hover:bg-[var(--v3-sunk)] transition-colors"
            />
          ) : null}
          {id ? (
            <a
              href={`/api/orders/${id}/excel`}
              download
              className="inline-flex items-center gap-1.5 rounded-[var(--v3-r)] border border-[var(--v3-ok-line)] bg-[var(--v3-ok-soft)] px-3.5 py-2 text-xs font-bold text-[var(--v3-ok)] hover:bg-[var(--v3-ok-soft)] transition-colors"
            >
              <span>📊</span> Download Excel
            </a>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center border-t border-[var(--v3-rule)] pt-6">
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--v3-brand-hover)]"
          >
            View My Orders →
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] px-5 py-3 text-sm font-semibold text-[var(--v3-text-2)] hover:bg-[var(--v3-sunk)]"
          >
            Continue Shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
