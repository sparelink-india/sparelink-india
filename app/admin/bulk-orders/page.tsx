"use client";
import Link from "next/link";
import { useState } from "react";

type ResultRow = {
  partNumber: string;
  quantity: number;
  ok: boolean;
  error?: string;
  partName?: string;
  unitPricePaise?: number;
  lineTotalPaise?: number;
};

export default function BulkOrdersPage() {
  const [text, setText] = useState("");
  const [partyName, setPartyName] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const parseRows = () =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [partNumber, qty] = line.split(/[,\t ]+/);
        return {
          partNumber: (partNumber || "").trim(),
          quantity: Number(qty || 1),
        };
      });

  const run = async (action: "validate" | "confirm") => {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/bulk-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          partyName,
          rows: parseRows(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResults(d.results ?? []);
      if (action === "confirm" && d.soNumber) {
        setMessage(`Created draft SO ${d.soNumber}`);
      } else if (d.ok) {
        setMessage("All rows validated against active listings.");
      } else {
        setMessage("Some rows failed validation.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Bulk Orders</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Bulk Orders</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          One part per line: <code>PARTNUMBER,qty</code>. Never invents products.
        </p>
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
        <div className="mt-8 space-y-3 rounded-lg border bg-white p-6">
          <input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder="Party name (required for confirm)"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"ABC123,2\nDEF456,1"}
            className="w-full rounded border px-3 py-2 font-mono text-sm"
          />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void run("validate")}
              className="rounded border px-4 py-2 text-sm"
            >
              Validate
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void run("confirm")}
              className="rounded bg-zinc-950 px-4 py-2 text-sm text-white"
            >
              Confirm → draft SO
            </button>
          </div>
        </div>
        {results.length > 0 && (
          <div className="mt-6 space-y-2 text-sm">
            {results.map((r, i) => (
              <div
                key={`${r.partNumber}-${i}`}
                className={`rounded border p-3 ${r.ok ? "bg-white" : "bg-red-50"}`}
              >
                {r.partNumber} × {r.quantity}
                {r.ok
                  ? ` · ${r.partName} · ₹${((r.lineTotalPaise || 0) / 100).toFixed(2)}`
                  : ` · ${r.error}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
