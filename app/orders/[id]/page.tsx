"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";
import { Notice } from "@/components/page-states";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { useI18n } from "@/components/preferences-provider";
import { T } from "@/components/t";

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  createdAt: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  items: {
    id: string;
    partNumber: string;
    partName: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }[];
};

type FirmPayment = {
  firmOrderId: string;
  firmName: string;
  firmCode?: string | null;
  allocationNumber: string;
  amountPaise: number;
  fulfillmentStatus: string;
  paymentStatus: string;
};

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Shelf-label styling shared by the document's section heads. */
const SECTION_LABEL =
  "sl-micro font-bold uppercase tracking-[var(--sl-track-caps)]";

export default function OrderDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [firmPayments, setFirmPayments] = useState<FirmPayment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [returnMsg, setReturnMsg] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}/payment`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("orderDoc.loadFail"));
        setOrder(data.order);
        setFirmPayments(data.firmPayments || []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("orderDoc.loadFail"),
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, t]);

  async function submitReturnRequest() {
    if (!order || submittingReturn) return;
    setSubmittingReturn(true);
    setReturnMsg("");
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          requestType: "return",
          reason: "other",
          description: "Customer return request from order detail",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("orderDoc.returnFail"));
      setReturnMsg(
        t("orderDoc.returnSubmitted", { number: data.requestNumber }),
      );
    } catch (err) {
      setReturnMsg(
        err instanceof Error ? err.message : t("orderDoc.returnFail"),
      );
    } finally {
      setSubmittingReturn(false);
    }
  }

  const gstPaise = order
    ? Math.max(
        0,
        order.totalPaise - order.subtotalPaise - (order.shippingPaise ?? 0),
      )
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">
      <StorefrontHeader />

      <main className="sl-container sl-page-main flex-1">
        {/* Document toolbar. Not a <header>: the site header above is the
            page's only banner landmark. */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--sl-rule)] pb-3">
          <Link
            href="/orders"
            className="sl-focus inline-flex min-h-10 items-center gap-1.5 rounded-[var(--sl-r)] px-2 text-[0.8125rem] font-semibold text-[var(--sl-ink-2)] transition-colors hover:bg-[var(--sl-sunken)] hover:text-[var(--sl-brand-ink)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <T k="nav.orders" />
          </Link>
          <p className="sl-micro font-bold uppercase tracking-[var(--sl-track-caps)]">
            <T k="orderDoc.purchaseDocument" />
          </p>
        </div>

        {/* Loading is a shaped document skeleton, not a sentence. It mirrors
            the identity block so the page does not jump when the order
            resolves. */}
        {loading ? (
          <div className="mt-6" role="status" aria-live="polite">
            <span className="sr-only">{t("common.loading")}</span>
            <div className="sl-skel h-3 w-32" aria-hidden="true" />
            <div className="sl-skel mt-3 h-9 w-56" aria-hidden="true" />
            <div className="sl-skel mt-4 h-3 w-40" aria-hidden="true" />
            <div className="mt-8 space-y-2" aria-hidden="true">
              <div className="sl-skel h-16 w-full" />
              <div className="sl-skel h-16 w-full" />
              <div className="sl-skel h-24 w-full" />
            </div>
          </div>
        ) : null}
        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {order && (
          <article className="mt-6 max-w-4xl space-y-8">
            {/* ---------- 01 ORDER IDENTITY ----------
                The number is the document's primary identifier, so it is set
                large and monospaced, with the date beneath it. Status and
                payment are state, so they are badges. */}
            <div className="border-b border-[var(--sl-rule)] pb-5">
              <p className="sl-eyebrow">
                <T k="orderDoc.detailLabel" />
              </p>
              <h1 className="sl-display sl-wrap-any mt-2.5 font-mono tracking-tight">
                #{order.orderNumber}
              </h1>
              <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <dt className={SECTION_LABEL}>
                    <T k="track.placedOn" />
                  </dt>
                  <dd className="sl-num text-[0.8125rem] text-[var(--sl-ink-2)]">
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className={SECTION_LABEL}>
                    <T k="checkout.stepPayment" />
                  </dt>
                  <dd className="text-[0.8125rem] text-[var(--sl-ink-2)]">
                    {order.paymentMethod === "cash_on_delivery" ? (
                      <T k="pay.methodCod" />
                    ) : (
                      statusLabel(order.paymentMethod)
                    )}{" "}
                    · {statusLabel(order.paymentStatus)}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="sl-badge sl-badge-brand">{statusLabel(order.status)}</span>
              </div>
            </div>

            {/* ---------- 03 ITEMS ----------
                A specification table. Each line is one part: the part number is
                catalogue data and is set in monospace, the name is the
                primary line, and quantity and line total are right-aligned
                tabular figures so a column of them is comparable. */}
            <section aria-labelledby="order-items">
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-[var(--sl-rule)] pb-3">
                <span className="sl-eyebrow">03</span>
                <h2 id="order-items" className="sl-h2 min-w-0">
                  <T k="orders.itemsOrdered" />
                </h2>
                <span className="sl-num ml-auto shrink-0 text-[0.75rem] font-semibold text-[var(--sl-ink-3)]">
                  {order.items.length}
                </span>
              </div>

              <ul className="divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-3"
                  >
                    <div className="min-w-0">
                      {item.partNumber ? (
                        <p className="sl-part truncate text-[0.6875rem]">
                          #{item.partNumber}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[0.875rem] font-semibold leading-snug text-[var(--sl-ink)]">
                        {item.partName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="sl-num text-[0.9375rem] font-bold text-[var(--sl-ink)]">
                        ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                      </p>
                      <p className="sl-num mt-0.5 text-[0.6875rem] text-[var(--sl-ink-3)]">
                        × {item.quantity}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* ---------- 04 FINANCIAL ----------
                Split out of the Items card. Every expression below is
                unchanged: subtotal, the GST already included in it, shipping
                and the payable total. */}
            <section aria-labelledby="order-financial">
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-[var(--sl-rule)] pb-3">
                <span className="sl-eyebrow">04</span>
                <h2 id="order-financial" className="sl-h2 min-w-0">
                  <T k="orderDoc.financial" />
                </h2>
              </div>

              <dl className="divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className={SECTION_LABEL}>
                    <T k="orders.itemsSubtotal" />
                  </dt>
                  <dd className="sl-num shrink-0 text-[0.875rem] font-semibold text-[var(--sl-ink)]">
                    ₹{(order.subtotalPaise / 100).toLocaleString("en-IN")}
                  </dd>
                </div>
                {gstPaise > 0 && (
                  <div className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className={SECTION_LABEL}>
                      <T k="orderDoc.gstIncluded" />
                    </dt>
                    <dd className="sl-num shrink-0 text-[0.875rem] font-semibold text-[var(--sl-ok)]">
                      ₹{(gstPaise / 100).toLocaleString("en-IN")}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className={SECTION_LABEL}>
                    <T k="help.shippingShort" />
                  </dt>
                  <dd className="sl-num shrink-0 text-[0.875rem] font-semibold text-[var(--sl-ink-2)]">
                    ₹{((order.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}
                  </dd>
                </div>
              </dl>

              {/* The payable total in its own sunk band: the only large figure
                  in the section. */}
              <div className="mt-3 flex items-end justify-between gap-4 rounded-[var(--sl-r)] bg-[var(--sl-sunken)] px-3 py-3">
                <span className={SECTION_LABEL}>
                  <T k="cart.total" />
                </span>
                <span className="sl-num shrink-0 text-[1.5rem] font-extrabold leading-none tracking-tight text-[var(--sl-ink)]">
                  ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
            </section>

            {/* ---------- 05 FULFILMENT ----------
                An order can be split across the three distribution firms, and
                each issues its own tax invoice — so this is an ALLOCATION
                TABLE, not a note. Firm, its status, the amount it carries and
                the invoice link are one ruled row, so the allocations of a
                split order add up visually. */}
            {firmPayments.length > 0 && (
              <section aria-labelledby="order-fulfillment">
                <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-[var(--sl-rule)] pb-3">
                  <span className="sl-eyebrow">05</span>
                  <h2 id="order-fulfillment" className="sl-h2 min-w-0">
                    <T k="orderDoc.fulfillment" />
                  </h2>
                </div>
                <p className="sl-small mt-2.5 max-w-2xl">
                  <T k="orderDoc.fulfillmentBody" />
                </p>
                <ul className="mt-3 divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
                  {firmPayments.map((firm) => (
                    <li
                      key={firm.firmOrderId}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.875rem] font-bold text-[var(--sl-ink)]">
                          {firm.firmName}
                        </p>
                        <p className="sl-meta mt-0.5 text-[0.75rem]">
                          {statusLabel(firm.fulfillmentStatus)} ·{" "}
                          {statusLabel(firm.paymentStatus)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="sl-num text-[0.9375rem] font-bold text-[var(--sl-ink)]">
                          ₹{(firm.amountPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <a
                          href={`/api/orders/${order.id}/invoice?firmOrderId=${encodeURIComponent(firm.firmOrderId)}`}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="sl-btn sl-btn-secondary sl-btn-sm"
                        >
                          <T k="orderDoc.invoice" />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Delivery address, as the second half of the fulfilment record. */}
            <section aria-labelledby="order-delivery">
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-[var(--sl-rule)] pb-3">
                <span className="sl-eyebrow">05b</span>
                <h2 id="order-delivery" className="sl-h2 min-w-0">
                  <T k="orderDoc.deliveryAddress" />
                </h2>
              </div>
              <address className="sl-body mt-3 not-italic">
                {order.shippingName}
                <br />
                {order.shippingPhone}
                <br />
                {order.shippingAddressLine1}
                {order.shippingAddressLine2 ? (
                  <>
                    <br />
                    {order.shippingAddressLine2}
                  </>
                ) : null}
                <br />
                {order.shippingCity}, {order.shippingState}{" "}
                {order.shippingPincode}
              </address>
            </section>

            {/* ---------- 06 ACTIONS ----------
                Exactly the four actions the page already offered — invoice
                downloads, the Excel export, the payment link where the method
                calls for it, and the return request. Nothing is added. */}
            <section aria-labelledby="order-actions">
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-[var(--sl-rule)] pb-3">
                <span className="sl-eyebrow">06</span>
                <h2 id="order-actions" className="sl-h2 min-w-0">
                  <T k="orderDoc.actions" />
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <InvoiceDownloadLinks
                  orderId={order.id}
                  allocations={firmPayments.map((firm) => ({
                    firmOrderId: firm.firmOrderId,
                    firmName: firm.firmName,
                  }))}
                  linkClassName="sl-btn sl-btn-secondary sl-btn-sm"
                />
                <a
                  href={`/api/orders/${order.id}/excel`}
                  className="sl-btn sl-btn-secondary sl-btn-sm"
                >
                  <T k="confirm.downloadExcel" />
                </a>
                {order.paymentMethod !== "cash_on_delivery" && (
                  <Link
                    href={`/orders/${order.id}/payment`}
                    className="sl-btn sl-btn-primary sl-btn-sm"
                  >
                    <T k="checkout.stepPayment" />
                  </Link>
                )}
                <button
                  type="button"
                  disabled={submittingReturn}
                  onClick={() => void submitReturnRequest()}
                  className="sl-btn sl-btn-secondary sl-btn-sm disabled:opacity-50"
                >
                  {submittingReturn ? t("pay.submitting") : t("orderDoc.requestReturn")}
                </button>
              </div>
              {returnMsg ? (
                <div className="mt-3">
                  <Notice>{returnMsg}</Notice>
                </div>
              ) : null}
            </section>
          </article>
        )}
      </main>

      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
