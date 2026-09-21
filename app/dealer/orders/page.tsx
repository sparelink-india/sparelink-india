"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type OrderLine = {
  orderItemId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  partNumber: string;
  partName: string;
  quantity: number;
  totalPaise: number;
  createdAt: string;
};

export default function DealerOrdersPage() {
  const [orders, setOrders] = useState<OrderLine[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/dealer/orders", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setOrders(d.orders);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      }
    };
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-4">
          <Link href="/dealer" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Dealer orders</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Order lines</h1>
          <Link href="/dealer" className="text-sm text-blue-600 hover:underline">
            Back
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-8 space-y-2">
          {orders.map((o) => (
            <div
              key={o.orderItemId}
              className="flex justify-between rounded-xl border bg-white p-4 text-sm"
            >
              <span>
                <b>#{o.orderNumber}</b> · {o.partNumber} · {o.partName} ×{" "}
                {o.quantity}
              </span>
              <span>
                ₹{(o.totalPaise / 100).toLocaleString("en-IN")} ·{" "}
                {o.orderStatus}
              </span>
            </div>
          ))}
          {!orders.length && !error && (
            <p className="text-sm text-zinc-500">No order lines yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
