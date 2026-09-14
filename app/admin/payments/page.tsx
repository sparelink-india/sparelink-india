"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SubmissionItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTotalPaise: number;
  orderStatus: string;
  orderPaymentStatus: string;
  orderPaymentMethod: string;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string | null;
  shippingName: string;
  shippingPhone: string;
  amountPaise: number;
  utrReference: string;
  paymentDate: string;
  proofFileUrl: string | null;
  proofFileName: string | null;
  proofFileType: string | null;
  status: string; // "submitted" | "approved" | "rejected"
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export default function AdminManualPaymentsPage() {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Review modal / note state
  const [activeSubmission, setActiveSubmission] = useState<SubmissionItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [adminNote, setAdminNote] = useState("");

  async function loadSubmissions() {
    try {
      setError("");
      const res = await fetch("/api/admin/payments/manual", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payment submissions.");
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load submissions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
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
      if (!res.ok) throw new Error(data.error || "Failed to process payment review.");

      setSuccessMsg(data.message || "Payment submission status updated.");
      setActiveSubmission(null);
      setAdminNote("");
      await loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setProcessingId(null);
    }
  }

  const filteredSubmissions = submissions.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      s.orderNumber.toLowerCase().includes(q) ||
      s.utrReference.toLowerCase().includes(q) ||
      s.buyerName?.toLowerCase().includes(q) ||
      s.shippingName.toLowerCase().includes(q) ||
      s.buyerEmail.toLowerCase().includes(q) ||
      s.buyerPhone?.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || s.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  const pendingCount = submissions.filter((s) => s.status === "submitted").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const rejectedCount = submissions.filter((s) => s.status === "rejected").length;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm font-semibold text-zinc-600">
            Manual Bank / UPI Payment Verification
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Bank / UPI Payment Submissions
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Verify customer UTR references and approve/reject manual bank transfers
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
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

        {/* Metrics Grid */}
        <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Pending Verification
            </span>
            <p className="mt-1 text-2xl font-black text-amber-950">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Approved Payments
            </span>
            <p className="mt-1 text-2xl font-black text-emerald-950">
              {approvedCount}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Rejected Submissions
            </span>
            <p className="mt-1 text-2xl font-black text-zinc-900">
              {rejectedCount}
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order #, UTR, Customer, Mobile..."
            className="h-10 w-full max-w-md rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none focus:border-zinc-950"
          />

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none"
            >
              <option value="all">All Submissions</option>
              <option value="submitted">Pending (Submitted)</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-zinc-500">Loading payment submissions...</p>
        ) : filteredSubmissions.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order # & Date</th>
                  <th className="px-4 py-3 font-semibold">Customer & Mobile</th>
                  <th className="px-4 py-3 font-semibold">UTR / Reference</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount (₹)</th>
                  <th className="px-4 py-3 font-semibold">Payment Date</th>
                  <th className="px-4 py-3 font-semibold">Proof</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredSubmissions.map((s) => {
                  const isPending = s.status === "submitted";
                  const isApproved = s.status === "approved";
                  const isRejected = s.status === "rejected";

                  return (
                    <tr key={s.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3.5">
                        <p className="font-mono font-bold text-zinc-900">#{s.orderNumber}</p>
                        <p className="text-xs text-zinc-400">
                          Order: ₹{(s.orderTotalPaise / 100).toFixed(2)}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-zinc-900">{s.shippingName}</p>
                        <p className="text-xs text-zinc-500">{s.shippingPhone || s.buyerPhone || s.buyerEmail}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {s.utrReference}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <p className="font-bold text-zinc-900">
                          ₹{(s.amountPaise / 100).toFixed(2)}
                        </p>
                        {s.amountPaise !== s.orderTotalPaise && (
                          <span className="text-[10px] font-bold text-amber-700 block">
                            (Diff: ₹{((s.amountPaise - s.orderTotalPaise) / 100).toFixed(2)})
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-zinc-600">
                        {new Date(s.paymentDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        {s.proofFileUrl ? (
                          <a
                            href={s.proofFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                          >
                            <span>📎</span> View Proof
                          </a>
                        ) : (
                          <span className="text-zinc-400">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                            isApproved
                              ? "bg-emerald-100 text-emerald-800"
                              : isRejected
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isApproved
                            ? "Approved"
                            : isRejected
                              ? "Rejected"
                              : "Submitted"}
                        </span>
                        {s.adminNote && (
                          <p className="mt-1 text-[11px] text-zinc-500 max-w-[160px] truncate" title={s.adminNote}>
                            Note: {s.adminNote}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubmission(s);
                                setActionType("approve");
                                setAdminNote("Verified and approved by administrator");
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubmission(s);
                                setActionType("reject");
                                setAdminNote("UTR number not matching bank statement");
                              }}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
            No manual payment submissions found matching your filters.
          </div>
        )}
      </div>

      {/* Review Modal Dialog */}
      {activeSubmission && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-950">
              {actionType === "approve" ? "Approve Bank / UPI Payment" : "Reject Payment Submission"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Order <strong className="font-mono">#{activeSubmission.orderNumber}</strong> • UTR: <strong className="font-mono">{activeSubmission.utrReference}</strong>
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold text-slate-900">{activeSubmission.shippingName}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Submitted:</span>
                <span className="font-bold text-slate-900">₹{(activeSubmission.amountPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Order Total:</span>
                <span className="font-bold text-slate-900">₹{(activeSubmission.orderTotalPaise / 100).toFixed(2)}</span>
              </div>
              {activeSubmission.proofFileUrl && (
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span>Attached Proof:</span>
                  <a
                    href={activeSubmission.proofFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-emerald-700 underline"
                  >
                    Open Proof File
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  Admin Note / Remarks {actionType === "reject" ? "(Visible to customer)" : "(Optional)"}
                </span>
                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    actionType === "approve"
                      ? "e.g. Verified against bank statement"
                      : "e.g. UTR reference not found in bank account statement. Please verify and re-submit."
                  }
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-slate-950"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveSubmission(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => void handleConfirmReview()}
                className={`rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-60 ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {processingId
                  ? "Processing..."
                  : actionType === "approve"
                    ? "Confirm & Mark Paid"
                    : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
