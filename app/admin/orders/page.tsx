"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";
import {
  applyCancelledStatus,
  buildOrderCancellationConfirmation,
  buildOrderCancellationPayload,
  cancelledOrderCount,
  filterOrders,
  formatInr,
  formatOrderStatus,
  formatPaymentMethod,
  formatPaymentStatus,
  hasActiveFilters,
  isOrderCancellationAllowed,
  ORDER_CANCELLATION_PATH,
  ORDER_FILTERS,
  ORDER_FILTER_LABELS,
  orderCancellationErrorMessage,
  orderCancellationSuccessMessage,
  readRestockedLines,
  summarizeOrders,
  type AdminOrder,
  type OrderFilter,
} from "@/lib/admin-orders-dashboard";

const BRAND = "#7a1233";

const STATUS_TONE: Record<string, string> = {
  placed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  pending: "bg-sky-50 text-sky-700 ring-sky-600/20",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  packed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  processing: "bg-amber-50 text-amber-800 ring-amber-600/20",
  shipped: "bg-violet-50 text-violet-700 ring-violet-600/20",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  returned: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const PAYMENT_TONE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  unpaid: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
  refunded: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
};

function statusTone(status: string) {
  return STATUS_TONE[status?.trim().toLowerCase()] ?? "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
}

function paymentTone(status: string) {
  return PAYMENT_TONE[status?.trim().toLowerCase()] ?? "bg-zinc-100 text-zinc-700 ring-zinc-500/20";
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${tone}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  active,
  onClick,
  tone = "default",
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        active
          ? "border-transparent ring-2"
          : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60"
      } ${
        active
          ? danger
            ? "ring-rose-600/40"
            : "ring-[#7a1233]/40"
          : ""
      }`}
      style={active && !danger ? { borderColor: BRAND } : undefined}
    >
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          danger ? "text-rose-600" : "text-zinc-500"
        }`}
      >
        {label}
      </span>
      <span className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{value}</span>
    </button>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>("active");
  const [query, setQuery] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setOrders(data.orders);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await loadOrders();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load orders.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadOrders]);

  const summary = useMemo(() => summarizeOrders(orders), [orders]);
  const visible = useMemo(
    () => filterOrders(orders, { filter, query }),
    [orders, filter, query],
  );
  const cancelled = cancelledOrderCount(orders);
  const detailsOrder = useMemo(
    () => orders.find((order) => order.id === detailsId) ?? null,
    [orders, detailsId],
  );

  const handleCancelOrder = async (order: AdminOrder) => {
    if (cancellingId) return;
    if (!isOrderCancellationAllowed(order)) return;
    if (!window.confirm(buildOrderCancellationConfirmation(order))) return;

    setCancellingId(order.id);
    setError("");
    setNotice("");

    try {
      // Existing endpoint. Body is orderId + status only; never paymentStatus.
      const response = await fetch(ORDER_CANCELLATION_PATH, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(buildOrderCancellationPayload(order.id)),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          `${order.orderNumber}: ${orderCancellationErrorMessage(response.status, data)}`,
        );
        return;
      }

      setOrders((current) => applyCancelledStatus(current, order.id));
      setDetailsId((current) => (current === order.id ? null : current));
      try {
        await loadOrders();
      } catch {
        // Keep the optimistic result if the refresh fails.
      }
      setNotice(
        orderCancellationSuccessMessage(
          order.orderNumber,
          readRestockedLines(data) > 0,
        ),
      );
    } catch {
      setError(`${order.orderNumber}: Unable to cancel the order. Please try again.`);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden shrink-0 sm:block">
                <BrandLogo compact />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: BRAND }}
                >
                  SpareLink India
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
                  Customer Orders
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Review placed orders, fulfillment status, payments and GST summaries
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/admin/orders/export"
                download
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
              >
                <span aria-hidden="true">📊</span> Export to Excel
              </a>

              <button
                type="button"
                onClick={() => setFilter("cancelled")}
                aria-pressed={filter === "cancelled"}
                aria-label={`Cancelled orders bin, ${cancelled} order${cancelled === 1 ? "" : "s"}`}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/40 ${
                  filter === "cancelled"
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span aria-hidden="true">🗑️</span>
                <span>Cancelled Orders</span>
                <span
                  className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    filter === "cancelled"
                      ? "bg-rose-600 text-white"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {cancelled}
                </span>
              </button>

              <Link
                href="/admin"
                className="text-xs font-semibold text-zinc-600 underline-offset-2 hover:underline"
              >
                ← Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            <span aria-hidden="true" className="font-bold">✕</span>
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            <span aria-hidden="true" className="font-bold">✓</span>
            <span>{notice}</span>
          </div>
        )}

        {/* Summary. Every value is derived from the loaded order list. */}
        <section aria-label="Order status summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard
            label={ORDER_FILTER_LABELS.active}
            value={summary.active}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <SummaryCard
            label={ORDER_FILTER_LABELS.pending}
            value={summary.pending}
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          />
          <SummaryCard
            label={ORDER_FILTER_LABELS.processing}
            value={summary.processing}
            active={filter === "processing"}
            onClick={() => setFilter("processing")}
          />
          <SummaryCard
            label={ORDER_FILTER_LABELS.shipped}
            value={summary.shipped}
            active={filter === "shipped"}
            onClick={() => setFilter("shipped")}
          />
          <SummaryCard
            label={ORDER_FILTER_LABELS.delivered}
            value={summary.delivered}
            active={filter === "delivered"}
            onClick={() => setFilter("delivered")}
          />
          <SummaryCard
            label={ORDER_FILTER_LABELS.cancelled}
            value={summary.cancelled}
            active={filter === "cancelled"}
            onClick={() => setFilter("cancelled")}
            tone="danger"
          />
        </section>

        {/* Filters and search */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {ORDER_FILTERS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  aria-pressed={filter === id}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40 ${
                    filter === id ? "text-white" : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                  style={filter === id ? { backgroundColor: BRAND } : undefined}
                >
                  {ORDER_FILTER_LABELS[id]}
                  <span className="ml-1.5 tabular-nums opacity-70">{summary[id]}</span>
                </button>
              ))}
            </div>

            <div className="lg:w-80">
              <label htmlFor="admin-order-search" className="sr-only">
                Search orders
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  🔍
                </span>
                <input
                  id="admin-order-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Order #, buyer email, firm…"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/60 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#7a1233] focus:bg-white focus:ring-2 focus:ring-[#7a1233]/15"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center gap-3 p-10 text-sm text-zinc-500">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-[#7a1233]"
              />
              Loading orders…
            </div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center">
              <p aria-hidden="true" className="text-3xl">
                {filter === "cancelled" ? "🗑️" : "📭"}
              </p>
              <p className="mt-3 text-sm font-semibold text-zinc-900">
                {filter === "cancelled"
                  ? "No cancelled orders"
                  : hasActiveFilters({ filter, query })
                    ? "No orders match your search"
                    : "No orders found"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {filter === "cancelled"
                  ? "Cancelled orders are kept for audit and remain available here."
                  : hasActiveFilters({ filter, query })
                    ? "Try a different order number, buyer email or firm name."
                    : "Orders will appear here as soon as customers check out."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50/70">
                  <tr>
                    {[
                      "Order #",
                      "Buyer",
                      "Items",
                      "Status",
                      "Payment",
                      "Amount",
                      "Date",
                      "Invoice",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
                          label === "Invoice" || label === "Actions" ? "text-right" : ""
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visible.map((order) => {
                    const cancellable = isOrderCancellationAllowed(order);
                    const isCancelling = cancellingId === order.id;
                    const isExpanded = detailsId === order.id;
                    return (
                      <>
                        <tr
                          key={order.id}
                          className="align-top transition-colors hover:bg-zinc-50/70"
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-zinc-900">
                              {order.orderNumber}
                            </span>
                          </td>
                          <td className="max-w-[16rem] truncate px-4 py-3 text-xs text-zinc-700">
                            {order.buyerEmail}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-700">
                            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge label={formatOrderStatus(order.status)} tone={statusTone(order.status)} />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              label={formatPaymentStatus(order.paymentStatus)}
                              tone={paymentTone(order.paymentStatus)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold tabular-nums text-zinc-900">
                            {formatInr(order.totalPaise)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600">
                            {new Date(order.createdAt).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <InvoiceDownloadLinks
                              orderId={order.id}
                              allocations={order.firmAllocations ?? []}
                              className="inline-flex flex-wrap justify-end gap-1.5"
                              linkClassName="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                              singleLabel="🧾 Invoice"
                              multiLabelPrefix="🧾"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailsId(isExpanded ? null : order.id)}
                                aria-expanded={isExpanded}
                                aria-label={`View details for ${order.orderNumber}`}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
                              >
                                {isExpanded ? "Hide details" : "View Details"}
                              </button>
                              {cancellable ? (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelOrder(order)}
                                  disabled={cancellingId !== null}
                                  aria-label={`Cancel order ${order.orderNumber}`}
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/40 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isCancelling ? "Cancelling…" : "Cancel Order"}
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && detailsOrder && (
                          <tr key={`${order.id}-details`} className="bg-zinc-50/60">
                            <td colSpan={9} className="px-4 py-4">
                              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Order number
                                  </dt>
                                  <dd className="mt-0.5 font-mono text-xs font-semibold text-zinc-900">
                                    {order.orderNumber}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Buyer
                                  </dt>
                                  <dd className="mt-0.5 truncate text-xs text-zinc-800">
                                    {order.buyerEmail}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Items
                                  </dt>
                                  <dd className="mt-0.5 text-xs text-zinc-800">
                                    {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Amount
                                  </dt>
                                  <dd className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-900">
                                    {formatInr(order.totalPaise)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Payment status
                                  </dt>
                                  <dd className="mt-0.5">
                                    <Badge
                                      label={formatPaymentStatus(order.paymentStatus)}
                                      tone={paymentTone(order.paymentStatus)}
                                    />
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Payment method
                                  </dt>
                                  <dd className="mt-0.5 text-xs text-zinc-800">
                                    {formatPaymentMethod(order.paymentMethod)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Fulfillment status
                                  </dt>
                                  <dd className="mt-0.5">
                                    <Badge
                                      label={formatOrderStatus(order.status)}
                                      tone={statusTone(order.status)}
                                    />
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Placed
                                  </dt>
                                  <dd className="mt-0.5 text-xs text-zinc-800">
                                    {new Date(order.createdAt).toLocaleString("en-IN")}
                                  </dd>
                                </div>
                              </dl>

                              {(order.firmAllocations ?? []).length > 0 && (
                                <div className="mt-4 border-t border-zinc-200 pt-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                    Firm allocations
                                  </p>
                                  <ul className="mt-1.5 flex flex-wrap gap-2">
                                    {(order.firmAllocations ?? []).map((allocation) => (
                                      <li
                                        key={allocation.firmOrderId}
                                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
                                      >
                                        <span className="font-semibold">{allocation.firmName}</span>
                                        {allocation.firmCode ? ` · ${allocation.firmCode}` : ""}
                                        {typeof allocation.amountPaise === "number"
                                          ? ` · ${formatInr(allocation.amountPaise)}`
                                          : ""}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!loading && visible.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Showing {visible.length} of {orders.length} loaded orders
            {filter === "active" && cancelled > 0
              ? ` · ${cancelled} cancelled order${cancelled === 1 ? "" : "s"} in the bin`
              : ""}
          </p>
        )}
      </div>
    </div>
  );
}
