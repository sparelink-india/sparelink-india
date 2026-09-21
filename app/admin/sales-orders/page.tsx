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
  listing: {
    listingId: string;
    pricePaise: number;
    stock: number;
    partName: string;
  } | null;
};

type LineDraft = {
  dealerListingId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  pricePaise: number;
};

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SO[]>([]);
  const [error, setError] = useState("");
  const [partyName, setPartyName] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch("/api/admin/sales-orders", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setOrders(d.salesOrders);
  };

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed"),
    );
  }, []);

  const search = async () => {
    if (!q.trim()) return;
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

  const addLine = (hit: SearchHit) => {
    if (!hit.listing) return;
    setLines((prev) => {
      const existing = prev.find(
        (l) => l.dealerListingId === hit.listing!.listingId,
      );
      if (existing) {
        return prev.map((l) =>
          l.dealerListingId === hit.listing!.listingId
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          dealerListingId: hit.listing!.listingId,
          partNumber: hit.partNumber || "",
          partName: hit.listing!.partName || hit.name || "",
          quantity: 1,
          pricePaise: hit.listing!.pricePaise,
        },
      ];
    });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName,
          status: "draft",
          items: lines.map((l) => ({
            dealerListingId: l.dealerListingId,
            quantity: l.quantity,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPartyName("");
      setLines([]);
      setHits([]);
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
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Sales Orders</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Sales Orders</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={create} className="mt-8 space-y-4 rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold">Create draft SO</h2>
          <input
            required
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder="Party name *"
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
          {hits.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto border p-2 text-sm">
              {hits.map((h, i) => (
                <button
                  key={`${h.partNumber}-${i}`}
                  type="button"
                  disabled={!h.listing}
                  onClick={() => addLine(h)}
                  className="flex w-full justify-between rounded px-2 py-1 text-left hover:bg-zinc-100 disabled:opacity-40"
                >
                  <span>
                    {h.partNumber} · {h.name || h.listing?.partName}
                  </span>
                  <span>
                    {h.listing
                      ? `₹${(h.listing.pricePaise / 100).toFixed(2)} · stock ${h.listing.stock}`
                      : "No listing"}
                  </span>
                </button>
              ))}
            </div>
          )}
          {lines.length > 0 && (
            <ul className="space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.dealerListingId} className="flex items-center gap-3">
                  <span className="flex-1">
                    {l.partNumber} · {l.partName}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.dealerListingId === l.dealerListingId
                            ? { ...x, quantity: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                    className="w-20 rounded border px-2 py-1"
                  />
                  <span>₹{((l.pricePaise * l.quantity) / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            disabled={saving || !lines.length}
            className="rounded bg-zinc-950 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create draft"}
          </button>
        </form>

        <div className="mt-10 space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {o.soNumber} · {o.partyName}
                </p>
                <p className="text-xs text-zinc-500">
                  {o.status} ·{" "}
                  {new Date(o.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span>₹{(o.totalPaise / 100).toLocaleString("en-IN")}</span>
                <a
                  href={`/api/admin/sales-orders/${o.id}/excel`}
                  className="text-blue-600 hover:underline"
                >
                  CSV
                </a>
              </div>
            </div>
          ))}
          {!orders.length && (
            <p className="text-sm text-zinc-500">No sales orders yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
