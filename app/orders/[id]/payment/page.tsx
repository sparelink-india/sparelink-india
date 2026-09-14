"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type BankConfig = {
  isConfigured: boolean;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  qrImageUrl?: string;
  instructions: string;
};

type Submission = {
  id: string;
  amountPaise: number;
  utrReference: string;
  paymentDate: string;
  proofFileUrl?: string | null;
  proofFileName?: string | null;
  proofFileType?: string | null;
  status: string; // "submitted" | "approved" | "rejected"
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

type OrderData = {
  id: string;
  orderNumber: string;
  totalPaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  items: Array<{
    id: string;
    partNumber: string;
    partName: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }>;
};

export default function OrderPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.id === "string" ? params.id : "";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [bankConfig, setBankConfig] = useState<BankConfig | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [latestSubmission, setLatestSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form inputs
  const [utrReference, setUtrReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  async function loadPaymentData() {
    if (!orderId) return;
    try {
      setError("");
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payment details.");

      setOrder(data.order);
      setBankConfig(data.bankConfig);
      setSubmissions(data.submissions || []);
      setLatestSubmission(data.latestSubmission || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPaymentData();
  }, [orderId]);

  function copyToClipboard(text: string, fieldName: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    if (!utrReference.trim()) {
      setError("Please enter the transaction UTR / Reference number.");
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("utrReference", utrReference.trim());
      formData.append("paymentDate", paymentDate);

      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit payment details.");

      setSuccessMsg("Payment details submitted successfully! Awaiting admin verification.");
      setUtrReference("");
      await loadPaymentData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-950">
              SpareLink
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              India
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <Link href="/orders" className="hover:text-slate-950">
              My Orders
            </Link>
            <Link href="/cart" className="hover:text-slate-950">
              Cart
            </Link>
            <SignOutButton className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-60" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Bank / UPI Payment Verification
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Transfer the order amount and submit your transaction UTR reference for verification.
            </p>
          </div>
          <Link
            href="/orders"
            className="self-start rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            â† Back to Orders
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800"
          >
            <span className="font-bold text-rose-600">âœ•</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800"
          >
            <span className="font-bold text-emerald-600">âœ“</span>
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-white border border-slate-200" />
          </div>
        ) : !order ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
            Order not found.
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Order Overview Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Order Reference
                  </p>
                  <p className="font-mono text-lg font-bold text-slate-950 sm:text-xl">
                    #{order.orderNumber}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Total Amount Payable
                  </p>
                  <p className="text-2xl font-black text-slate-950">
                    â‚¹{(order.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Payment Status:</span>
                  <span
                    className={`rounded-md px-2 py-0.5 font-bold uppercase ${
                      order.paymentStatus === "paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Method:</span>
                  <span className="font-semibold text-slate-800">
                    Direct Bank Transfer / UPI
                  </span>
                </div>
              </div>
            </section>

            {/* Bank / UPI Payment Instructions Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  Bank & UPI Transfer Instructions
                </h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Official Account
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {bankConfig?.instructions}
              </p>

              {bankConfig?.isConfigured ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {bankConfig.accountName && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                        Account Holder Name
                      </span>
                      <span className="mt-1 block font-bold text-slate-900">
                        {bankConfig.accountName}
                      </span>
                    </div>
                  )}

                  {bankConfig.bankName && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <span className="block text-[11px] font-semibold text-slate-500 uppercase">
                        Bank Name
                      </span>
                      <span className="mt-1 block font-bold text-slate-900">
                        {bankConfig.bankName}
                      </span>
                    </div>
                  )}

                  {bankConfig.accountNumber && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">
                          Account Number
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(bankConfig.accountNumber!, "account")}
                          className="text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          {copiedField === "account" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                        {bankConfig.accountNumber}
                      </span>
                    </div>
                  )}

                  {bankConfig.ifscCode && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">
                          IFSC Code
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(bankConfig.ifscCode!, "ifsc")}
                          className="text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          {copiedField === "ifsc" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                        {bankConfig.ifscCode}
                      </span>
                    </div>
                  )}

                  {bankConfig.upiId && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-900 uppercase">
                          Business UPI ID
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(bankConfig.upiId!, "upi")}
                          className="text-[11px] font-bold text-emerald-800 hover:underline"
                        >
                          {copiedField === "upi" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <span className="mt-1 block font-mono text-sm font-bold text-emerald-950">
                        {bankConfig.upiId}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
                  âš ï¸ Bank transfer & UPI details are currently not configured in the environment variables. Please contact administration for payment instructions.
                </div>
              )}
            </section>

            {/* Latest Submission Status View */}
            {latestSubmission && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    Latest Submission Status
                  </h2>
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                      latestSubmission.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : latestSubmission.status === "rejected"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {latestSubmission.status === "approved"
                      ? "âœ“ Verified & Approved"
                      : latestSubmission.status === "rejected"
                        ? "âœ• Verification Rejected"
                        : "â³ Under Admin Verification"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Submitted UTR Reference:</span>
                    <p className="font-mono font-bold text-slate-900">{latestSubmission.utrReference}</p>
                  </div>

                  <div>
                    <span className="text-slate-500">Payment Date:</span>
                    <p className="font-medium text-slate-900">
                      {new Date(latestSubmission.paymentDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Amount Submitted:</span>
                    <p className="font-bold text-slate-900">
                      â‚¹{(latestSubmission.amountPaise / 100).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Proof Uploaded:</span>
                    <p className="font-medium text-slate-900">
                      {latestSubmission.proofFileUrl ? (
                        <a
                          href={latestSubmission.proofFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-emerald-700 underline"
                        >
                          View Uploaded Proof ({latestSubmission.proofFileName || "File"})
                        </a>
                      ) : (
                        "No file attached"
                      )}
                    </p>
                  </div>

                  {latestSubmission.adminNote && (
                    <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200 p-3 mt-1">
                      <span className="font-bold text-slate-900">Admin Note: </span>
                      <span className="text-slate-700">{latestSubmission.adminNote}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Submit Details Form (allowed if not approved yet) */}
            {order.paymentStatus !== "paid" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {latestSubmission
                    ? "Submit Corrected / Additional Payment Details"
                    : "Submit Payment Reference"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your transaction details after completing bank or UPI payment.
                </p>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-slate-700">
                        UTR / Transaction Reference Number{" "}
                        <span className="text-rose-500">*</span>
                      </span>
                      <input
                        required
                        value={utrReference}
                        onChange={(e) => setUtrReference(e.target.value)}
                        placeholder="e.g. 325412589632 or UPI Ref No."
                        className="h-11 w-full font-mono rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                      />
                    </div>

                    <div>
                      <span className="mb-1 block text-xs font-semibold text-slate-700">
                        Payment Date <span className="text-rose-500">*</span>
                      </span>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-press mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                  >
                    {submitting
                      ? "Submitting..."
                      : "Submit Payment Details for Verification"}
                  </button>
                </form>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}



