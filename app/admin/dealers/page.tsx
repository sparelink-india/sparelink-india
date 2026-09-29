"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconDealership } from "@/components/admin-icons";
import { AdminConfirmDialog } from "@/components/admin-ui";

type ApprovalStatus = "pending" | "approved" | "rejected";

type Dealer = {
  id: string;
  businessName: string;
  ownerName: string | null;
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  approvalStatus: ApprovalStatus | null;
  creditLimitPaise: number | null;
  priceGroup: string | null;
  rejectionReason: string | null;
  listingCount: number;
  createdAt: string;
};

const APPROVAL_TONE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

/**
 * The API returns `approvalStatus`, so a missing value is treated as awaiting
 * review rather than silently rendered as approved.
 */
function approvalOf(dealer: Dealer): string {
  const value = (dealer.approvalStatus ?? "").trim().toLowerCase();
  if (value === "approved" || value === "rejected") return value;
  return "pending";
}

function ApprovalBadge({ dealer }: { dealer: Dealer }) {
  const status = approvalOf(dealer);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
        APPROVAL_TONE[status] ?? APPROVAL_TONE.pending
      }`}
    >
      {status === "approved"
        ? "Approved"
        : status === "rejected"
          ? "Rejected"
          : "Awaiting approval"}
    </span>
  );
}

type PendingAction = { dealer: Dealer; action: "approve" | "reject" } | null;

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  // Same-tick guard: a double click must not send two PATCHes.
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/dealers", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDealers(Array.isArray(d.dealers) ? d.dealers : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load dealers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const awaiting = useMemo(
    () => dealers.filter((d) => approvalOf(d) === "pending").length,
    [dealers],
  );

  /**
   * Approve / reject through the EXISTING endpoint. No new route, no new verb:
   * `PATCH /api/admin/dealers` with `{ dealerId, action }`, which already
   * performs the role promotion and writes the audit row server-side.
   */
  async function runAction() {
    if (!pending || inFlightRef.current) return;
    const { dealer, action } = pending;
    inFlightRef.current = true;
    setBusyId(dealer.id);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/dealers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerId: dealer.id, action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "The action was rejected.");
      setNotice(
        action === "approve"
          ? `${dealer.businessName} approved.`
          : `${dealer.businessName} rejected.`,
      );
      setPending(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action could not be completed.");
    } finally {
      inFlightRef.current = false;
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Manage Dealers</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dealers</h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {notice}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading dealers...</p>
        )}

        {!loading && dealers.length > 0 && (
          <>
            {awaiting > 0 && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                <IconDealership className="h-4 w-4" />
                {awaiting} dealer{awaiting === 1 ? "" : "s"} awaiting approval
              </p>
            )}

            <div className="mt-8 space-y-4">
              {dealers.map((d) => {
                const status = approvalOf(d);
                const busy = busyId === d.id;
                return (
                  <div key={d.id} className="rounded-lg border bg-white p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{d.businessName}</h3>
                          <ApprovalBadge dealer={d} />
                        </div>
                        {d.ownerName && (
                          <p className="mt-1 text-xs text-zinc-600">
                            {d.ownerName}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-zinc-600">
                          {[d.city, d.state].filter(Boolean).join(", ") || "—"}
                        </p>
                        {d.email && (
                          <p className="mt-1 text-xs text-zinc-600">{d.email}</p>
                        )}
                        {d.phone && (
                          <p className="mt-1 text-xs text-zinc-600">{d.phone}</p>
                        )}
                        {d.gstin && (
                          <p className="mt-1 text-xs text-zinc-600">
                            GSTIN: {d.gstin}
                          </p>
                        )}
                        {d.pan && (
                          <p className="mt-1 text-xs text-zinc-600">PAN: {d.pan}</p>
                        )}
                        {status === "rejected" && d.rejectionReason && (
                          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                            Rejected: {d.rejectionReason}
                          </p>
                        )}
                      </div>
                      <div className="md:text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {d.listingCount}
                        </p>
                        <p className="text-xs text-zinc-600">Active Listings</p>
                        {d.creditLimitPaise !== null &&
                          d.creditLimitPaise !== undefined && (
                            <p className="mt-2 text-xs text-zinc-500">
                              Credit limit: ₹
                              {(d.creditLimitPaise / 100).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          )}
                        {d.priceGroup && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Price group: {d.priceGroup}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-zinc-500">
                          Joined{" "}
                          {new Date(d.createdAt).toLocaleDateString("en-IN")}
                        </p>

                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          {status !== "approved" && (
                            <button
                              type="button"
                              disabled={busy || busyId !== null}
                              onClick={() => setPending({ dealer: d, action: "approve" })}
                              className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {busy ? "Working…" : "Approve"}
                            </button>
                          )}
                          {status !== "rejected" && (
                            <button
                              type="button"
                              disabled={busy || busyId !== null}
                              onClick={() => setPending({ dealer: d, action: "reject" })}
                              className="rounded border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              {busy ? "Working…" : "Reject"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && dealers.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No dealers found.</p>
        )}
      </div>

      <AdminConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void runAction()}
        title={pending?.action === "approve" ? "Approve this dealer?" : "Reject this dealer?"}
        confirmLabel={pending?.action === "approve" ? "Approve dealer" : "Reject dealer"}
        busy={busyId !== null}
        description={
          pending ? (
            <span className="space-y-2">
              <span className="block">
                {pending.action === "approve"
                  ? `Approve ${pending.dealer.businessName}? Approving also grants the dealer's account the dealer role.`
                  : `Reject ${pending.dealer.businessName}? The dealer will be marked rejected and cannot trade until re-approved.`}
              </span>
              <span className="block text-xs text-zinc-500">
                This uses the existing dealer approval endpoint and is written to
                the audit trail.
              </span>
            </span>
          ) : null
        }
      />
    </main>
  );
}
