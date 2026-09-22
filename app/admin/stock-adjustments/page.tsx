"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Adjustment = {
  id: string;
  partNumber: string | null;
  partName: string | null;
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  reason: string;
  warehouseCode: string;
  createdAt: string;
};

export default function StockAdjustmentsPage() {
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/stock-adjustments", {
          cache: "no-store",
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setRows(d.adjustments);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      }
    };
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Stock Adjustments</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Stock Adjustments</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-8 space-y-3">
          {rows.map((a) => (
            <div key={a.id} className="rounded-lg border bg-white p-4 text-sm">
              <p className="font-semibold">
                {a.partNumber || "—"} · {a.partName || "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {a.previousQuantity} → {a.newQuantity} (Δ {a.delta}) ·{" "}
                {a.warehouseCode} · {a.reason}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {new Date(a.createdAt).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
          {!rows.length && !error && (
            <p className="text-sm text-zinc-500">No adjustments yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
