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
    <div className="storefront-mobile-pad sl-container sl-container-prose sl-page-main min-h-screen text-[var(--sl-text)]">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="sl-h1 text-2xl sm:text-3xl">{t("orders.title")}</h1>
          <div className="flex items-center gap-3">
            <Link href="/cart" className="text-sm font-semibold text-[var(--sl-primary)]">
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
              className={`min-h-10 shrink-0 rounded-full px-3.5 text-xs font-bold ${
                filter === item.id
                  ? "bg-[var(--sl-primary)] text-white"
                  : "border border-[var(--sl-border)] bg-white text-[var(--sl-text-soft)]"
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
          <div className="mt-6 hidden overflow-hidden rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-white lg:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{t("nav.orders")}</caption>
              <thead>
                <tr className="border-b border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]">
                  <th scope="col" className="sl-label px-4 py-3">{t("track.orderLabel")}</th>
                  <th scope="col" className="sl-label px-4 py-3">{t("track.placedOn", { date: "" }).replace(":", "").trim()}</th>
                  <th scope="col" className="sl-label px-4 py-3">{t("track.itemsLabel")}</th>
                  <th scope="col" className="sl-label px-4 py-3 text-right">{t("cart.total")}</th>
                  <th scope="col" className="sl-label px-4 py-3">{t("track.paymentLabel").replace(":", "").trim()}</th>
                  <th scope="col" className="sl-label px-4 py-3">{t("orders.statusCol")}</th>
                  <th scope="col" className="sl-label px-4 py-3 text-right">{t("orders.actionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => {
                  const paid = order.paymentStatus === "paid";
                  const partial = order.paymentStatus === "partial";
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[var(--sl-border)] last:border-0 transition-colors hover:bg-[var(--sl-primary-soft)]"
                    >
                      <td className="px-4 py-3.5 align-top">
                        <Link
                          href={`/orders/${order.id}`}
                          className="sl-v2-focus sl-partno !text-sm !font-bold !text-[var(--sl-primary)] hover:underline"
                        >
                          #{order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 align-top text-sm text-[var(--sl-text-soft)]">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3.5 align-top text-sm text-[var(--sl-text-soft)]">
                        {order.items.length}{" "}
                        {order.items.length === 1
                          ? t("wishlist.item")
                          : t("wishlist.items")}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top">
                        <span className="sl-price !text-base">
                          ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`sl-v2-badge ${
                            paid
                              ? "sl-v2-badge-success"
                              : partial
                                ? "sl-v2-badge-brand"
                                : "sl-v2-badge"
                          }`}
                        >
                          {paid
                            ? t("orders.payPaid")
                            : partial
                              ? t("orders.payPartial")
                              : t("orders.payPending")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={`sl-v2-badge ${
                            order.status === "delivered"
                              ? "sl-v2-badge-success"
                              : order.status === "cancelled"
                                ? "sl-v2-badge-danger"
                                : "sl-v2-badge-brand"
                          }`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right align-top">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {order.paymentMethod !== "cash_on_delivery" &&
                          order.paymentStatus !== "paid" ? (
                            <Link
                              href={`/orders/${order.id}/payment`}
                              className="sl-v2-btn sl-v2-btn-primary !min-h-9 !px-2.5 !text-[0.6875rem]"
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
                            className="sl-v2-btn sl-v2-btn-secondary !min-h-9 !px-2.5 !text-[0.6875rem]"
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
                className="sl-v2-card p-4 sm:p-6"
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpandedId(open ? null : order.id)}
                  aria-expanded={open}
                >
                  <div>
                    <p className="sl-partno !text-sm !font-bold !text-[var(--sl-text)]">
                      #{order.orderNumber}
                    </p>
                    <p className="sl-small mt-1">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {order.items.length} item{order.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span
                      className={`sl-v2-badge ${
                        order.status === "delivered"
                          ? "sl-v2-badge-success"
                          : order.status === "cancelled"
                            ? "sl-v2-badge-danger"
                            : "sl-v2-badge-brand"
                      }`}
                    >
                      {statusLabel(order.status)}
                    </span>
                    <p className="mt-2">
                      <span className="sl-price !text-base">
                        ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </p>
                  </div>
                </button>

                {open ? (
                  <div className="mt-4 border-t border-slate-100 pt-4 text-xs space-y-1.5">
                    <p className="mb-2 text-sm font-semibold text-[var(--sl-text)]">Items Ordered</p>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 py-0.5 text-[var(--sl-text-soft)]"
                      >
                        <span>
                          {item.partName}{" "}
                          <span className="font-mono text-[var(--sl-muted)]">
                            (#{item.partNumber})
                          </span>{" "}
                          <span className="font-semibold text-[var(--sl-muted)]">
                            × {item.quantity}
                          </span>
                        </span>
                        <span className="font-medium text-[var(--sl-text)]">
                          ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}

                    {order.firmAllocations && order.firmAllocations.length > 0 ? (
                      <div className="mt-3 space-y-1 text-[var(--sl-text-soft)]">
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

                    <div className="mt-4 space-y-1 border-t border-dashed border-[var(--sl-border)] pt-3 text-xs">
                      {order.subtotalPaise !== undefined && (
                        <div className="flex justify-between text-[var(--sl-muted)]">
                          <span>Items Subtotal</span>
                          <span>
                            ₹{(order.subtotalPaise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {order.gstPaise !== undefined && order.gstPaise > 0 && (
                        <div className="flex justify-between text-[var(--sl-muted)]">
                          <span>GST / Taxes</span>
                          <span className="font-medium text-emerald-700">
                            ₹{(order.gstPaise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[var(--sl-muted)]">
                        <span>Shipping</span>
                        <span className="font-medium text-emerald-700">
                          {(order.shippingPaise ?? 0) === 0
                            ? "₹0 (Free Standard)"
                            : `₹${((order.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--sl-border)] pt-2 text-sm font-bold text-[var(--sl-text)]">
                        <span>Total Paid</span>
                        <span>
                          ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
                      <p className="text-xs text-[var(--sl-muted)]">
                        Payment:{" "}
                        {order.paymentMethod === "cash_on_delivery"
                          ? "Cash on delivery"
                          : order.paymentMethod === "bank_transfer"
                            ? "Bank / UPI Transfer"
                            : "Online payment"}{" "}
                        (
                        {order.paymentStatus === "paid"
                          ? "Paid"
                          : order.paymentStatus === "partial"
                            ? "Partially Paid"
                            : "Pending"}
                        )
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {order.paymentMethod !== "cash_on_delivery" &&
                          order.paymentStatus !== "paid" && (
                            <Link
                              href={`/orders/${order.id}/payment`}
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--sl-radius-sm)] bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                            >
                              {order.paymentStatus === "partial"
                                ? "Complete remaining payment"
                                : order.paymentMethod === "bank_transfer"
                                  ? "Submit Payment UTR"
                                  : "Pay now"}
                            </Link>
                          )}
                        {order.paymentMethod !== "cash_on_delivery" &&
                          order.paymentStatus === "paid" && (
                            <Link
                              href={`/orders/${order.id}/payment`}
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--sl-radius-sm)] border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
                            >
                              Payment details
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
                          linkClassName="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--sl-radius-sm)] border border-[var(--sl-border-strong)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--sl-text-soft)]"
                        />
                        <a
                          href={`/api/orders/${order.id}/excel`}
                          download
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--sl-radius-sm)] border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
                        >
                          Download Excel
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
