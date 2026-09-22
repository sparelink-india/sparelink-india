import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { dealer, partyLedgerEntry } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import {
  assertCreditLimitAllows,
  assertLedgerEntryType,
  computeLedgerDeltaPaise,
  nextBalanceAfterPaise,
  publicDealerCreditView,
  type LedgerEntryType,
} from "@/lib/party-credit";

export async function getDealerOutstandingPaise(dealerId: string): Promise<number> {
  const latest = await getDb()
    .select({ balanceAfterPaise: partyLedgerEntry.balanceAfterPaise })
    .from(partyLedgerEntry)
    .where(eq(partyLedgerEntry.dealerId, dealerId))
    .orderBy(desc(partyLedgerEntry.createdAt))
    .limit(1);
  return latest[0]?.balanceAfterPaise ?? 0;
}

export async function getDealerCreditSummary(dealerId: string) {
  const profile = await getDb().query.dealer.findFirst({
    where: eq(dealer.id, dealerId),
  });
  if (!profile) return null;
  const outstandingPaise = await getDealerOutstandingPaise(dealerId);
  return {
    dealerId,
    businessName: profile.businessName,
    ...publicDealerCreditView({
      creditLimitPaise: profile.creditLimitPaise,
      outstandingPaise,
    }),
  };
}

export async function listDealerLedger(dealerId: string, limit = 100) {
  return getDb()
    .select()
    .from(partyLedgerEntry)
    .where(eq(partyLedgerEntry.dealerId, dealerId))
    .orderBy(desc(partyLedgerEntry.createdAt))
    .limit(limit);
}

export async function postPartyLedgerEntry(input: {
  dealerId: string;
  entryType: LedgerEntryType;
  amountPaise: number;
  adjustmentSignedPaise?: number;
  referenceType?: string | null;
  referenceId?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  actorUserId?: string | null;
}): Promise<
  | { ok: true; entry: typeof partyLedgerEntry.$inferSelect; created: boolean }
  | { ok: false; error: string; status: number }
> {
  const db = getDb();

  if (input.idempotencyKey) {
    const existing = await db.query.partyLedgerEntry.findFirst({
      where: eq(partyLedgerEntry.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      return { ok: true, entry: existing, created: false };
    }
  }

  const profile = await db.query.dealer.findFirst({
    where: eq(dealer.id, input.dealerId),
  });
  if (!profile) {
    return { ok: false, error: "Dealer not found", status: 404 };
  }

  const delta = computeLedgerDeltaPaise(
    input.entryType,
    input.amountPaise,
    input.adjustmentSignedPaise,
  );
  if (input.entryType !== "adjustment" && (!Number.isInteger(input.amountPaise) || input.amountPaise < 0)) {
    return {
      ok: false,
      error: "amountPaise must be a non-negative integer",
      status: 400,
    };
  }

  const previous = await getDealerOutstandingPaise(input.dealerId);
  const balanceAfterPaise = nextBalanceAfterPaise(previous, delta);
  const storedAmount =
    input.entryType === "adjustment"
      ? Math.abs(Math.round(input.adjustmentSignedPaise ?? input.amountPaise))
      : Math.max(0, Math.round(input.amountPaise));

  const id = randomUUID();
  try {
    await db.insert(partyLedgerEntry).values({
      id,
      dealerId: input.dealerId,
      entryType: input.entryType,
      amountPaise: storedAmount,
      balanceAfterPaise,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      externalReference: input.externalReference ?? null,
      notes: input.notes ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdByUserId: input.actorUserId ?? null,
    });
  } catch (error) {
    if (input.idempotencyKey) {
      const raced = await db.query.partyLedgerEntry.findFirst({
        where: eq(partyLedgerEntry.idempotencyKey, input.idempotencyKey),
      });
      if (raced) return { ok: true, entry: raced, created: false };
    }
    throw error;
  }

  const entry = await db.query.partyLedgerEntry.findFirst({
    where: eq(partyLedgerEntry.id, id),
  });
  if (!entry) {
    return { ok: false, error: "Failed to load ledger entry", status: 500 };
  }

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "party_ledger.post",
    entityType: "party_ledger_entry",
    entityId: id,
    metadata: {
      dealerId: input.dealerId,
      entryType: input.entryType,
      amountPaise: storedAmount,
      deltaPaise: delta,
      balanceAfterPaise,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
    },
  });

  return { ok: true, entry, created: true };
}

export async function setDealerCreditLimit(input: {
  dealerId: string;
  creditLimitPaise: number;
  actorUserId: string;
}) {
  if (!Number.isInteger(input.creditLimitPaise) || input.creditLimitPaise < 0) {
    return {
      ok: false as const,
      error: "creditLimitPaise must be a non-negative integer",
      status: 400,
    };
  }
  const db = getDb();
  const existing = await db.query.dealer.findFirst({
    where: eq(dealer.id, input.dealerId),
  });
  if (!existing) {
    return { ok: false as const, error: "Dealer not found", status: 404 };
  }

  await db
    .update(dealer)
    .set({
      creditLimitPaise: input.creditLimitPaise,
      updatedAt: new Date(),
    })
    .where(eq(dealer.id, input.dealerId));

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "dealer.credit_limit_update",
    entityType: "dealer",
    entityId: input.dealerId,
    metadata: {
      previous: existing.creditLimitPaise,
      creditLimitPaise: input.creditLimitPaise,
    },
  });

  return {
    ok: true as const,
    previous: existing.creditLimitPaise,
    creditLimitPaise: input.creditLimitPaise,
  };
}

export async function assertDealerCreditForDebit(input: {
  dealerId: string;
  additionalDebitPaise: number;
}) {
  const summary = await getDealerCreditSummary(input.dealerId);
  if (!summary) {
    return { ok: false as const, error: "Dealer not found", status: 404 };
  }
  const check = assertCreditLimitAllows(
    summary.creditLimitPaise,
    summary.outstandingPaise,
    input.additionalDebitPaise,
  );
  if (!check.ok) {
    return { ok: false as const, error: check.error, status: 409 };
  }
  return { ok: true as const, summary, enforced: check.enforced };
}

export { assertLedgerEntryType, publicDealerCreditView };
