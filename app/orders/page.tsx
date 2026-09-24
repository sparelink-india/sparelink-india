"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";
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
    <div className="storefront-mobile-pad min-h-screen bg-slate-50 text-slate-950">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("orders.title")}</h1>
          <div className="flex items-center gap-3">
            <Link href="/cart" className="text-sm font-semibold text-[#7a1233]">
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
                  ? "bg-[#7a1233] text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && (
          <p className="mt-8 text-sm text-slate-500">{t("orders.loading")}</p>
        )}
        {error && (
          <div role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && visibleOrders.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-12">
            <h2 className="font-semibold">{t("orders.emptyTitle")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("orders.emptyBody")}</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white"
            >
              {t("cart.find")}
            </Link>
          </div>
        )}

        <section className="mt-6 space-y-3">
          {visibleOrders.map((order) => {
            const open = expandedId === order.id;
            return (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpandedId(open ? null : order.id)}
                  aria-expanded={open}
                >
                  <div>
                    <p className="font-semibold">#{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-slate-500">
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
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                      {statusLabel(order.status)}
                    </span>
                    <p className="mt-2 font-bold">
                      ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                    </p>
                  </div>
                </button>

                {open ? (
                  <div className="mt-4 border-t border-slate-100 pt-4 text-xs space-y-1.5">
                    <p className="mb-2 text-sm font-semibold text-slate-900">Items Ordered</p>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-4 py-0.5 text-slate-700"
                      >
                        <span>
                          {item.partName}{" "}
                          <span className="font-mono text-slate-400">
                            (#{item.partNumber})
                          </span>{" "}
                          <span className="font-semibold text-slate-500">
                            × {item.quantity}
                          </span>
                        </span>
                        <span className="font-medium text-slate-900">
                          ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}

                    {order.firmAllocations && order.firmAllocations.length > 0 ? (
                      <div className="mt-3 space-y-1 text-slate-600">
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

                    <div className="mt-4 space-y-1 border-t border-dashed border-slate-200 pt-3 text-xs">
                      {order.subtotalPaise !== undefined && (
                        <div className="flex justify-between text-slate-500">
                          <span>Items Subtotal</span>
                          <span>
                            ₹{(order.subtotalPaise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      {order.gstPaise !== undefined && order.gstPaise > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>GST / Taxes</span>
                          <span className="font-medium text-emerald-700">
                            ₹{(order.gstPaise / 100).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-500">
                        <span>Shipping</span>
                        <span className="font-medium text-emerald-700">
                          {(order.shippingPaise ?? 0) === 0
                            ? "₹0 (Free Standard)"
                            : `₹${((order.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                        <span>Total Paid</span>
                        <span>
                          ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
                      <p className="text-xs text-slate-500">
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
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
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
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
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
                          linkClassName="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                        />
                        <a
                          href={`/api/orders/${order.id}/excel`}
                          download
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
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
