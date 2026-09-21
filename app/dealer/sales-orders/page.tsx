"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type SO = {
  id: string;
  soNumber: string;
  status: string;
  partyName: string;
  totalPaise: number;
  createdAt: string;
};

type SearchHit = {
  partNumber: string | null;
  name: string | null;
  listing: { listingId: string; partName: string; pricePaise: number } | null;
};

export default function DealerSalesOrdersPage() {
  const [orders, setOrders] = useState<SO[]>([]);
  const [error, setError] = useState("");
  const [partyName, setPartyName] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [lines, setLines] = useState<
    Array<{ dealerListingId: string; quantity: number; label: string }>
  >([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch("/api/dealer/sales-orders", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setOrders(d.salesOrders);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load().catch((e) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const search = async () => {
    const r = await fetch(
      `/api/b2b/product-search?q=${encodeURIComponent(q.trim())}`,
      { cache: "no-store" },
    );
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Search failed");
      return;
    }
    setHits(d.hits ?? []);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/dealer/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName: partyName || undefined,
          items: lines.map((l) => ({
            dealerListingId: l.dealerListingId,
            quantity: l.quantity,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLines([]);
      setPartyName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-4">
          <Link href="/dealer" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Dealer sales orders</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">B2B sales orders</h1>
          <Link href="/dealer" className="text-sm text-blue-600 hover:underline">
            Back
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <form onSubmit={create} className="mt-8 space-y-3 rounded-xl border bg-white p-6">
          <input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder="Party name (defaults to your business)"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search parts..."
              className="flex-1 rounded border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void search()}
              className="rounded border px-3 py-2 text-sm"
            >
              Search
            </button>
          </div>
          {hits.map((h, i) => (
            <button
              key={i}
              type="button"
              disabled={!h.listing}
              onClick={() => {
                if (!h.listing) return;
                setLines((prev) => [
                  ...prev,
                  {
                    dealerListingId: h.listing!.listingId,
                    quantity: 1,
                    label: `${h.partNumber} · ${h.listing!.partName}`,
                  },
                ]);
              }}
              className="block w-full rounded border px-2 py-1 text-left text-sm disabled:opacity-40"
            >
              {h.partNumber} · {h.name}
            </button>
          ))}
          {lines.map((l, i) => (
            <div key={`${l.dealerListingId}-${i}`} className="flex gap-2 text-sm">
              <span className="flex-1">{l.label}</span>
              <input
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, quantity: Number(e.target.value) } : x,
                    ),
                  )
                }
                className="w-20 rounded border px-2"
              />
            </div>
          ))}
          <button
            disabled={saving || !lines.length}
            className="rounded bg-zinc-950 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Create draft SO
          </button>
        </form>
        <div className="mt-8 space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex justify-between rounded-xl border bg-white p-4 text-sm"
            >
              <span>
                <b>{o.soNumber}</b> · {o.partyName} · {o.status}
              </span>
              <span>₹{(o.totalPaise / 100).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
