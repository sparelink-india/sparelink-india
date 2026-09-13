"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPaise: number;
  createdAt: string;
  items: {
    id: string;
    partName: string;
    partNumber: string;
    quantity: number;
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
              <div className="mt-5 border-t border-zinc-100 pt-4 text-sm">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 py-1"
                  >
                    <span>
                      {item.partName}{" "}
                      <span className="text-zinc-500">× {item.quantity}</span>
                    </span>
                    <span>
                      ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                {order.paymentMethod === "cash_on_delivery"
                  ? "Cash on delivery"
                  : `Online payment: ${statusLabel(order.paymentStatus)}`}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
