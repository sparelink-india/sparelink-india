"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Report = {
  salesOrders: number;
  purchaseOrders: number;
  quotations: number;
  suppliers: number;
  lowStock: number;
  stockAdjustments: number;
};

type Adjustment = {
  id: string;
  partNumber: string | null;
  partName: string | null;
  previousQuantity: number;
  newQuantity: number;
  delta: number;
  reason: string;
  createdAt: string;
};

export default function B2bReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch("/api/admin/reports/b2b", { cache: "no-store" }),
          fetch("/api/admin/stock-adjustments", { cache: "no-store" }),
        ]);
        const d1 = await r1.json();
        const d2 = await r2.json();
        if (!r1.ok) throw new Error(d1.error);
        if (!r2.ok) throw new Error(d2.error);
        setReport(d1);
        setAdjustments(d2.adjustments);
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
          <span className="text-sm">B2B Reports</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">B2B Reports</h1>
          <div className="flex gap-4">
            <a
              href="/api/admin/exports/busy-ready"
              className="text-sm text-blue-600 hover:underline"
            >
              BUSY-ready CSV
            </a>
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">
              Back to Admin
            </Link>
          </div>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {report && (
          <div className="mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Sales Orders", report.salesOrders],
                ["Purchase Orders", report.purchaseOrders],
                ["Quotations", report.quotations],
                ["Suppliers", report.suppliers],
                ["Low stock (<5)", report.lowStock],
                ["Stock adjustments", report.stockAdjustments],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-white p-4">
                <p className="text-xs text-zinc-600">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        )}
        <h2 className="mt-10 text-xl font-semibold">Recent stock adjustments</h2>
        <div className="mt-4 space-y-2">
          {adjustments.map((a) => (
            <div key={a.id} className="rounded-lg border bg-white p-4 text-sm">
              <p className="font-medium">
                {a.partNumber || "—"} · {a.partName || "—"}
              </p>
              <p className="text-xs text-zinc-600">
                {a.previousQuantity} → {a.newQuantity} (Δ {a.delta}) · {a.reason}
              </p>
            </div>
          ))}
          {!adjustments.length && (
            <p className="text-sm text-zinc-500">No adjustments yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
