"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type QT = {
  id: string;
  quotationNumber: string;
  status: string;
  partyName: string;
  totalPaise: number;
  convertedSalesOrderId: string | null;
  createdAt: string;
};

type SearchHit = {
  partNumber: string | null;
  name: string | null;
  listing: {
    listingId: string;
    pricePaise: number;
    partName: string;
  } | null;
};

type LineDraft = {
  dealerListingId: string;
  partNumber: string;
  partName: string;
  quantity: number;
};

export default function QuotationsPage() {
  const [rows, setRows] = useState<QT[]>([]);
  const [error, setError] = useState("");
  const [partyName, setPartyName] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [busy, setBusy] = useState("");

  const load = async () => {
    const r = await fetch("/api/admin/quotations", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setRows(d.quotations);
  };

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed"),
    );
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
    setBusy("create");
    setError("");
    try {
      const r = await fetch("/api/admin/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName,
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy("");
    }
  };

  const convert = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const r = await fetch(`/api/admin/quotations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
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
          <span className="text-sm">Quotations</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Quotations</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <form onSubmit={create} className="mt-8 space-y-3 rounded-lg border bg-white p-6">
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
                    partNumber: h.partNumber || "",
                    partName: h.listing!.partName,
                    quantity: 1,
                  },
                ]);
              }}
              className="block w-full rounded border px-2 py-1 text-left text-sm hover:bg-zinc-50 disabled:opacity-40"
            >
              {h.partNumber} · {h.name}
            </button>
          ))}
          {lines.map((l) => (
            <div key={l.dealerListingId} className="flex gap-2 text-sm">
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
                className="w-20 rounded border px-2"
              />
            </div>
          ))}
          <button
            disabled={busy === "create" || !lines.length}
            className="rounded bg-zinc-950 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Create quotation
          </button>
        </form>
        <div className="mt-8 space-y-3">
          {rows.map((qrow) => (
            <div
              key={qrow.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {qrow.quotationNumber} · {qrow.partyName}
                </p>
                <p className="text-xs text-zinc-500">{qrow.status}</p>
              </div>
              <div className="flex gap-3">
                <span>₹{(qrow.totalPaise / 100).toLocaleString("en-IN")}</span>
                <a
                  href={`/api/admin/quotations/${qrow.id}/excel`}
                  className="text-blue-600 hover:underline"
                >
                  CSV
                </a>
                {!qrow.convertedSalesOrderId && qrow.status !== "converted" && (
                  <button
                    type="button"
                    disabled={busy === qrow.id}
                    onClick={() => void convert(qrow.id)}
                    className="text-green-700 hover:underline"
                  >
                    Convert → SO
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
