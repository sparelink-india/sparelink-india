import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { pricingRule } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  serializeRuleForAudit,
  validateRulePayload,
  writePricingRuleAudit,
} from "@/lib/pricing-rules-service";
import { requireAdminApi } from "@/lib/require-role";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await params;
  const existing = await getDb().query.pricingRule.findFirst({
    where: eq(pricingRule.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const merged = {
    name: body.name ?? existing.name,
    scope: body.scope ?? existing.scope,
    pricingCategoryId:
      body.pricingCategoryId !== undefined
        ? body.pricingCategoryId
        : existing.pricingCategoryId,
    customerUserId:
      body.customerUserId !== undefined
        ? body.customerUserId
        : existing.customerUserId,
    dealerId: body.dealerId !== undefined ? body.dealerId : existing.dealerId,
    discountPercent:
      body.discountPercent !== undefined
        ? body.discountPercent
        : existing.discountPercent,
    isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    validFrom:
      body.validFrom !== undefined
        ? body.validFrom
        : existing.validFrom?.toISOString() ?? null,
    validUntil:
      body.validUntil !== undefined
        ? body.validUntil
        : existing.validUntil?.toISOString() ?? null,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  };

  const parsed = validateRulePayload(merged as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await getDb()
    .update(pricingRule)
    .set({
      ...parsed.value,
      updatedByUserId: access.session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(pricingRule.id, id));

  const updated = await getDb().query.pricingRule.findFirst({
    where: eq(pricingRule.id, id),
  });
  if (updated) {
    await writePricingRuleAudit({
      pricingRuleId: id,
      actorUserId: access.session.user.id,
      action: "update",
      oldValues: serializeRuleForAudit(existing),
      newValues: serializeRuleForAudit(updated),
    });
  }

  return NextResponse.json({ id, ...parsed.value });
}
