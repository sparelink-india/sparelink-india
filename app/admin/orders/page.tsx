"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { InvoiceDownloadLinks } from "@/components/invoice-download-links";
import {
  applyCancelledStatus,
  buildOrderCancellationConfirmation,
  buildOrderCancellationPayload,
  isOrderCancellationAllowed,
  ORDER_CANCELLATION_PATH,
  orderCancellationErrorMessage,
  orderCancellationSuccessMessage,
  readRestockedLines,
} from "@/lib/admin-order-cancellation";

type FirmAllocation = {
  firmOrderId: string;
  firmName: string;
  firmCode?: string;
  amountPaise?: number;
};

type OrderItem = {
  id: string;
  orderNumber: string;
  buyerEmail: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  itemCount: number;
  createdAt: string;
  firmAllocations?: FirmAllocation[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  // Order id currently being cancelled, used to disable the row's action and
  // prevent a double submit.
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadOrders = async () => {
    const r = await fetch("/api/admin/orders", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setOrders(d.orders);
  };

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
  }, []);

  /**
   * Cancel one order through the EXISTING `PATCH /api/admin/orders` endpoint.
   *
   * The body is built by buildOrderCancellationPayload, which sends only
   * `orderId` and `status: "cancelled"`. `paymentStatus` is never included:
   * payment state can only move through the verified payment or manual
   * bank-transfer workflows, and the API rejects it.
   */
  const handleCancelOrder = async (order: OrderItem) => {
    if (cancellingId) return;
    if (!isOrderCancellationAllowed(order)) return;
    if (!window.confirm(buildOrderCancellationConfirmation(order))) return;

    setCancellingId(order.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(ORDER_CANCELLATION_PATH, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Re-read the list from the server so inventory and firm allocation
        // reflect the committed cancellation.
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

      // Reflect the new state immediately, then confirm against the server.
      setOrders((current) => applyCancelledStatus(current, order.id));
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
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Orders</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customer Orders</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Review placed orders, fulfillment status, and export GST summaries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/admin/orders/export"
              download
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100 transition-colors"
            >
              <span>📊</span> Export to Excel (.xlsx)
            </a>
            <Link
              href="/admin"
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <span aria-hidden="true" className="font-bold">
              ✕
            </span>
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            <span aria-hidden="true" className="font-bold">
              ✓
            </span>
            <span>{notice}</span>
          </div>
        )}

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading orders...</p>
        )}

        {!loading && orders.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order #</th>
                  <th className="px-4 py-3 font-semibold">Buyer</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Invoice</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-xs">{o.buyerEmail}</td>
                    <td className="px-4 py-3 text-xs">{o.itemCount} items</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          o.paymentStatus === "paid"
                            ? "bg-green-100 text-green-700"
                            : o.paymentStatus === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ₹{(o.totalPaise / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InvoiceDownloadLinks
                        orderId={o.id}
                        allocations={o.firmAllocations ?? []}
                        className="inline-flex flex-wrap justify-end gap-1.5"
                        linkClassName="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                        singleLabel="🧾 Invoice"
                        multiLabelPrefix="🧾"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOrderCancellationAllowed(o) ? (
                        <button
                          type="button"
                          onClick={() => void handleCancelOrder(o)}
                          disabled={cancellingId !== null}
                          aria-label={`Cancel order ${o.orderNumber}`}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cancellingId === o.id ? "Cancelling…" : "Cancel Order"}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No orders found.</p>
        )}
      </div>
    </main>
  );
}
