"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";
import {
  EmptyState,
  ErrorState,
  PanelSkeleton,
  StateIcons,
} from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotalPaise?: number;
  shippingPaise?: number;
  gstPaise?: number;
  totalPaise: number;
  createdAt: string;
  items: {
    id: string;
    partName: string;
    partNumber: string;
    quantity: number;
    unitPricePaise?: number;
    totalPaise: number;
  }[];
  firmAllocations?: {
    id: string;
    firmName: string;
    amountPaise: number;
    fulfillmentStatus: string;
    paymentStatus: string;
  }[];
};

type StatusFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchesFilter(status: string, filter: StatusFilter) {
  if (filter === "all") return true;
  const normalized = status.toLowerCase();
  if (filter === "pending") {
    return (
      normalized.includes("pending") ||
      normalized.includes("placed") ||
      normalized.includes("await")
    );
  }
  return normalized.includes(filter);
}

export default function OrdersPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("orders.loadFail"));
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : t("orders.loadFail"),
        );
      } finally {
        setLoading(false);
      }
    }
    void loadOrders();
  }, [t]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("orders.filterAll") },
    { id: "pending", label: t("orders.filterPending") },
    { id: "confirmed", label: t("orders.filterConfirmed") },
    { id: "shipped", label: t("orders.filterShipped") },
    { id: "delivered", label: t("orders.filterDelivered") },
    { id: "cancelled", label: t("orders.filterCancelled") },
  ];

  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order.status, filter)),
    [orders, filter],
  );

  return (
    <div className="storefront-mobile-pad sl-container min-h-screen bg-[var(--sl-page)] text-[var(--sl-ink)]">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sl-rule)] pb-4">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="sl-display">{t("orders.title")}</h1>
            {!loading && !error && orders.length > 0 ? (
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="sl-num text-[1.25rem] font-extrabold leading-none text-[var(--sl-brand-ink)]">
                  {orders.length}
                </span>
                <span className="sl-micro font-bold uppercase tracking-[var(--sl-track-caps)]">
                  {t("nav.orders")}
                </span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/cart" className="text-sm font-semibold text-[var(--sl-brand-ink)]">
              {t("orders.cart")}
            </Link>
            <SignOutButton />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`sl-focus inline-flex min-h-10 shrink-0 items-center rounded-[var(--sl-r-sm)] border px-3.5 text-xs font-bold transition-colors ${
                filter === item.id
                  ? "border-[var(--sl-brand)] bg-[var(--sl-brand)] text-white"
                  : "border-[var(--sl-rule-2)] bg-[var(--sl-surface)] text-[var(--sl-ink-2)] hover:border-[var(--sl-brand-line)] hover:bg-[var(--sl-brand-soft)] hover:text-[var(--sl-brand-ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8">
            <PanelSkeleton rows={5} />
          </div>
        ) : null}
        {error ? (
          <div className="mt-8">
            <ErrorState
              title={t("common.error")}
              body={error}
              onRetry={() => window.location.reload()}
            />
          </div>
        ) : null}
        {!loading && !error && visibleOrders.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={StateIcons.orders}
              title={t("orders.emptyTitle")}
              body={t("orders.emptyBody")}
              action={{ href: "/", label: t("cart.find") }}
            />
          </div>
        ) : null}

        {/*
          DESKTOP: a real table. Order management is a comparison task — a user
          scans dates, amounts and statuses across many orders at once, which a
          stack of expandable cards makes harder. Columns map to the actual
          order record; nothing is summarised away.
        */}
        {!loading && !error && visibleOrders.length > 0 ? (
          <div className="sl-table-wrap mt-6 hidden lg:block">
            <table className="sl-table text-left">
              <caption className="sr-only">{t("nav.orders")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("track.orderLabel")}</th>
                  <th scope="col">{t("track.placedOn", { date: "" }).replace(":", "").trim()}</th>
                  <th scope="col">{t("track.itemsLabel")}</th>
                  <th scope="col" className="text-right">{t("cart.total")}</th>
                  <th scope="col">{t("track.paymentLabel").replace(":", "").trim()}</th>
                  <th scope="col">{t("orders.statusCol")}</th>
                  <th scope="col" className="text-right">{t("orders.actionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const paid = order.paymentStatus === "paid";
                  const partial = order.paymentStatus === "partial";
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[var(--sl-rule)] last:border-0 transition-colors hover:bg-[var(--sl-brand-soft)]"
                    >
                      <td className="align-top">
                        <Link
                          href={`/orders/${order.id}`}
                          className="sl-focus sl-part text-sm font-bold text-[var(--sl-brand-ink)] hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="align-top text-sm text-[var(--sl-ink-2)]">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="align-top text-sm text-[var(--sl-ink-2)]">
                        {order.items.length}{" "}
                        {order.items.length === 1
                          ? t("wishlist.item")
                          : t("wishlist.items")}
                      </td>
                      <td className="text-right align-top">
                        <span className="sl-price text-base">
                          ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="align-top">
                        <span
                          className={`sl-badge ${
                            paid
                              ? "sl-badge-ok"
                              : partial
                                ? "sl-badge-brand"
                                : "sl-badge-neutral"
                          }`}
                        >
                          {paid
                            ? t("orders.payPaid")
                            : partial
                              ? t("orders.payPartial")
                              : t("orders.payPending")}
                        </span>
                      </td>
                      <td className="align-top">
                        <span
                          className={`sl-badge ${
                            order.status === "delivered"
                              ? "sl-badge-ok"
                              : order.status === "cancelled"
                                ? "sl-badge-bad"
                                : "sl-badge-brand"
                          }`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="text-right align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {order.paymentMethod !== "cash_on_delivery" &&
                          order.paymentStatus !== "paid" ? (
                            <Link
                              href={`/orders/${order.id}/payment`}
                              className="sl-btn sl-btn-primary sl-btn-sm"
                            >
                              {order.paymentStatus === "partial"
                                ? t("orders.completePayment")
                                : order.paymentMethod === "bank_transfer"
                                  ? t("orders.submitUtr")
                                  : t("orders.payNow")}
                            </Link>
                          ) : null}
                          <Link
                            href={`/orders/${order.id}`}
                            className="sl-btn sl-btn-secondary sl-btn-sm"
                          >
                            {t("orders.view")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* MOBILE: cards, because a 7-column table cannot fit 375px. */}
        <section className="mt-6 space-y-3 lg:hidden">
          {visibleOrders.map((order) => {
            const open = expandedId === order.id;
            return (
              <article
                key={order.id}
                className="sl-panel p-4 sm:p-6"
              >
                <button
                  type="button"
                  className="sl-focus flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpandedId(open ? null : order.id)}
                  aria-expanded={open}
                >
                  <div>
                    <p className="sl-part text-sm font-bold text-[var(--sl-ink)]">
                      #{order.orderNumber}
                    </p>
                    <p className="sl-small mt-1">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {order.items.length}{" "}
                      {order.items.length === 1
                        ? t("wishlist.item")
                        : t("wishlist.items")}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span
                      className={`sl-badge ${
                        order.status === "delivered"
                          ? "sl-badge-ok"
                          : order.status === "cancelled"
                            ? "sl-badge-bad"
                            : "sl-badge-brand"
                      }`}
                    >
                      {statusLabel(order.status)}
                    </span>
                    <p className="mt-2">
                      <span className="sl-price text-base">
                        ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </p>
                  </div>
                </button>

                {open ? (
                  <div className="mt-4 border-t border-[var(--sl-rule)] pt-4 text-xs space-y-1.5">
                    <p className="mb-2 text-sm font-semibold text-[var(--sl-ink)]">
                    {t("orders.itemsOrdered")}
                  </p>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 py-0.5 text-[var(--sl-ink-2)]"
                      >
                        <span>
                          {item.partName}{" "}
                          <span className="font-mono text-[var(--sl-ink-3)]">
                            (#{item.partNumber})
                          </span>{" "}
                          <span className="font-semibold text-[var(--sl-ink-3)]">
                            × {item.quantity}
                          </span>
                        </span>
                        <span className="font-medium text-[var(--sl-ink)]">
                          ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}

                    {order.firmAllocations && order.firmAllocations.length > 0 ? (
                      <div className="mt-3 space-y-1 text-[var(--sl-ink-2)]">
                        {order.firmAllocations.map((allocation) => (
                          <div
                            key={allocation.id}
                            className="flex justify-between gap-4"
                          >
                            <span>{allocation.firmName}</span>
                            <span>
                              ₹{(allocation.amountPaise / 100).toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-1 border-t border-dashed border-[var(--sl-rule)] pt-3 text-xs">
                      {order.subtotalPaise !== undefined && (
                        <div className="flex justify-between text-[var(--sl-ink-3)]">
                          <span>{t("orders.itemsSubtotal")}</span>
                          <span>
                            ₹{(order.subtotalPaise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {order.gstPaise !== undefined && order.gstPaise > 0 && (
                        <div className="flex justify-between text-[var(--sl-ink-3)]">
                          <span>{t("orders.gstTaxes")}</span>
                          <span className="font-medium text-[var(--sl-ok)]">
                            ₹{(order.gstPaise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[var(--sl-ink-3)]">
                        <span>{t("help.shippingShort")}</span>
                        <span className="font-medium text-[var(--sl-ok)]">
                          {(order.shippingPaise ?? 0) === 0
                            ? t("checkout.freeStd")
                            : `₹${((order.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--sl-rule)] pt-2 text-sm font-bold text-[var(--sl-ink)]">
                        <span>{t("orders.totalPaid")}</span>
                        <span>
                          ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sl-rule)] pt-3.5">
                      <p className="text-xs text-[var(--sl-ink-3)]">
                        {t("checkout.stepPayment")}:{" "}
                        {order.paymentMethod === "cash_on_delivery"
                          ? t("pay.methodCod")
                          : order.paymentMethod === "bank_transfer"
                            ? t("pay.methodBank")
                            : t("pay.methodOnline")}{" "}
                        (
                        {order.paymentStatus === "paid"
                          ? t("payStatus.paid")
                          : order.paymentStatus === "partial"
                            ? t("payStatus.partial")
                            : t("payStatus.pending")}
                        )
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {order.paymentMethod !== "cash_on_delivery" &&
                          order.paymentStatus !== "paid" && (
                            <Link
                              href={`/orders/${order.id}/payment`}
                              className="sl-btn sl-btn-primary sl-btn-sm"
                            >
                              {order.paymentStatus === "partial"
                                ? t("orders.completePayment")
                                : order.paymentMethod === "bank_transfer"
                                  ? t("orders.submitUtr")
                                  : t("orders.payNow")}
                            </Link>
                          )}
                        {order.paymentMethod !== "cash_on_delivery" &&
                          order.paymentStatus === "paid" && (
                            <Link
                              href={`/orders/${order.id}/payment`}
                              className="sl-btn sl-btn-sm border border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] text-[var(--sl-ok)] hover:border-[var(--sl-ok)]"
                            >
                              {t("orders.paymentDetails")}
                            </Link>
                          )}
                        <InvoiceDownloadLinks
                          orderId={order.id}
                          allocations={(order.firmAllocations ?? []).map(
                            (allocation) => ({
                              firmOrderId: allocation.id,
                              firmName: allocation.firmName,
                            }),
                          )}
                          linkClassName="sl-btn sl-btn-sm border border-[var(--sl-rule-2)] bg-[var(--sl-surface)] text-[var(--sl-ink-2)] hover:border-[var(--sl-rule-strong)] hover:bg-[var(--sl-sunken)]"
                        />
                        <a
                          href={`/api/orders/${order.id}/excel`}
                          download
                          className="sl-btn sl-btn-sm border border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] text-[var(--sl-ok)] hover:border-[var(--sl-ok)]"
                        >
                          {t("confirm.downloadExcel")}
                        </a>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </main>
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
