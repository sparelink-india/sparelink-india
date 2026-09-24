"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Summary = {
  dealerId: string;
  businessName: string;
  creditLimitPaise: number;
  outstandingPaise: number;
  availableCreditPaise: number | null;
  creditEnforcementEnabled: boolean;
};

type LedgerEntry = {
  id: string;
  entryType: string;
  amountPaise: number;
  balanceAfterPaise: number;
  notes: string | null;
  createdAt: string;
};

export default function CreditAdminPage() {
  const [dealers, setDealers] = useState<Summary[]>([]);
  const [selected, setSelected] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [creditLimitPaise, setCreditLimitPaise] = useState(0);
  const [entryType, setEntryType] = useState("payment");
  const [amountPaise, setAmountPaise] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDealers = useCallback(async () => {
    const r = await fetch("/api/admin/credit", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setDealers(d.dealers);
    if (!selected && d.dealers[0]) setSelected(d.dealers[0].dealerId);
  }, [selected]);

  const loadDealer = useCallback(async (dealerId: string) => {
    const r = await fetch(`/api/admin/credit?dealerId=${encodeURIComponent(dealerId)}`, {
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setSummary(d.summary);
    setLedger(d.ledger);
    setCreditLimitPaise(d.summary.creditLimitPaise);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadDealers().catch((e) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadDealers]);

  useEffect(() => {
    if (!selected) return;
    const t = window.setTimeout(() => {
      void loadDealer(selected).catch((e) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadDealer, selected]);

  const saveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/credit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_credit_limit",
          dealerId: selected,
          creditLimitPaise,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSummary(d.summary);
      await loadDealers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const postEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/credit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "post_entry",
          dealerId: selected,
          entryType,
          amountPaise,
          signedAmountPaise: entryType === "adjustment" ? amountPaise : undefined,
          notes,
          idempotencyKey: `admin-${selected}-${entryType}-${amountPaise}-${Date.now()}`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSummary(d.summary);
      setNotes("");
      setAmountPaise(0);
      await loadDealer(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
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
          <span className="text-sm">Credit / Outstanding</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Credit Ledger</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Outstanding is derived from ledger entries. Existing dealers start at
          zero until authorized entries are posted. Limit 0 = enforcement off.
        </p>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-6">
            <label className="text-sm font-semibold">Dealer</label>
            <select
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {dealers.map((d) => (
                <option key={d.dealerId} value={d.dealerId}>
                  {d.businessName} · outstanding ₹
                  {(d.outstandingPaise / 100).toFixed(2)}
                </option>
              ))}
            </select>

            {summary && (
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  Limit: ₹{(summary.creditLimitPaise / 100).toFixed(2)}{" "}
                  {summary.creditEnforcementEnabled
                    ? "(enforced)"
                    : "(not enforced)"}
                </p>
                <p>Outstanding: ₹{(summary.outstandingPaise / 100).toFixed(2)}</p>
                <p>
                  Available:{" "}
                  {summary.availableCreditPaise === null
                    ? "n/a"
                    : `₹${(summary.availableCreditPaise / 100).toFixed(2)}`}
                </p>
              </div>
            )}

            <form onSubmit={saveLimit} className="mt-6 flex gap-2">
              <input
                type="number"
                min={0}
                value={creditLimitPaise}
                onChange={(e) => setCreditLimitPaise(Number(e.target.value))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="credit limit paise"
              />
              <button
                disabled={saving || !selected}
                className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Set limit
              </button>
            </form>
          </div>

          <form
            onSubmit={postEntry}
            className="rounded-lg border bg-white p-6 space-y-3"
          >
            <h2 className="font-semibold">Post ledger entry</h2>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="payment">payment</option>
              <option value="credit">credit</option>
              <option value="debit">debit</option>
              <option value="adjustment">adjustment (signed)</option>
            </select>
            <input
              type="number"
              value={amountPaise}
              onChange={(e) => setAmountPaise(Number(e.target.value))}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="amount paise"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="notes / reference"
            />
            <button
              disabled={saving || !selected}
              className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Post entry
            </button>
          </form>
        </div>

        <h2 className="mt-10 text-xl font-semibold">Ledger</h2>
        <div className="mt-3 space-y-2">
          {ledger.map((e) => (
            <div key={e.id} className="rounded border bg-white p-3 text-sm">
              <p className="font-semibold">
                {e.entryType} · ₹{(e.amountPaise / 100).toFixed(2)} · bal ₹
                {(e.balanceAfterPaise / 100).toFixed(2)}
              </p>
              <p className="text-xs text-zinc-500">
                {e.notes || "—"} · {new Date(e.createdAt).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
          {!ledger.length && (
            <p className="text-sm text-zinc-500">No ledger entries.</p>
          )}
        </div>
      </div>
    </main>
  );
}
