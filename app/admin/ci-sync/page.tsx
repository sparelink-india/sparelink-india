"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Queues = {
  pendingApproval: number;
  sourceUpdated: number;
  sourceRemoved: number;
};

type SyncRun = {
  id: string;
  status: string;
  dryRun: boolean;
  fetchComplete: boolean;
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  sourceRemovedCount: number;
  approvalPendingCount: number;
  failedCount: number;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
};

type ApprovalItem = {
  id: string;
  sourceSku: string;
  name: string | null;
  brand: string | null;
  sourcePricePaise: number | null;
  sparelinkPricePaise: number | null;
  sourceStatus: string;
  approvalStatus: string;
  sourcePriceChanged: boolean;
  partId: string | null;
};

function formatPaise(paise: number | null | undefined) {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function AdminCiSyncPage() {
  const [queues, setQueues] = useState<Queues | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [pending, setPending] = useState<ApprovalItem[]>([]);
  const [updated, setUpdated] = useState<ApprovalItem[]>([]);
  const [removed, setRemoved] = useState<ApprovalItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [firmId, setFirmId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [priceById, setPriceById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const [statusRes, pendingRes, updatedRes, removedRes] = await Promise.all([
        fetch("/api/admin/ci-sync", { cache: "no-store" }),
        fetch("/api/admin/ci-sync/approvals?status=pending", { cache: "no-store" }),
        fetch("/api/admin/ci-sync/approvals?status=updated", { cache: "no-store" }),
        fetch("/api/admin/ci-sync/approvals?status=removed", { cache: "no-store" }),
      ]);
      const statusJson = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusJson.error || "Failed to load sync status");
      setQueues(statusJson.queues);
      setRuns(statusJson.recentRuns || []);

      const pendingJson = await pendingRes.json();
      if (pendingRes.ok) setPending(pendingJson.items || []);
      const updatedJson = await updatedRes.json();
      if (updatedRes.ok) setUpdated(updatedJson.items || []);
      const removedJson = await removedRes.json();
      if (removedRes.ok) setRemoved(removedJson.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load CI sync admin");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function runSync(dryRun: boolean) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/ci-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setMessage(
        `${dryRun ? "Dry-run" : "Sync"} ${json.status}: fetched ${json.fetchedCount}, new ${json.newCount}, updated ${json.updatedCount}, removed ${json.sourceRemovedCount}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function approveItem(item: ApprovalItem) {
    const raw = priceById[item.id];
    const rupees = Number(raw);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError("Enter a SpareLink selling price (₹) before approving");
      return;
    }
    if (!firmId.trim() || !dealerId.trim()) {
      setError("Firm ID and Dealer ID are required to create/activate a listing");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ci-sync/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceItemId: item.id,
          sellingPricePaise: Math.round(rupees * 100),
          firmId: firmId.trim(),
          dealerId: dealerId.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval failed");
      setMessage(
        `Approved ${item.sourceSku}: customer price ${formatPaise(json.sellingPricePaise)} (source ${formatPaise(json.sourcePricePaise)} admin-only)`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">CI Auto-Sync</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold">CI Source Sync & Approvals</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Source catalogue data stays separate from SpareLink selling price, stock, and
          publication. New CI products require explicit admin approval before customers can see
          them. Failed fetches never delete products.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-5">
            <p className="text-xs text-zinc-500">Pending approval</p>
            <p className="mt-2 text-2xl font-bold">{queues?.pendingApproval ?? "—"}</p>
          </div>
          <div className="rounded-lg border bg-white p-5">
            <p className="text-xs text-zinc-500">Source updated</p>
            <p className="mt-2 text-2xl font-bold">{queues?.sourceUpdated ?? "—"}</p>
          </div>
          <div className="rounded-lg border bg-white p-5">
            <p className="text-xs text-zinc-500">Source removed</p>
            <p className="mt-2 text-2xl font-bold">{queues?.sourceRemoved ?? "—"}</p>
          </div>
          <div className="rounded-lg border bg-white p-5">
            <p className="text-xs text-zinc-500">Actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runSync(true)}
                className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                Dry-run sync
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runSync(false)}
                className="rounded bg-amber-700 px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                Run sync
              </button>
            </div>
          </div>
        </div>

        <section className="mt-10 rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold">Approve pending (set SpareLink price)</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Firm ID
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={firmId}
                onChange={(e) => setFirmId(e.target.value)}
                placeholder="firm uuid"
              />
            </label>
            <label className="text-sm">
              Dealer ID
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={dealerId}
                onChange={(e) => setDealerId(e.target.value)}
                placeholder="dealer uuid"
              />
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Source ₹</th>
                  <th className="py-2 pr-3">SpareLink ₹</th>
                  <th className="py-2 pr-3">Approve</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => (
                  <tr key={item.id} className="border-b align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{item.sourceSku}</td>
                    <td className="py-2 pr-3">{item.name}</td>
                    <td className="py-2 pr-3">{formatPaise(item.sourcePricePaise)}</td>
                    <td className="py-2 pr-3">
                      <input
                        className="w-28 rounded border px-2 py-1"
                        placeholder="e.g. 528"
                        value={priceById[item.id] ?? ""}
                        onChange={(e) =>
                          setPriceById((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void approveItem(item)}
                        className="rounded bg-emerald-700 px-3 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-zinc-500">
                      No pending CI products.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Source price changed</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {updated.slice(0, 20).map((item) => (
                <li key={item.id} className="border-b pb-2">
                  <span className="font-mono text-xs">{item.sourceSku}</span> — {item.name}
                  <div className="text-xs text-zinc-500">
                    Source {formatPaise(item.sourcePricePaise)} · SpareLink{" "}
                    {formatPaise(item.sparelinkPricePaise)} (unchanged by sync)
                  </div>
                </li>
              ))}
              {updated.length === 0 && <li className="text-zinc-500">None</li>}
            </ul>
          </div>
          <div className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold">Source removed (product kept)</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {removed.slice(0, 20).map((item) => (
                <li key={item.id} className="border-b pb-2">
                  <span className="font-mono text-xs">{item.sourceSku}</span> — {item.name}
                  <div className="text-xs text-zinc-500">
                    SpareLink product retained · status SOURCE_REMOVED
                  </div>
                </li>
              ))}
              {removed.length === 0 && <li className="text-zinc-500">None</li>}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold">Recent sync runs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Fetched</th>
                  <th className="py-2 pr-3">New</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2 pr-3">Removed</th>
                  <th className="py-2 pr-3">Failed</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b">
                    <td className="py-2 pr-3 text-xs">
                      {new Date(run.startedAt).toLocaleString("en-IN")}
                      {run.dryRun ? " (dry)" : ""}
                    </td>
                    <td className="py-2 pr-3">{run.status}</td>
                    <td className="py-2 pr-3">{run.fetchedCount}</td>
                    <td className="py-2 pr-3">{run.newCount}</td>
                    <td className="py-2 pr-3">{run.updatedCount}</td>
                    <td className="py-2 pr-3">{run.sourceRemovedCount}</td>
                    <td className="py-2 pr-3">{run.failedCount}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-zinc-500">
                      No sync runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
