/**
 * Party (dealer) credit / outstanding ledger helpers.
 * Outstanding is derived from immutable ledger entries — never a mutable magic field.
 *
 * Business decision (documented): creditLimitPaise === 0 means "limit not configured /
 * enforcement off" so existing Phase 6 SO flows are not suddenly blocked. Admins must
 * set a positive limit to enable enforcement. Do not invent outstanding balances.
 */

export const LEDGER_ENTRY_TYPES = [
  "debit",
  "credit",
  "payment",
  "adjustment",
] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export function computeLedgerDeltaPaise(
  entryType: LedgerEntryType,
  amountPaise: number,
  /** For adjustments only: positive increases outstanding, negative decreases. */
  adjustmentSignedPaise?: number,
): number {
  if (entryType === "adjustment") {
    return Math.round(adjustmentSignedPaise ?? amountPaise);
  }
  const amount = Math.max(0, Math.round(amountPaise));
  if (entryType === "debit") return amount;
  return -amount; // credit | payment
}

export function nextBalanceAfterPaise(
  previousBalancePaise: number,
  deltaPaise: number,
): number {
  return Math.round(previousBalancePaise) + Math.round(deltaPaise);
}

/**
 * Enforce only when a positive credit limit is configured.
 * limit === 0 → skip (not configured). Never invent a limit.
 */
export function assertCreditLimitAllows(
  creditLimitPaise: number,
  outstandingPaise: number,
  additionalDebitPaise: number,
): { ok: true; enforced: boolean } | { ok: false; error: string; enforced: true } {
  const limit = Math.round(creditLimitPaise);
  const outstanding = Math.round(outstandingPaise);
  const add = Math.max(0, Math.round(additionalDebitPaise));

  if (!Number.isFinite(limit) || limit <= 0) {
    return { ok: true, enforced: false };
  }

  if (outstanding + add > limit) {
    return {
      ok: false,
      enforced: true,
      error: "Order would exceed configured credit limit.",
    };
  }
  return { ok: true, enforced: true };
}

export function assertLedgerEntryType(
  value: unknown,
): LedgerEntryType | null {
  if (typeof value !== "string") return null;
  return (LEDGER_ENTRY_TYPES as readonly string[]).includes(value)
    ? (value as LedgerEntryType)
    : null;
}

export function publicDealerCreditView(input: {
  creditLimitPaise: number;
  outstandingPaise: number;
}) {
  const creditLimitPaise = Math.max(0, Math.round(input.creditLimitPaise));
  const outstandingPaise = Math.round(input.outstandingPaise);
  const availableCreditPaise =
    creditLimitPaise > 0
      ? Math.max(0, creditLimitPaise - outstandingPaise)
      : null;
  return {
    creditLimitPaise,
    outstandingPaise,
    availableCreditPaise,
    creditEnforcementEnabled: creditLimitPaise > 0,
  };
}
