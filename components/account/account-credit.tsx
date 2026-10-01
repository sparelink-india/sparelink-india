"use client";

import { useEffect, useState } from "react";

import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Accounts Summary and Ledger, backed by the EXISTING dealer credit endpoint.
 *
 * No new API was written and no financial value is computed here. This reads
 * `/api/dealer/credit`, which returns `getDealerCreditSummary` (credit limit,
 * outstanding, available credit) and `listDealerLedger`. Every figure rendered
 * comes straight from that response.
 *
 * TWO HONEST LIMITATIONS, both surfaced rather than papered over:
 *
 *  - The endpoint is gated to the `dealer` role. A `buyer` account receives 403
 *    and is shown "not available for your account type". Inventing a summary
 *    for buyers, or zeroing it, would be fabricating financial data.
 *
 *  - There is no overdue figure. `publicDealerCreditView` returns creditLimit,
 *    outstanding, availableCredit and a creditEnforcement flag - nothing about
 *    due dates. The Overdue tile therefore states that it is not tracked rather
 *    than showing 0, which would read as "you owe nothing".
 */

type CreditSummary = {
  creditLimitPaise?: number;
  outstandingPaise?: number;
  availableCreditPaise?: number | null;
  creditEnforcementEnabled?: boolean;
  businessName?: string;
};

type LedgerEntry = {
  id: string;
  entryType: string;
  amountPaise: number;
  balanceAfterPaise: number;
  externalReference?: string | null;
  notes?: string | null;
  createdAt: string;
};

type CreditState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "ready"; summary: CreditSummary | null; ledger: LedgerEntry[] };

function rupees(paise: number | null | undefined) {
  /* A MISSING amount must read as "not available", never as zero.
     `paise ?? 0` used to turn a null Outstanding or Credit Limit into a
     confident "₹0", which a customer reads as "you owe nothing" rather than
     "this account has no credit line set up". Only a real 0 renders as ₹0. */
  if (typeof paise !== "number" || !Number.isFinite(paise)) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function useCreditData() {
  const [state, setState] = useState<CreditState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/dealer/credit", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        // 403 here is the role gate, not a failure. It is a real, expected
        // answer for a buyer account and gets its own state.
        if (response.status === 403) return { kind: "forbidden" as const };
        if (response.status === 401) return { kind: "forbidden" as const };
        if (!response.ok) return { kind: "error" as const };
        return { kind: "ready" as const, data: await response.json() };
      })
      .then((result) => {
        if (result.kind === "ready") {
          setState({
            status: "ready",
            summary: result.data?.summary ?? null,
            ledger: Array.isArray(result.data?.ledger) ? result.data.ledger : [],
          });
        } else {
          setState({ status: result.kind });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  return state;
}

export function AccountSummary() {
  const { t } = useI18n();
  const state = useCreditData();

  if (state.status === "loading") {
    return (
      <p className="mt-6 text-sm text-[var(--v3-text-3)]" role="status" aria-live="polite">
        {t("common.loading")}
      </p>
    );
  }
  if (state.status === "forbidden") {
    return (
      <SectionEmpty
        title={t("accounts.summary")}
        body={t("accounts.unavailable")}
      />
    );
  }
  if (state.status === "error") {
    return <SectionEmpty title={t("accounts.summary")} body={t("accounts.loadFail")} />;
  }

  const summary = state.summary;

  const tiles: Array<{ label: MessageKey; value: string }> = [
    { label: "accounts.outstanding", value: rupees(summary?.outstandingPaise) },
    { label: "accounts.creditLimit", value: rupees(summary?.creditLimitPaise) },
    {
      label: "accounts.availableCredit",
      value:
        summary?.availableCreditPaise === null || summary?.availableCreditPaise === undefined
          ? t("accounts.notConfigured")
          : rupees(summary.availableCreditPaise),
    },
  ];

  return (
    <div className="mt-6">
      {summary?.businessName ? (
        <p className="text-sm font-semibold text-[var(--v3-text)]">{summary.businessName}</p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--v3-text-3)]">
              {t(tile.label)}
            </p>
            <p className="v3-num mt-1.5 text-2xl font-extrabold text-[var(--v3-text)]">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* Overdue is deliberately not given a number. See the note above. */}
      <div className="mt-3 rounded-[var(--v3-r-lg)] border border-dashed border-[var(--v3-rule-strong)] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--v3-text-3)]">
          {t("accounts.overdue")}
        </p>
        <p className="mt-1 text-sm text-[var(--v3-text-2)]">{t("accounts.notConfigured")}</p>
      </div>
    </div>
  );
}

export function AccountLedger() {
  const { t } = useI18n();
  const state = useCreditData();

  if (state.status === "loading") {
    return (
      <p className="mt-6 text-sm text-[var(--v3-text-3)]" role="status" aria-live="polite">
        {t("common.loading")}
      </p>
    );
  }
  if (state.status === "forbidden") {
    return <SectionEmpty title={t("accounts.ledger")} body={t("accounts.unavailable")} />;
  }
  if (state.status === "error") {
    return <SectionEmpty title={t("accounts.ledger")} body={t("accounts.loadFail")} />;
  }
  if (!state.ledger.length) {
    return <SectionEmpty title={t("accounts.ledger")} body={t("accounts.emptyLedger")} />;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="bg-[var(--v3-sunk)] text-[11px] font-bold uppercase tracking-wide text-[var(--v3-text-3)]">
          <tr>
            <th className="px-3 py-2.5">{t("accounts.date")}</th>
            <th className="px-3 py-2.5">{t("accounts.type")}</th>
            <th className="px-3 py-2.5">{t("accounts.reference")}</th>
            <th className="px-3 py-2.5 text-right">{t("accounts.amount")}</th>
            <th className="px-3 py-2.5 text-right">{t("accounts.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {state.ledger.map((entry) => (
            <tr key={entry.id} className="border-t border-[var(--v3-rule)]">
              <td className="whitespace-nowrap px-3 py-2 text-[var(--v3-text-2)]">
                {new Date(entry.createdAt).toLocaleDateString("en-IN")}
              </td>
              <td className="px-3 py-2 text-[var(--v3-text-2)]">{entry.entryType}</td>
              <td className="px-3 py-2 text-[var(--v3-text-2)]">
                {entry.externalReference || entry.notes || "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-[var(--v3-text)]">
                {rupees(entry.amountPaise)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-[var(--v3-text-2)]">
                {rupees(entry.balanceAfterPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
