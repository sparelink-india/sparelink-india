import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { dealer } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  getDealerCreditSummary,
  listDealerLedger,
} from "@/lib/party-credit-service";
import { requireDealerApi } from "@/lib/require-role";

/** Dealer may view only their own credit limit / outstanding / ledger. */
export async function GET() {
  const auth = await requireDealerApi();
  if ("error" in auth) return auth.error;

  const profile = await getDb().query.dealer.findFirst({
    where: eq(dealer.userId, auth.session.user.id),
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Dealer profile not found" },
      { status: 404 },
    );
  }

  const summary = await getDealerCreditSummary(profile.id);
  const ledger = await listDealerLedger(profile.id, 50);

  return NextResponse.json({
    summary,
    ledger: ledger.map((entry) => ({
      id: entry.id,
      entryType: entry.entryType,
      amountPaise: entry.amountPaise,
      balanceAfterPaise: entry.balanceAfterPaise,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      externalReference: entry.externalReference,
      notes: entry.notes,
      createdAt: entry.createdAt,
    })),
  });
}
