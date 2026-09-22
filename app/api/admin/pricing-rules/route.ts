import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { pricingRule } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  serializeRuleForAudit,
  validateRulePayload,
  writePricingRuleAudit,
} from "@/lib/pricing-rules-service";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const rules = await getDb()
    .select()
    .from(pricingRule)
    .orderBy(desc(pricingRule.updatedAt))
    .limit(300);
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = validateRulePayload(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const id = randomUUID();
  await getDb()
    .insert(pricingRule)
    .values({
      id,
      ...parsed.value,
      createdByUserId: access.session.user.id,
      updatedByUserId: access.session.user.id,
    });

  const created = await getDb().query.pricingRule.findFirst({
    where: eq(pricingRule.id, id),
  });
  if (created) {
    await writePricingRuleAudit({
      pricingRuleId: id,
      actorUserId: access.session.user.id,
      action: "create",
      oldValues: null,
      newValues: serializeRuleForAudit(created),
    });
  }

  return NextResponse.json({ id, ...parsed.value }, { status: 201 });
}
