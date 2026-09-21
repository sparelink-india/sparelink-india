import { and, eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  dealer,
  pricingCategory,
  pricingRule,
  pricingRuleAudit,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  getCommonCustomerDiscountPercent,
  getCustomerDiscountPercent,
} from "@/lib/customer-discount";
import { clampDiscountPercent } from "@/lib/party-pricing";
import {
  assertScope,
  pickHighestPriorityRule,
  publicEffectivePrice,
  resolveEffectiveSellingPrice,
  type EffectivePriceResult,
  type PricingRuleCandidate,
  type PricingRuleScope,
} from "@/lib/pricing-rules";
import { writeAuditLog } from "@/lib/audit";

function toCandidate(row: {
  id: string;
  scope: string;
  discountPercent: number | null;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
}): PricingRuleCandidate | null {
  const scope = assertScope(row.scope);
  if (!scope) return null;
  return {
    id: row.id,
    scope,
    discountPercent: row.discountPercent,
    isActive: row.isActive,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  };
}

export async function loadMatchingPricingRules(input: {
  customerUserId?: string | null;
  dealerId?: string | null;
  pricingCategoryId?: string | null;
  priceGroupCode?: string | null;
}): Promise<PricingRuleCandidate[]> {
  const db = getDb();
  const conditions = [];

  if (input.customerUserId) {
    conditions.push(
      and(
        eq(pricingRule.scope, "customer"),
        eq(pricingRule.customerUserId, input.customerUserId),
      ),
    );
  }
  if (input.dealerId) {
    conditions.push(
      and(eq(pricingRule.scope, "dealer"), eq(pricingRule.dealerId, input.dealerId)),
    );
  }

  let categoryId = input.pricingCategoryId ?? null;
  if (!categoryId && input.priceGroupCode) {
    const cat = await db.query.pricingCategory.findFirst({
      where: and(
        eq(pricingCategory.code, input.priceGroupCode),
        eq(pricingCategory.isActive, true),
      ),
    });
    categoryId = cat?.id ?? null;
  }
  if (categoryId) {
    conditions.push(
      and(
        eq(pricingRule.scope, "pricing_category"),
        eq(pricingRule.pricingCategoryId, categoryId),
      ),
    );
  }

  if (conditions.length === 0) return [];

  const rows = await db
    .select()
    .from(pricingRule)
    .where(and(eq(pricingRule.isActive, true), or(...conditions)));

  return rows
    .map(toCandidate)
    .filter((r): r is PricingRuleCandidate => r !== null);
}

export async function resolvePartyEffectivePrice(input: {
  listInclusivePaise: number;
  customerUserId?: string | null;
  dealerId?: string | null;
  applyVerificationFallback?: boolean;
}): Promise<EffectivePriceResult> {
  let priceGroup: string | null = null;
  if (input.dealerId) {
    const d = await getDb().query.dealer.findFirst({
      where: eq(dealer.id, input.dealerId),
    });
    priceGroup = d?.priceGroup ?? null;
  }

  const rules = await loadMatchingPricingRules({
    customerUserId: input.customerUserId,
    dealerId: input.dealerId,
    priceGroupCode: priceGroup,
  });
  const matched = pickHighestPriorityRule(rules);

  let verificationSpecific: number | null = null;
  let verificationCommon = 0;
  if (input.applyVerificationFallback !== false) {
    verificationCommon = await getCommonCustomerDiscountPercent();
    if (input.customerUserId) {
      verificationSpecific = await getCustomerDiscountPercent(input.customerUserId);
    }
  }

  return resolveEffectiveSellingPrice({
    listInclusivePaise: input.listInclusivePaise,
    matchedRule: matched,
    verificationSpecificPercent: verificationSpecific,
    verificationCommonPercent: verificationCommon,
  });
}

export async function writePricingRuleAudit(input: {
  pricingRuleId: string;
  actorUserId?: string | null;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  await getDb().insert(pricingRuleAudit).values({
    id: randomUUID(),
    pricingRuleId: input.pricingRuleId,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    oldValues: input.oldValues ? JSON.stringify(input.oldValues) : null,
    newValues: input.newValues ? JSON.stringify(input.newValues) : null,
  });
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: `pricing_rule.${input.action}`,
    entityType: "pricing_rule",
    entityId: input.pricingRuleId,
    metadata: {
      oldValues: input.oldValues ?? null,
      newValues: input.newValues ?? null,
    },
  });
}

export function serializeRuleForAudit(row: {
  id: string;
  name: string;
  scope: string;
  pricingCategoryId: string | null;
  customerUserId: string | null;
  dealerId: string | null;
  discountPercent: number | null;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  notes: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    pricingCategoryId: row.pricingCategoryId,
    customerUserId: row.customerUserId,
    dealerId: row.dealerId,
    discountPercent: row.discountPercent,
    isActive: row.isActive,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    notes: row.notes,
  };
}

export function parseDiscountPercentField(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return clampDiscountPercent(
    typeof value === "number" ? value : Number(value),
  );
}

export function validateRulePayload(body: Record<string, unknown>): {
  ok: true;
  value: {
    name: string;
    scope: PricingRuleScope;
    pricingCategoryId: string | null;
    customerUserId: string | null;
    dealerId: string | null;
    discountPercent: number | null;
    isActive: boolean;
    validFrom: Date | null;
    validUntil: Date | null;
    notes: string | null;
  };
} | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };
  const scope = assertScope(body.scope);
  if (!scope) {
    return {
      ok: false,
      error: "scope must be customer|dealer|pricing_category",
    };
  }
  const discountRaw =
    body.discountPercent === undefined ? null : body.discountPercent;
  const discountPercent = parseDiscountPercentField(discountRaw);
  if (discountPercent === undefined) {
    return {
      ok: false,
      error: "discountPercent must be an integer 0-100 or null",
    };
  }

  const pricingCategoryId =
    typeof body.pricingCategoryId === "string" && body.pricingCategoryId.trim()
      ? body.pricingCategoryId.trim()
      : null;
  const customerUserId =
    typeof body.customerUserId === "string" && body.customerUserId.trim()
      ? body.customerUserId.trim()
      : null;
  const dealerId =
    typeof body.dealerId === "string" && body.dealerId.trim()
      ? body.dealerId.trim()
      : null;

  if (scope === "customer" && !customerUserId) {
    return { ok: false, error: "customer scope requires customerUserId" };
  }
  if (scope === "dealer" && !dealerId) {
    return { ok: false, error: "dealer scope requires dealerId" };
  }
  if (scope === "pricing_category" && !pricingCategoryId) {
    return {
      ok: false,
      error: "pricing_category scope requires pricingCategoryId",
    };
  }

  const isActive = body.isActive === false ? false : true;
  const validFrom =
    typeof body.validFrom === "string" && body.validFrom.trim()
      ? new Date(body.validFrom)
      : null;
  const validUntil =
    typeof body.validUntil === "string" && body.validUntil.trim()
      ? new Date(body.validUntil)
      : null;
  if (validFrom && Number.isNaN(validFrom.getTime())) {
    return { ok: false, error: "invalid validFrom" };
  }
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    return { ok: false, error: "invalid validUntil" };
  }

  return {
    ok: true,
    value: {
      name,
      scope,
      pricingCategoryId: scope === "pricing_category" ? pricingCategoryId : null,
      customerUserId: scope === "customer" ? customerUserId : null,
      dealerId: scope === "dealer" ? dealerId : null,
      discountPercent: discountPercent ?? null,
      isActive,
      validFrom,
      validUntil,
      notes:
        typeof body.notes === "string" ? body.notes.trim() || null : null,
    },
  };
}

export { publicEffectivePrice };
