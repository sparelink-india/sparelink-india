"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

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
};

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load orders.");
        setOrders(data.orders);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load orders.",
        );
      } finally {
        setLoading(false);
      }
    }
    void loadOrders();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            SpareLink India
          </Link>
          <Link
            href="/cart"
            className="text-sm font-medium hover:text-zinc-600"
          >
            Cart
          </Link>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">My orders</h1>
        {loading && (
          <p className="mt-8 text-sm text-zinc-500">Loading your orders...</p>
        )}
        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <h2 className="font-semibold">No orders yet</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Your completed checkout orders will appear here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
            >
              Find parts
            </Link>
          </div>
        )}
        <section className="mt-8 space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">#{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Placed{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium">
                    {statusLabel(order.status)}
                  </span>
                  <p className="mt-2 font-bold">
                    ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-zinc-100 pt-4 text-xs space-y-1.5">
                <p className="font-semibold text-zinc-900 text-sm mb-2">
                  Items Ordered
                </p>
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 py-0.5 text-zinc-700"
                  >
                    <span>
                      {item.partName}{" "}
                      <span className="font-mono text-zinc-400">
                        (#{item.partNumber})
                      </span>{" "}
                      <span className="text-zinc-500 font-semibold">
                        × {item.quantity}
                      </span>
                    </span>
                    <span className="font-medium text-zinc-900">
                      ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}

                <div className="mt-4 border-t border-dashed border-zinc-200 pt-3 space-y-1 text-xs">
                  {order.subtotalPaise !== undefined && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Items Subtotal</span>
                      <span>
                        ₹{(order.subtotalPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {order.gstPaise !== undefined && order.gstPaise > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>GST / Taxes</span>
                      <span className="text-emerald-700 font-medium">
                        ₹{(order.gstPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-zinc-500">
                    <span>Shipping</span>
                    <span className="text-emerald-700 font-medium">
                      {(order.shippingPaise ?? 0) === 0
                        ? "₹0 (Free Standard)"
                        : `₹${((order.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold text-sm text-zinc-900">
                    <span>Total Paid</span>
                    <span>
                      ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3.5">
                <p className="text-xs text-zinc-500">
                  Payment:{" "}
                  {order.paymentMethod === "cash_on_delivery"
                    ? "Cash on delivery"
                    : order.paymentMethod === "bank_transfer"
                      ? "Bank / UPI Transfer"
                      : "Online payment"}{" "}
                  ({order.paymentStatus === "paid"
                    ? "Paid"
                    : order.paymentStatus === "partial"
                      ? "Partially Paid"
                      : "Pending"})
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {order.paymentMethod !== "cash_on_delivery" &&
                    order.paymentStatus !== "paid" && (
                    <Link
                      href={`/orders/${order.id}/payment`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      Payment details
                    </Link>
                  )}
                  <a
                    href={`/api/orders/${order.id}/invoice`}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <span>📄</span> Download PDF
                  </a>
                  <a
                    href={`/api/orders/${order.id}/excel`}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    <span>📊</span> Download Excel
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `SpareLink India Order #${order.orderNumber} status inquiry: Total ₹${(order.totalPaise / 100).toLocaleString("en-IN")}, Status: ${statusLabel(order.status)}.`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <span>💬</span> WhatsApp
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
