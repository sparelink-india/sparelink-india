"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Allocation = {
  id: string;
  orderNumber: string;
  firmName: string;
  allocationNumber: string;
  amountPaise: number;
  fulfillmentStatus: string;
  itemCount: number;
  createdAt: string;
};

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/allocations", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setAllocations(d.allocations);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load allocations.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Order Allocations</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Firm Order Allocations</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Regional distributor allocations (Ambaji Traders, Hind Motors, India Sales)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/admin/allocations/export"
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
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">
            Loading allocations...
          </p>
        )}

        {!loading && allocations.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order #</th>
                  <th className="px-4 py-3 font-semibold">Allocation #</th>
                  <th className="px-4 py-3 font-semibold">Firm</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {a.orderNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.allocationNumber}
                    </td>
                    <td className="px-4 py-3 font-medium">{a.firmName}</td>
                    <td className="px-4 py-3 text-xs">{a.itemCount} items</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          a.fulfillmentStatus === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : a.fulfillmentStatus === "fulfilled"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {a.fulfillmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ₹{(a.amountPaise / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {new Date(a.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && allocations.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No allocations found.</p>
        )}
      </div>
    </main>
  );
}
