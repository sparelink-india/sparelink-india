"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";
import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import type { MessageKey } from "@/lib/i18n";

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

/**
 * Payment status is shown as a dictionary key rather than a literal, so it
 * renders in the customer's language. The three keys already existed and were
 * already translated, for the order list.
 */
function parentPaymentKey(status: string): MessageKey {
  if (status === "paid") return "orders.payPaid";
  if (status === "partial") return "orders.payPartial";
  return "orders.payPending";
}

/**
 * V3 order confirmation.
 *
 * This is a money-flow screen, so the changes here are presentation only: the
 * fetch, the needsPayment condition, the payment link target and the two
 * download endpoints are all exactly as they were.
 *
 * What it was before: a hand-rolled <main> with no site header, no footer and
 * no mobile nav, so a customer who had just paid landed somewhere that looked
 * like a different application. Inside that, a V2 card (rounded-2xl,
 * border-slate-200, shadow-sm), a V2 spec panel (rounded-xl, bg-slate-50),
 * slate-950 buttons at rounded-xl, a literal border-[#bfe0d1], and a U+1F4CA
 * emoji standing in for the download icon.
 *
 * It is now a StorefrontShell page, with the footer suppressed - this is a
 * terminal receipt and its two actions are already on screen, so a four-column
 * footer between the customer and their receipt is noise. The mobile bottom
 * nav still renders, so leaving is one tap.
 */
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
    <StorefrontShell showFooter={false}>
      <div className="py-10 sm:py-16">
        <section className="sl-panel mx-auto max-w-xl p-6 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--sl-r)] bg-[var(--sl-ok-soft)] text-[var(--sl-ok)]">
            <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <p className="sl-micro mt-5 font-bold uppercase tracking-[var(--sl-track-caps)] text-[var(--sl-ok)]">
            <T k="confirm.placed" />
          </p>
          <h1 className="sl-display mt-2">
            <T k="confirm.thanks" />
          </h1>

          <p className="sl-body mt-3 text-[var(--sl-ink-2)]">
            <T k="confirm.bodyLead" />{" "}
            {order?.orderNumber ? (
              <strong className="sl-num font-bold text-[var(--sl-ink)]">
                #{order.orderNumber}
              </strong>
            ) : null}{" "}
            <T k="confirm.bodyTail" />
          </p>

          {/* Reference panel: a ruled spec block, not a tinted V2 card. */}
          <dl className="sl-panel-sunk mt-6 divide-y divide-[var(--sl-rule)] border border-[var(--sl-rule)] p-4 text-left text-xs">
            <div className="flex justify-between gap-3 py-1.5">
              <dt className="text-[var(--sl-ink-2)]">
                <T k="confirm.orderReference" />
              </dt>
              <dd className="sl-num truncate text-[var(--sl-ink)]">{id}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1.5">
              <dt className="text-[var(--sl-ink-2)]">
                <T k="confirm.paymentStatus" />
              </dt>
              <dd className="text-right font-semibold text-[var(--sl-ink)]">
                {order ? (
                  <T k={parentPaymentKey(order.paymentStatus)} />
                ) : (
                  <T k="confirm.confirming" />
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-1.5">
              <dt className="text-[var(--sl-ink-2)]">
                <T k="confirm.gstInvoice" />
              </dt>
              <dd className="text-right font-semibold text-[var(--sl-ink)]">
                {multiFirm ? <T k="confirm.perFirm" /> : <T k="confirm.readyDownload" />}
              </dd>
            </div>
          </dl>

          {needsPayment && (
            <Link
              href={`/orders/${id}/payment`}
              className="sl-btn sl-btn-primary mt-6 w-full justify-center"
            >
              {order.paymentStatus === "partial" ? (
                <T k="confirm.completeRemaining" />
              ) : (
                <T k="confirm.payNow" />
              )}
            </Link>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {id ? (
              <InvoiceDownloadLinks
                orderId={id}
                allocations={firmAllocations}
                className="flex flex-wrap items-center justify-center gap-2.5"
                linkClassName="sl-btn sl-btn-secondary min-h-10 text-xs"
              />
            ) : null}
            {id ? (
              /* The href, the download attribute and the endpoint are
                 unchanged; only the emoji became a stroke icon in the same
                 24-unit / currentColor language as the rest of the chrome. */
              <a
                href={`/api/orders/${id}/excel`}
                download
                className="sl-btn sl-btn-secondary min-h-10 text-xs"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3v12" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M4 20h16" />
                </svg>
                <T k="confirm.downloadExcel" />
              </a>
            ) : null}
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-[var(--sl-rule)] pt-6 sm:flex-row sm:justify-center">
            <Link
              href="/orders"
              className="sl-btn sl-btn-primary justify-center px-6"
            >
              <T k="nav.orders" />
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link
              href="/"
              className="sl-btn sl-btn-secondary justify-center px-5"
            >
              <T k="confirm.continueShopping" />
            </Link>
          </div>
        </section>
      </div>
    </StorefrontShell>
  );
}
