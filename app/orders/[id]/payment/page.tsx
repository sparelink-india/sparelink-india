"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

type FirmPayment = {
  firmId: string;
  firmName: string;
  firmCode: string;
  allocationNumber: string;
  amountPaise: number;
  fulfillmentStatus: string;
  paymentAccountingReference: string;
  bankConfig: BankConfig & {
    firmId: string;
    firmName: string;
    allocationAmountPaise: number;
  };
};

type Submission = {
  id: string;
  amountPaise: number;
  utrReference: string;
  paymentDate: string;
  proofFileUrl?: string | null;
  proofFileName?: string | null;
  proofFileType?: string | null;
  status: string;
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

function formatRupees(paise: number) {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function OrderPaymentPage() {
  const params = useParams();
  const orderId = typeof params.id === "string" ? params.id : "";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [bankConfig, setBankConfig] = useState<BankConfig | null>(null);
  const [firmPayments, setFirmPayments] = useState<FirmPayment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [latestSubmission, setLatestSubmission] = useState<Submission | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

      if (!res.ok) {
        throw new Error(data.error || "Failed to load payment details.");
      }

      setOrder(data.order);
      setBankConfig(data.bankConfig || null);
      setFirmPayments(data.firmPayments || []);
      setSubmissions(data.submissions || []);
      setLatestSubmission(data.latestSubmission || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load payment details.",
      );
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

    window.setTimeout(() => {
      setCopiedField(null);
    }, 2000);
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

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to submit payment details.",
        );
      }

      setSuccessMsg(
        "Payment details submitted successfully. Awaiting admin verification.",
      );
      setUtrReference("");
      await loadPaymentData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit payment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs">
            Loading payment details...
          </div>
        </main>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">
            {error}
          </div>
          <Link
            href="/orders"
            className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to My Orders
          </Link>
        </main>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Bank / UPI Payment Verification
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Order #{order.orderNumber} - transfer the required amount and
              submit your transaction reference for verification.
            </p>
          </div>

          <Link
            href="/orders"
            className="self-start rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100"
          >
            Back to Orders
          </Link>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
            {successMsg}
          </div>
        )}

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  Payment Summary
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  The payment amount is taken from the server-side order total.
                </p>
              </div>

              <div className="text-right">
                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                  Order Total
                </span>
                <span className="mt-1 block text-xl font-black text-slate-950">
                  {formatRupees(order.totalPaise)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3.5">
                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                  Subtotal
                </span>
                <span className="mt-1 block font-bold text-slate-900">
                  {formatRupees(order.subtotalPaise)}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5">
                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                  Shipping
                </span>
                <span className="mt-1 block font-bold text-slate-900">
                  {formatRupees(order.shippingPaise)}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5">
                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                  Payment Status
                </span>
                <span className="mt-1 block font-bold uppercase text-slate-900">
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </section>

          {firmPayments.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  Firm-wise Payment Details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your single SpareLink order may be fulfilled by multiple
                  firms. Pay each firm according to the allocation shown below.
                </p>
              </div>

              <div className="mt-5 space-y-5">
                {firmPayments.map((firmPayment) => {
                  const config = firmPayment.bankConfig;

                  return (
                    <div
                      key={firmPayment.firmId}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5"
                    >
                      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-base font-bold text-slate-950">
                            {firmPayment.firmName}
                          </h3>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            Allocation: {firmPayment.allocationNumber}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white px-4 py-2 text-right shadow-2xs">
                          <span className="block text-[10px] font-semibold uppercase text-slate-500">
                            Amount to Transfer
                          </span>
                          <span className="mt-0.5 block text-lg font-black text-slate-950">
                            {formatRupees(firmPayment.amountPaise)}
                          </span>
                        </div>
                      </div>

                      {config.isConfigured ? (
                        <>
                          <p className="mt-4 text-xs leading-5 text-slate-600">
                            {config.instructions}
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {config.accountName && (
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                                  Account Name
                                </span>
                                <span className="mt-1 block font-bold text-slate-900">
                                  {config.accountName}
                                </span>
                              </div>
                            )}

                            {config.bankName && (
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                                  Bank Name
                                </span>
                                <span className="mt-1 block font-bold text-slate-900">
                                  {config.bankName}
                                </span>
                              </div>
                            )}

                            {config.accountNumber && (
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold uppercase text-slate-500">
                                    Account Number
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        config.accountNumber!,
                                        `account-${firmPayment.firmId}`,
                                      )
                                    }
                                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                                  >
                                    {copiedField ===
                                    `account-${firmPayment.firmId}`
                                      ? "Copied!"
                                      : "Copy"}
                                  </button>
                                </div>
                                <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                                  {config.accountNumber}
                                </span>
                              </div>
                            )}

                            {config.ifscCode && (
                              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold uppercase text-slate-500">
                                    IFSC Code
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        config.ifscCode!,
                                        `ifsc-${firmPayment.firmId}`,
                                      )
                                    }
                                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                                  >
                                    {copiedField ===
                                    `ifsc-${firmPayment.firmId}`
                                      ? "Copied!"
                                      : "Copy"}
                                  </button>
                                </div>
                                <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                                  {config.ifscCode}
                                </span>
                              </div>
                            )}

                            {config.upiId && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold uppercase text-emerald-900">
                                    Business UPI ID
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        config.upiId!,
                                        `upi-${firmPayment.firmId}`,
                                      )
                                    }
                                    className="text-[11px] font-bold text-emerald-800 hover:underline"
                                  >
                                    {copiedField ===
                                    `upi-${firmPayment.firmId}`
                                      ? "Copied!"
                                      : "Copy"}
                                  </button>
                                </div>
                                <span className="mt-1 block font-mono text-sm font-bold text-emerald-950">
                                  {config.upiId}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
                          Payment details for this firm are not configured yet.
                          Please contact administration before making payment.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {firmPayments.length === 0 && bankConfig && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                Bank / UPI Payment Details
              </h2>

              {bankConfig.isConfigured ? (
                <>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {bankConfig.instructions}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {bankConfig.accountName && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <span className="block text-[11px] font-semibold uppercase text-slate-500">
                          Account Name
                        </span>
                        <span className="mt-1 block font-bold text-slate-900">
                          {bankConfig.accountName}
                        </span>
                      </div>
                    )}

                    {bankConfig.bankName && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <span className="block text-[11px] font-semibold uppercase text-slate-500">
                          Bank Name
                        </span>
                        <span className="mt-1 block font-bold text-slate-900">
                          {bankConfig.bankName}
                        </span>
                      </div>
                    )}

                    {bankConfig.accountNumber && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase text-slate-500">
                            Account Number
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                bankConfig.accountNumber!,
                                "legacy-account",
                              )
                            }
                            className="text-[11px] font-bold text-emerald-700 hover:underline"
                          >
                            {copiedField === "legacy-account"
                              ? "Copied!"
                              : "Copy"}
                          </button>
                        </div>
                        <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                          {bankConfig.accountNumber}
                        </span>
                      </div>
                    )}

                    {bankConfig.ifscCode && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <span className="block text-[11px] font-semibold uppercase text-slate-500">
                          IFSC Code
                        </span>
                        <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                          {bankConfig.ifscCode}
                        </span>
                      </div>
                    )}

                    {bankConfig.upiId && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:col-span-2">
                        <span className="block text-[11px] font-semibold uppercase text-emerald-900">
                          Business UPI ID
                        </span>
                        <span className="mt-1 block font-mono text-sm font-bold text-emerald-950">
                          {bankConfig.upiId}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
                  Bank transfer and UPI details are not configured yet. Please
                  contact administration for payment instructions.
                </div>
              )}
            </section>
          )}

          {latestSubmission && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
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
                    ? "Verified and Approved"
                    : latestSubmission.status === "rejected"
                      ? "Verification Rejected"
                      : "Under Admin Verification"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">
                    Submitted UTR Reference:
                  </span>
                  <p className="font-mono font-bold text-slate-900">
                    {latestSubmission.utrReference}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Payment Date:</span>
                  <p className="font-medium text-slate-900">
                    {new Date(
                      latestSubmission.paymentDate,
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500">Amount Submitted:</span>
                  <p className="font-bold text-slate-900">
                    {formatRupees(latestSubmission.amountPaise)}
                  </p>
                </div>

                {latestSubmission.proofFileUrl && (
                  <div>
                    <span className="text-slate-500">Existing Proof:</span>
                    <p className="font-medium text-slate-900">
                      <a
                        href={latestSubmission.proofFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-emerald-700 underline"
                      >
                        View uploaded proof (
                        {latestSubmission.proofFileName || "File"})
                      </a>
                    </p>
                  </div>
                )}

                {latestSubmission.adminNote && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                    <span className="font-bold text-slate-900">
                      Admin Note:{" "}
                    </span>
                    <span className="text-slate-700">
                      {latestSubmission.adminNote}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {order.paymentStatus !== "paid" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                {latestSubmission
                  ? "Submit Corrected / Additional Payment Details"
                  : "Submit Payment Reference"}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                After completing the bank or UPI payment, enter the transaction
                UTR/reference and payment date. Admin verification is required
                before the order is marked paid.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="utrReference"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      UTR / Transaction Reference Number{" "}
                      <span className="text-rose-500">*</span>
                    </label>

                    <input
                      id="utrReference"
                      required
                      value={utrReference}
                      onChange={(e) => setUtrReference(e.target.value)}
                      placeholder="Enter UTR / UPI reference number"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 font-mono text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="paymentDate"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Payment Date <span className="text-rose-500">*</span>
                    </label>

                    <input
                      id="paymentDate"
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
                  className="btn-press mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit Payment Details for Verification"}
                </button>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
