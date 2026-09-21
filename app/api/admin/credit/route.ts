import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

import { dealer } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  assertLedgerEntryType,
  getDealerCreditSummary,
  listDealerLedger,
  postPartyLedgerEntry,
  setDealerCreditLimit,
} from "@/lib/party-credit-service";
import { requireAdminApi } from "@/lib/require-role";

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const url = new URL(request.url);
  const dealerId = url.searchParams.get("dealerId")?.trim() || "";
  if (!dealerId) {
    const dealers = await getDb()
      .select({
        id: dealer.id,
        businessName: dealer.businessName,
        creditLimitPaise: dealer.creditLimitPaise,
        approvalStatus: dealer.approvalStatus,
      })
      .from(dealer)
      .orderBy(desc(dealer.createdAt))
      .limit(200);

    const summaries = [];
    for (const d of dealers) {
      const summary = await getDealerCreditSummary(d.id);
      if (summary) summaries.push(summary);
    }
    return NextResponse.json({ dealers: summaries });
  }

  const summary = await getDealerCreditSummary(dealerId);
  if (!summary) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }
  const ledger = await listDealerLedger(dealerId);
  return NextResponse.json({ summary, ledger });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const dealerId =
    typeof body.dealerId === "string" ? body.dealerId.trim() : "";
  if (!dealerId) {
    return NextResponse.json({ error: "dealerId is required" }, { status: 400 });
  }

  if (body.action === "set_credit_limit") {
    const creditLimitPaise = Number(body.creditLimitPaise);
    const result = await setDealerCreditLimit({
      dealerId,
      creditLimitPaise,
      actorUserId: access.session.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const summary = await getDealerCreditSummary(dealerId);
    return NextResponse.json({ success: true, summary });
  }

  if (body.action === "post_entry") {
    const entryType = assertLedgerEntryType(body.entryType);
    if (!entryType) {
      return NextResponse.json(
        { error: "entryType must be debit|credit|payment|adjustment" },
        { status: 400 },
      );
    }
    const amountPaise = Number(body.amountPaise);
    const adjustmentSignedPaise =
      entryType === "adjustment" ? Number(body.signedAmountPaise ?? body.amountPaise) : undefined;

    const result = await postPartyLedgerEntry({
      dealerId,
      entryType,
      amountPaise,
      adjustmentSignedPaise,
      referenceType:
        typeof body.referenceType === "string" ? body.referenceType : null,
      referenceId:
        typeof body.referenceId === "string" ? body.referenceId : null,
      externalReference:
        typeof body.externalReference === "string"
          ? body.externalReference
          : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
      actorUserId: access.session.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const summary = await getDealerCreditSummary(dealerId);
    return NextResponse.json({
      success: true,
      created: result.created,
      entry: result.entry,
      summary,
    });
  }

  return NextResponse.json(
    { error: "action must be set_credit_limit|post_entry" },
    { status: 400 },
  );
}
