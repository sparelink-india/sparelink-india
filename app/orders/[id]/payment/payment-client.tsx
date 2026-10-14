"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { useI18n } from "@/components/preferences-provider";
import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import type { MessageKey } from "@/lib/i18n";
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
  paymentMethod: string;
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

/* These return a dictionary KEY rather than a literal, so the status reads
   in the customer's language. The status strings themselves, the comparisons
   and the fall-through order are unchanged - only the label moved. The return
   type is MessageKey, so a key that does not exist fails the build rather than
   rendering as a raw identifier next to a payment. */
function parentPaymentLabel(status: string): MessageKey {
  if (status === "paid") return "payStatus.paid";
  if (status === "partial") return "payStatus.partial";
  return "payStatus.pending";
}

function allocationPaymentLabel(status: string): MessageKey {
  if (status === "paid") return "payStatus.paid";
  if (status === "failed") return "payStatus.failed";
  if (status === "expired") return "payStatus.expired";
  if (status === "user_dropped") return "payStatus.cancelled";
  if (status === "pending") return "payStatus.pendingVerification";
  return "payStatus.unpaid";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function OrderPaymentPage() {
  /* Needed for the two UTR form inputs, whose accessible names come from
     the dictionary. The rest of the page uses the <T> component. */
  const { t } = useI18n();

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
      <StorefrontShell>
        <div className="py-10 sm:py-16">
          <div className="sl-panel p-8 text-center text-sm text-[var(--sl-ink-2)]">
            <T k="pay.loading" />
          </div>
        </div>
      </StorefrontShell>
    );
  }

  if (error && !order) {
    return (
      <StorefrontShell>
        <div className="py-10 sm:py-16">
          <div className="rounded-[var(--sl-r)] border border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] p-6 text-sm font-medium text-[var(--sl-bad)]">
            {error}
          </div>
          <Link
            href="/orders"
            className="sl-btn sl-btn-secondary mt-4 min-h-11 px-4 text-xs"
          >
            <T k="pay.backToOrders" />
          </Link>
        </div>
      </StorefrontShell>
    );
  }

  if (!order) return null;

  const isCod = order.paymentMethod === "cash_on_delivery";
  const canPayOnline = order.paymentMethod === "online_payment";
  const canPayBank = order.paymentMethod === "bank_transfer";

  return (
    <StorefrontShell>
      {/*
        The hand-rolled sticky <header> is gone: StorefrontHeader supplies the
        brand, the nav and the <header> landmark, so a duplicate header is no
        longer possible. The shell has no sign-out control, so SignOutButton
        moves into the page's own heading row - dropping it would remove the
        only way a signed-in customer can leave a payment screen.
      */}
      <div className="py-8 sm:py-10">
        <div className="flex flex-col gap-3 border-b border-[var(--sl-rule)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="sl-h1">
              <T k="pay.title" />
            </h1>
            <p className="sl-meta mt-1 !text-[var(--sl-ink-3)]">
              <T k="pay.orderHint" vars={{ order: order.orderNumber }} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/orders"
              className="sl-btn sl-btn-secondary !min-h-10 !text-xs"
            >
              <T k="pay.backToOrders" />
            </Link>
            <SignOutButton />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-[var(--sl-r)] border border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] p-4 text-xs font-medium text-[var(--sl-bad)]">
            {error}
          </div>
        )}

        {successMsg && (
          <div role="status" className="mt-5 rounded-[var(--sl-r)] border border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] p-4 text-xs font-medium text-[var(--sl-ok)]">
            {successMsg}
          </div>
        )}

        <section className="sl-panel mt-6 p-6">
          <div className="flex flex-col gap-4 border-b border-[var(--sl-rule)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="sl-h3">
                <T k="pay.summary" />
              </h2>
              <p className="sl-meta mt-1 !text-[var(--sl-ink-3)]">
                <T k="pay.parentStatusHint" />
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                <T k="pay.orderTotal" />
              </span>
              <span className="mt-1 block text-xl font-black tabular-nums text-[var(--sl-ink)]">
                {formatRupees(order.totalPaise)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-[var(--sl-r)] bg-[var(--sl-sunken)] p-3.5">
              <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                <T k="pay.method" />
              </span>
              <span className="mt-1 block font-bold text-[var(--sl-ink)]">
                {isCod ? (
                  <T k="pay.methodCod" />
                ) : order.paymentMethod === "bank_transfer" ? (
                  <T k="pay.methodBank" />
                ) : (
                  <T k="pay.methodOnline" />
                )}
              </span>
            </div>
            <div className="rounded-[var(--sl-r)] bg-[var(--sl-sunken)] p-3.5">
              <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                <T k="pay.parentStatus" />
              </span>
              <span className="mt-1 block font-bold text-[var(--sl-ink)]">
                <T k={parentPaymentLabel(order.paymentStatus)} />
              </span>
            </div>
            <div className="rounded-[var(--sl-r)] bg-[var(--sl-sunken)] p-3.5">
              <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                <T k="pay.allocations" />
              </span>
              <span className="mt-1 block font-bold text-[var(--sl-ink)]">
                {firmPayments.length}
              </span>
            </div>
          </div>
        </section>

        {isCod && (
          <div className="mt-6 rounded-[var(--sl-r)] border border-[var(--sl-warn-line)] bg-[var(--sl-warn-soft)] p-4 text-xs font-medium text-[var(--sl-warn)]">
            <T k="pay.codNotice" />
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
                firmPayment.paymentMethod === "online_payment" &&
                !paid &&
                firmPayment.onlinePaymentConfigured !== false;
              const retryable =
                firmPayment.paymentStatus === "failed" ||
                firmPayment.paymentStatus === "expired" ||
                firmPayment.paymentStatus === "user_dropped";

              return (
                <div
                  key={firmPayment.firmOrderId}
                  className="sl-panel p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-3 border-b border-[var(--sl-rule)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[var(--sl-ink)]">
                        {firmPayment.firmName}
                      </h3>
                      <p className="mt-1 text-[11px] font-medium text-[var(--sl-ink-3)]">
                        <T
                          k="pay.allocationOf"
                          vars={{ number: firmPayment.allocationNumber }}
                        />
                      </p>
                    </div>
                    <div className="rounded-[var(--sl-r)] bg-[var(--sl-sunken)] px-4 py-2 text-left sm:text-right">
                      <span className="block text-[10px] font-semibold uppercase text-[var(--sl-ink-3)]">
                        <T k="pay.amount" />
                      </span>
                      <span className="mt-0.5 block text-lg font-black text-[var(--sl-ink)]">
                        {formatRupees(firmPayment.amountPaise)}
                      </span>
                      <span className="mt-1 block text-[11px] text-[var(--sl-ink-2)]">
                        <T k={allocationPaymentLabel(firmPayment.paymentStatus)} />
                      </span>
                    </div>
                  </div>

                  {canPayOnline &&
                    !paid &&
                    firmPayment.onlinePaymentConfigured === false && (
                    <div className="mt-4 rounded-[var(--sl-r)] border border-dashed border-[var(--sl-warn-line)] bg-[var(--sl-warn-soft)] p-4">
                      <p className="text-sm font-bold text-[var(--sl-warn)]">
                        <T k="pay.onlineSoonTitle" />
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--sl-warn)]">
                        <T k="pay.onlineSoonBody" />
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
                        className="btn-press rounded-[var(--sl-r)] bg-[var(--sl-graphite)] px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {payingFirmOrderId === firmPayment.firmOrderId ? (
                          <T k="pay.opening" />
                        ) : retryable ? (
                          <T k="pay.retryPayNow" />
                        ) : (
                          <T k="orders.payNow" />
                        )}
                      </button>
                      {verifyingFirmOrderId === firmPayment.firmOrderId && (
                        <p className="self-center text-xs text-[var(--sl-ink-3)]">
                          <T k="pay.checking" />
                        </p>
                      )}
                    </div>
                  )}

                  {paid && (
                    <p className="mt-4 text-xs font-semibold text-[var(--sl-ok)]">
                      <T k="pay.paidIndependent" />
                    </p>
                  )}

                  {canPayBank &&
                    firmPayment.paymentMethod === "bank_transfer" && (
                    <div className="mt-5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-sunken)] p-4">
                      <h4 className="text-sm font-bold text-[var(--sl-ink)]">
                        <T k="pay.bankForFirm" />
                      </h4>
                      {config.isConfigured ? (
                        <>
                          <p className="mt-2 text-xs leading-5 text-[var(--sl-ink-2)]">
                            {config.instructions}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {config.accountName && (
                              <div className="rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] p-3.5">
                                <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                                  <T k="pay.accountName" />
                                </span>
                                <span className="mt-1 block font-bold text-[var(--sl-ink)]">
                                  {config.accountName}
                                </span>
                              </div>
                            )}
                            {config.accountNumber && (
                              <div className="rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] p-3.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                                    <T k="pay.accountNumber" />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        config.accountNumber!,
                                        `account-${firmPayment.firmOrderId}`,
                                      )
                                    }
                                    className="text-[11px] font-bold text-[var(--sl-ok)] hover:underline"
                                  >
                                    {copiedField ===
                                    `account-${firmPayment.firmOrderId}` ? (
                                      <T k="pay.copied" />
                                    ) : (
                                      <T k="pay.copy" />
                                    )}
                                  </button>
                                </div>
                                <span className="mt-1 block font-mono text-sm font-bold text-[var(--sl-ink)]">
                                  {config.accountNumber}
                                </span>
                              </div>
                            )}
                            {config.ifscCode && (
                              <div className="rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] p-3.5">
                                <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ink-3)]">
                                  IFSC
                                </span>
                                <span className="mt-1 block font-mono text-sm font-bold text-[var(--sl-ink)]">
                                  {config.ifscCode}
                                </span>
                              </div>
                            )}
                            {config.upiId && (
                              <div className="rounded-[var(--sl-r)] border border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] p-3.5 sm:col-span-2">
                                <span className="block text-[11px] font-semibold uppercase text-[var(--sl-ok)]">
                                  UPI ID
                                </span>
                                <span className="mt-1 block font-mono text-sm font-bold text-[var(--sl-ok)]">
                                  {config.upiId}
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--sl-warn)]">
                          <T k="pay.bankNotConfigured" />
                        </p>
                      )}

                      {latestUtr && (
                        <p className="mt-3 text-xs text-[var(--sl-ink-2)]">
                          <T k="pay.latestUtr" />{" "}
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
                              aria-label={t("pay.utrPlaceholder")}
                              placeholder={t("pay.utrPlaceholder")}
                              className="h-11 w-full rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] px-3.5 font-mono text-sm outline-none focus:border-[var(--sl-brand)]"
                            />
                            <input
                              type="date"
                              required
                              aria-label={t("pay.paymentDate")}
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              className="h-11 w-full rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] px-3.5 text-sm outline-none focus:border-[var(--sl-brand)]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-[var(--sl-r)] bg-[var(--sl-graphite)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                              >
                                {submitting ? (
                                  <T k="pay.submitting" />
                                ) : (
                                  <T k="orders.submitUtr" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setUtrFirmOrderId(null)}
                                className="rounded-[var(--sl-r)] border border-[var(--sl-rule-2)] px-4 py-2 text-xs font-semibold"
                              >
                                <T k="common.cancel" />
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
                            className="mt-4 rounded-[var(--sl-r)] border border-[var(--sl-rule-2)] bg-[var(--sl-surface)] px-4 py-2 text-xs font-semibold text-[var(--sl-ink)]"
                          >
                            <T k="pay.submitUtrFor" />
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
      </div>
    </StorefrontShell>
  );
}
