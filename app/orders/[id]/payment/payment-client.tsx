"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { openCashfreeCheckout } from "@/lib/cashfree-browser";

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
  firmOrderId: string;
  firmId: string;
  firmName: string;
  firmCode: string;
  allocationNumber: string;
  amountPaise: number;
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentAccountingReference: string;
  onlinePaymentConfigured: boolean;
  bankConfig: BankConfig & {
    firmId: string;
    firmName: string;
    allocationAmountPaise: number;
  };
};

type Submission = {
  id: string;
  firmOrderId?: string | null;
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

type CashfreeStatusResponse = {
  status?: string;
  firmOrderPaymentStatus?: string;
  error?: string;
};

const POLL_ATTEMPTS = 8;
const POLL_DELAY_MS = 2500;
const TERMINAL_STATUSES = new Set([
  "paid",
  "failed",
  "expired",
  "user_dropped",
]);

function formatRupees(paise: number) {
  return `Rs. ${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parentPaymentLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partially Paid";
  return "Pending";
}

function allocationPaymentLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "expired") return "Expired";
  if (status === "user_dropped") return "Cancelled";
  if (status === "pending") return "Pending verification";
  return "Unpaid";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function OrderPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = typeof params.id === "string" ? params.id : "";
  const returnFirmOrderId = searchParams.get("firmOrderId")?.trim() ?? "";
  const isCashfreeReturn = searchParams.get("cf") === "return";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [firmPayments, setFirmPayments] = useState<FirmPayment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingFirmOrderId, setPayingFirmOrderId] = useState<string | null>(
    null,
  );
  const [verifyingFirmOrderId, setVerifyingFirmOrderId] = useState<
    string | null
  >(null);
  const [utrFirmOrderId, setUtrFirmOrderId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [utrReference, setUtrReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const pollStarted = useRef(false);

  const loadPaymentData = useCallback(async () => {
    if (!orderId) return;

    const res = await fetch(`/api/orders/${orderId}/payment`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load payment details.");
    }

    setOrder(data.order);
    setFirmPayments(data.firmPayments || []);
    setSubmissions(data.submissions || []);
  }, [orderId]);

  const verifyAllocation = useCallback(
    async (firmOrderId: string) => {
      if (!orderId || !firmOrderId) return;
      const allocation = firmPayments.find(
        (item) => item.firmOrderId === firmOrderId,
      );
      if (allocation && allocation.onlinePaymentConfigured === false) {
        return;
      }
      setVerifyingFirmOrderId(firmOrderId);
      setError("");
      setSuccessMsg("Verifying payment status with SpareLink...");

      let lastStatus = "pending";

      try {
        for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
          const res = await fetch(
            `/api/payments/cashfree/status?orderId=${encodeURIComponent(orderId)}&firmOrderId=${encodeURIComponent(firmOrderId)}`,
            { cache: "no-store" },
          );
          const data = (await res.json()) as CashfreeStatusResponse;
          if (!res.ok) {
            throw new Error(data.error || "Unable to verify payment status.");
          }

          lastStatus = data.status ?? data.firmOrderPaymentStatus ?? "pending";
          await loadPaymentData();

          if (TERMINAL_STATUSES.has(lastStatus)) {
            if (lastStatus === "paid") {
              setSuccessMsg("This firm allocation is paid.");
            } else {
              setSuccessMsg(
                `Payment ${allocationPaymentLabel(lastStatus).toLowerCase()}. You can retry this allocation.`,
              );
            }
            return;
          }

          if (attempt < POLL_ATTEMPTS - 1) {
            await sleep(POLL_DELAY_MS);
          }
        }

        setSuccessMsg(
          "Payment status is being verified. This can take a short time. Refresh this page or wait — do not assume the payment failed.",
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to verify payment status.",
        );
      } finally {
        setVerifyingFirmOrderId(null);
      }
    },
    [firmPayments, loadPaymentData, orderId],
  );

  useEffect(() => {
    async function start() {
      try {
        setError("");
        await loadPaymentData();
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

    void start();
  }, [loadPaymentData]);

  useEffect(() => {
    if (loading || pollStarted.current) return;
    if (!isCashfreeReturn || !returnFirmOrderId) return;

    pollStarted.current = true;
    router.replace(`/orders/${orderId}/payment`);
    window.setTimeout(() => {
      void verifyAllocation(returnFirmOrderId);
    }, 0);
  }, [
    isCashfreeReturn,
    loading,
    orderId,
    returnFirmOrderId,
    router,
    verifyAllocation,
  ]);

  function copyToClipboard(text: string, fieldName: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    window.setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  }

  async function handlePayNow(firmOrderId: string) {
    setError("");
    setSuccessMsg("");
    setPayingFirmOrderId(firmOrderId);

    try {
      const allocation = firmPayments.find(
        (item) => item.firmOrderId === firmOrderId,
      );
      if (allocation && allocation.onlinePaymentConfigured === false) {
        throw new Error("Online payment is coming soon for this firm.");
      }

      const res = await fetch("/api/payments/cashfree/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, firmOrderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to start online payment.");
      }

      await openCashfreeCheckout({
        paymentSessionId: data.paymentSessionId,
        cashfreeEnvironment: data.cashfreeEnvironment,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start online payment.",
      );
      setPayingFirmOrderId(null);
    }
  }

  async function handleSubmit(e: FormEvent, firmOrderId: string) {
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
      formData.append("firmOrderId", firmOrderId);
      formData.append("utrReference", utrReference.trim());
      formData.append("paymentDate", paymentDate);

      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit payment details.");
      }

      setSuccessMsg(
        "UTR submitted for this firm allocation. Awaiting admin verification.",
      );
      setUtrReference("");
      setUtrFirmOrderId(null);
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

  const isCod = order.paymentMethod === "cash_on_delivery";
  const canPayOnline = !isCod;

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
              Order Payment
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Order #{order.orderNumber}. Pay each firm allocation separately.
              Returning from checkout is not proof of payment.
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

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                Payment Summary
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Parent status comes from SpareLink after each allocation is
                verified.
              </p>
            </div>
            <div className="text-left sm:text-right">
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
                Method
              </span>
              <span className="mt-1 block font-bold text-slate-900">
                {isCod
                  ? "Cash on delivery"
                  : order.paymentMethod === "bank_transfer"
                    ? "Bank / UPI transfer"
                    : "Online payment"}
              </span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <span className="block text-[11px] font-semibold uppercase text-slate-500">
                Parent Payment Status
              </span>
              <span className="mt-1 block font-bold text-slate-900">
                {parentPaymentLabel(order.paymentStatus)}
              </span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <span className="block text-[11px] font-semibold uppercase text-slate-500">
                Allocations
              </span>
              <span className="mt-1 block font-bold text-slate-900">
                {firmPayments.length}
              </span>
            </div>
          </div>
        </section>

        {isCod && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
            This order is cash on delivery. Online payment and UTR submission
            are not used for COD.
          </div>
        )}

        {firmPayments.length > 0 && (
          <section className="mt-6 space-y-5">
            {firmPayments.map((firmPayment) => {
              const config = firmPayment.bankConfig;
              const paid = firmPayment.paymentStatus === "paid";
              const latestUtr = submissions.find(
                (item) => item.firmOrderId === firmPayment.firmOrderId,
              );
              const showPayNow =
                canPayOnline &&
                !paid &&
                firmPayment.onlinePaymentConfigured !== false;
              const retryable =
                firmPayment.paymentStatus === "failed" ||
                firmPayment.paymentStatus === "expired" ||
                firmPayment.paymentStatus === "user_dropped";

              return (
                <div
                  key={firmPayment.firmOrderId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
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
                    <div className="rounded-xl bg-slate-50 px-4 py-2 text-left sm:text-right">
                      <span className="block text-[10px] font-semibold uppercase text-slate-500">
                        Amount
                      </span>
                      <span className="mt-0.5 block text-lg font-black text-slate-950">
                        {formatRupees(firmPayment.amountPaise)}
                      </span>
                      <span className="mt-1 block text-[11px] font-bold uppercase text-slate-600">
                        {allocationPaymentLabel(firmPayment.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  {canPayOnline &&
                    !paid &&
                    firmPayment.onlinePaymentConfigured === false && (
                    <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
                      <p className="text-sm font-bold text-amber-950">
                        Online Payment — Coming Soon
                      </p>
                      <p className="mt-1 text-xs font-medium text-amber-800">
                        Cashfree is not available for this firm yet. Use Cash on
                        Delivery when placing the order, or pay this allocation
                        by bank/UPI transfer. No online payment session will be
                        created.
                      </p>
                    </div>
                  )}

                  {showPayNow && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={
                          payingFirmOrderId === firmPayment.firmOrderId ||
                          verifyingFirmOrderId === firmPayment.firmOrderId
                        }
                        onClick={() => void handlePayNow(firmPayment.firmOrderId)}
                        className="btn-press rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {payingFirmOrderId === firmPayment.firmOrderId
                          ? "Opening payment..."
                          : retryable
                            ? "Retry Pay Now"
                            : "Pay Now"}
                      </button>
                      {verifyingFirmOrderId === firmPayment.firmOrderId && (
                        <p className="self-center text-xs text-slate-500">
                          Checking payment with SpareLink...
                        </p>
                      )}
                    </div>
                  )}

                  {paid && (
                    <p className="mt-4 text-xs font-semibold text-emerald-700">
                      This allocation is paid. Other firms on this order remain
                      independent.
                    </p>
                  )}

                  {canPayOnline && (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <h4 className="text-sm font-bold text-slate-900">
                        Bank / UPI transfer for this firm
                      </h4>
                      {config.isConfigured ? (
                        <>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {config.instructions}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                                        `account-${firmPayment.firmOrderId}`,
                                      )
                                    }
                                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                                  >
                                    {copiedField ===
                                    `account-${firmPayment.firmOrderId}`
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
                                <span className="block text-[11px] font-semibold uppercase text-slate-500">
                                  IFSC
                                </span>
                                <span className="mt-1 block font-mono text-sm font-bold text-slate-900">
                                  {config.ifscCode}
                                </span>
                              </div>
                            )}
                            {config.upiId && (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:col-span-2">
                                <span className="block text-[11px] font-semibold uppercase text-emerald-900">
                                  UPI ID
                                </span>
                                <span className="mt-1 block font-mono text-sm font-bold text-emerald-950">
                                  {config.upiId}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-amber-800">
                          Bank details for this firm are not configured yet.
                        </p>
                      )}

                      {latestUtr && (
                        <p className="mt-3 text-xs text-slate-600">
                          Latest UTR:{" "}
                          <span className="font-mono font-bold">
                            {latestUtr.utrReference}
                          </span>{" "}
                          ({latestUtr.status})
                        </p>
                      )}

                      {!paid && (
                        utrFirmOrderId === firmPayment.firmOrderId ? (
                          <form
                            onSubmit={(event) =>
                              void handleSubmit(event, firmPayment.firmOrderId)
                            }
                            className="mt-4 space-y-3"
                          >
                            <input
                              required
                              value={utrReference}
                              onChange={(e) => setUtrReference(e.target.value)}
                              placeholder="UTR / UPI reference"
                              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm outline-none focus:border-slate-950"
                            />
                            <input
                              type="date"
                              required
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-slate-950"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                              >
                                {submitting ? "Submitting..." : "Submit UTR"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setUtrFirmOrderId(null)}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setUtrFirmOrderId(firmPayment.firmOrderId);
                              setUtrReference("");
                            }}
                            className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800"
                          >
                            Submit UTR for this allocation
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
