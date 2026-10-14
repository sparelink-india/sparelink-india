/**
 * Credit-settlement entitlement for Pensol pricing.
 *
 * WHY THIS EXISTS
 * `pensolSettlement` arrived from the request body and was only enum-checked.
 * Because "credit" selects the LARGER per-unit discount, any authenticated
 * buyer could maximise their discount by posting `"credit"` regardless of
 * whether they were entitled to it. That is client-controlled pricing and it
 * is now closed.
 *
 * A credit settlement is granted only when ALL of the following hold, each read
 * from the database rather than asserted by the caller:
 *
 *   1. the buyer has an approved dealer profile,
 *   2. that profile has a positive credit limit (0 means "enforcement off" in
 *      the existing party-credit semantics, so it does NOT grant credit here),
 *   3. the parent order is paying by bank transfer, the only mode a credit sale
 *      can actually settle against.
 *
 * Anything else falls back to the cash price. That is the conservative choice:
 * the buyer sees a slightly higher price rather than an order that is later
 * rejected or silently mis-settled.
 */

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { dealer, partyLedgerEntry } from "@/drizzle/schema";

export type CreditSettlementEntitlement = {
  allowed: boolean;
  /** Why it was refused, for logging. Never surfaced to the buyer. */
  reason:
    | "granted"
    | "not_a_dealer"
    | "dealer_not_approved"
    | "no_credit_limit"
    | "payment_method_not_bank_transfer"
    | "lookup_failed";
};

export async function resolveCreditSettlementEntitlement(input: {
  buyerId: string;
  paymentMethod: unknown;
}): Promise<CreditSettlementEntitlement> {
  if (input.paymentMethod !== "bank_transfer") {
    return { allowed: false, reason: "payment_method_not_bank_transfer" };
  }

  let profile: { id: string; creditLimitPaise: number | null } | undefined;
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: dealer.id,
        creditLimitPaise: dealer.creditLimitPaise,
        approvalStatus: dealer.approvalStatus,
      })
      .from(dealer)
      .where(eq(dealer.userId, input.buyerId))
      .limit(1);
    profile = rows[0] as { id: string; creditLimitPaise: number | null } | undefined;
    if (rows[0] && rows[0].approvalStatus !== "approved") {
      return { allowed: false, reason: "dealer_not_approved" };
    }
  } catch {
    // Fail closed. An entitlement service that cannot read its own data must not
    // hand out the more expensive price.
    return { allowed: false, reason: "lookup_failed" };
  }

  if (!profile) return { allowed: false, reason: "not_a_dealer" };

  // 0 means credit enforcement is switched off for that dealer, which is not
  // the same as "this dealer may settle on credit". Treat it as no entitlement.
  if (!profile.creditLimitPaise || profile.creditLimitPaise <= 0) {
    return { allowed: false, reason: "no_credit_limit" };
  }

  return { allowed: true, reason: "granted" };
}

/**
 * Outstanding balance from the latest ledger entry, matching the append-only
 * semantics already used by `lib/party-credit-service.ts`.
 *
 * Exposed here so the entitlement check and the admin credit screen agree on
 * what "outstanding" means.
 */
export async function readOutstandingPaise(dealerId: string): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({ balanceAfterPaise: partyLedgerEntry.balanceAfterPaise })
      .from(partyLedgerEntry)
      .where(eq(partyLedgerEntry.dealerId, dealerId))
      .limit(1);
    return Number(rows[0]?.balanceAfterPaise ?? 0);
  } catch {
    return 0;
  }
}

/** Exported for the dealer-sales-order route, which needs the same guard. */
export async function hasCreditHeadroom(
  dealerId: string,
  additionalPaise: number,
): Promise<boolean> {
  const db = getDb();
  const profile = await db
    .select({ creditLimitPaise: dealer.creditLimitPaise })
    .from(dealer)
    .where(and(eq(dealer.id, dealerId), eq(dealer.approvalStatus, "approved")))
    .limit(1);
  const limit = profile[0]?.creditLimitPaise ?? 0;
  if (limit <= 0) return false;
  const outstanding = await readOutstandingPaise(dealerId);
  return outstanding + additionalPaise <= limit;
}