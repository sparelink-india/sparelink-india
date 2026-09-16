/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type GatewayPayment = {
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amountPaise: number;
  status: string;
  gatewayStatus: string | null;
  paidAt: string | null;
  failedAt: string | null;
};

type ManualSubmission = {
  id: string;
  firmOrderId: string | null;
  amountPaise: number;
  utrReference: string;
  status: string;
  paymentDate: string;
  adminNote: string | null;
};

type Allocation = {
  firmOrderId: string;
  firmId: string;
  firmName: string;
  firmCode: string;
  allocationNumber: string;
  amountPaise: number;
  paymentStatus: string;
  gatewayPayment: GatewayPayment | null;
  manualSubmissions: ManualSubmission[];
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPaise: number;
  createdAt: string;
  shippingName: string;
  shippingPhone: string;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string | null;
  allocations: Allocation[];
};

function formatRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parentPaymentLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partially Paid";
  return "Pending";
}

export default function AdminPaymentsPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<{
    id: string;
    orderNumber: string;
    utrReference: string;
    amountPaise: number;
    firmName: string;
    allocationNumber: string;
  } | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [adminNote, setAdminNote] = useState("");

  async function loadOrders() {
    try {
      setError("");
      const res = await fetch("/api/admin/payments", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments.");
      setOrders(data.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  async function handleConfirmReview() {
    if (!activeSubmission) return;
    setProcessingId(activeSubmission.id);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/payments/manual", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: activeSubmission.id,
          action: actionType,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process review.");
      setSuccessMsg(data.message || "UTR review updated.");
      setActiveSubmission(null);
      setAdminNote("");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setProcessingId(null);
    }
  }

  const filtered = orders.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.orderNumber.toLowerCase().includes(q) ||
      item.shippingName.toLowerCase().includes(q) ||
      item.buyerEmail.toLowerCase().includes(q) ||
      item.buyerName?.toLowerCase().includes(q) ||
      item.allocations.some(
        (allocation) =>
          allocation.firmName.toLowerCase().includes(q) ||
          allocation.allocationNumber.toLowerCase().includes(q) ||
          allocation.manualSubmissions.some((submission) =>
            submission.utrReference.toLowerCase().includes(q),
          ),
      )
    );
  });

  const pendingUtrs = orders.reduce(
    (count, item) =>
      count +
      item.allocations.reduce(
        (inner, allocation) =>
          inner +
          allocation.manualSubmissions.filter(
            (submission) => submission.status === "submitted",
          ).length,
        0,
      ),
    0,
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm font-semibold text-zinc-600">Payments</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Parent order status and per-firm allocations. UTR approval only
              affects that allocation.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-blue-600">
            ← Back to Admin
          </Link>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {successMsg}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Pending UTR reviews
            </span>
            <p className="mt-1 text-2xl font-black text-amber-950">{pendingUtrs}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Orders
            </span>
            <p className="mt-1 text-2xl font-black text-zinc-900">
              {orders.length}
            </p>
          </div>
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search order, customer, firm, UTR..."
          className="mt-8 h-10 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none"
        />

        {loading ? (
          <p className="mt-8 text-sm text-zinc-500">Loading payments...</p>
        ) : (
          <div className="mt-6 space-y-4">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-col gap-2 border-b border-zinc-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono font-bold">#{item.orderNumber}</p>
                    <p className="text-sm text-zinc-600">
                      {item.shippingName} · {item.shippingPhone || item.buyerPhone || item.buyerEmail}
                    </p>
                  </div>
                  <div className="text-left sm:text-right text-sm">
                    <p className="font-bold">{formatRupees(item.totalPaise)}</p>
                    <p className="text-xs text-zinc-500">
                      {item.paymentMethod} · {parentPaymentLabel(item.paymentStatus)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {new Date(item.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {item.allocations.map((allocation) => {
                    const pending = allocation.manualSubmissions.find(
                      (submission) => submission.status === "submitted",
                    );
                    const latest = allocation.manualSubmissions[0];
                    return (
                      <div
                        key={allocation.firmOrderId}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                          <div>
                            <p className="font-semibold text-zinc-900">
                              {allocation.firmName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {allocation.allocationNumber}
                            </p>
                          </div>
                          <div className="text-sm">
                            <p className="font-bold">
                              {formatRupees(allocation.amountPaise)}
                            </p>
                            <p className="text-xs uppercase text-zinc-500">
                              {allocation.paymentStatus}
                            </p>
                          </div>
                        </div>

                        {allocation.gatewayPayment && (
                          <p className="mt-2 text-xs text-zinc-600">
                            {allocation.gatewayPayment.provider}:{" "}
                            {allocation.gatewayPayment.providerOrderId}
                            {allocation.gatewayPayment.providerPaymentId
                              ? ` · ${allocation.gatewayPayment.providerPaymentId}`
                              : ""}{" "}
                            · {allocation.gatewayPayment.status}
                            {allocation.gatewayPayment.paidAt
                              ? ` · paid ${new Date(allocation.gatewayPayment.paidAt).toLocaleString("en-IN")}`
                              : ""}
                            {allocation.gatewayPayment.failedAt
                              ? ` · failed ${new Date(allocation.gatewayPayment.failedAt).toLocaleString("en-IN")}`
                              : ""}
                          </p>
                        )}

                        {latest && (
                          <p className="mt-2 text-xs text-zinc-600">
                            Latest UTR:{" "}
                            <span className="font-mono font-bold">
                              {latest.utrReference}
                            </span>{" "}
                            ({latest.status})
                          </p>
                        )}

                        {pending && item.paymentMethod !== "cash_on_delivery" && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubmission({
                                  id: pending.id,
                                  orderNumber: item.orderNumber,
                                  utrReference: pending.utrReference,
                                  amountPaise: pending.amountPaise,
                                  firmName: allocation.firmName,
                                  allocationNumber: allocation.allocationNumber,
                                });
                                setActionType("approve");
                                setAdminNote(
                                  "Verified and approved by administrator",
                                );
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"
                            >
                              Approve UTR
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubmission({
                                  id: pending.id,
                                  orderNumber: item.orderNumber,
                                  utrReference: pending.utrReference,
                                  amountPaise: pending.amountPaise,
                                  firmName: allocation.firmName,
                                  allocationNumber: allocation.allocationNumber,
                                });
                                setActionType("reject");
                                setAdminNote(
                                  "UTR number not matching bank statement",
                                );
                              }}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700"
                            >
                              Reject UTR
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
            {!filtered.length && (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
                No payment records found.
              </div>
            )}
          </div>
        )}
      </div>

      {activeSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold">
              {actionType === "approve" ? "Approve UTR" : "Reject UTR"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Order #{activeSubmission.orderNumber} · {activeSubmission.firmName}{" "}
              · {activeSubmission.allocationNumber}
            </p>
            <p className="mt-3 text-sm">
              UTR{" "}
              <span className="font-mono font-bold">
                {activeSubmission.utrReference}
              </span>{" "}
              · {formatRupees(activeSubmission.amountPaise)}
            </p>
            <textarea
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-xs"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveSubmission(null)}
                className="rounded-xl border px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => void handleConfirmReview()}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white ${
                  actionType === "approve" ? "bg-emerald-600" : "bg-rose-600"
                }`}
              >
                {processingId ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
