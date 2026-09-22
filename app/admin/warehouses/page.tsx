"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};

export default function WarehousesPage() {
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/warehouses", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setRows(d.warehouses);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load().catch((e) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const ensureMain = async () => {
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/warehouses", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(d.created ? "MAIN warehouse created." : "MAIN already exists.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Warehouses</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Warehouses</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={() => void ensureMain()}
          className="mt-6 rounded bg-zinc-950 px-4 py-2 text-sm text-white"
        >
          Ensure MAIN warehouse
        </button>
        <div className="mt-8 space-y-3">
          {rows.map((w) => (
            <div key={w.id} className="rounded-lg border bg-white p-4">
              <p className="font-semibold">
                {w.code} — {w.name}
              </p>
              <p className="text-xs text-zinc-500">
                {w.isActive ? "Active" : "Inactive"}
              </p>
            </div>
          ))}
          {!rows.length && (
            <p className="text-sm text-zinc-500">No warehouses yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
