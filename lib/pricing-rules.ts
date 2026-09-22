/**
 * Pure helpers for dealer/customer pricing-rule hierarchy.
 * Never invents discount percentages — missing rules yield listing price (0%).
 */

import { applyInclusiveDiscount, clampDiscountPercent } from "@/lib/party-pricing";

export const PRICING_RULE_SCOPES = [
  "customer",
  "dealer",
  "pricing_category",
] as const;

export type PricingRuleScope = (typeof PRICING_RULE_SCOPES)[number];

export type PricingRuleCandidate = {
  id: string;
  scope: PricingRuleScope;
  discountPercent: number | null;
  isActive: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
};

export type EffectivePriceResult = {
  listInclusivePaise: number;
  discountPercent: number;
  netInclusivePaise: number;
  source:
    | "customer_rule"
    | "dealer_rule"
    | "category_rule"
    | "verification_specific"
    | "verification_common"
    | "listing";
  ruleId: string | null;
};

export function isPricingRuleCurrentlyValid(
  rule: Pick<PricingRuleCandidate, "isActive" | "validFrom" | "validUntil">,
  now: Date = new Date(),
): boolean {
  if (!rule.isActive) return false;
  if (rule.validFrom && rule.validFrom > now) return false;
  if (rule.validUntil && rule.validUntil < now) return false;
  return true;
}

export function pickHighestPriorityRule(
  rules: PricingRuleCandidate[],
  now: Date = new Date(),
): PricingRuleCandidate | null {
  const order: PricingRuleScope[] = ["customer", "dealer", "pricing_category"];
  for (const scope of order) {
    const match = rules.find(
      (r) =>
        r.scope === scope &&
        isPricingRuleCurrentlyValid(r, now) &&
        r.discountPercent !== null &&
        clampDiscountPercent(r.discountPercent) !== null,
    );
    if (match) return match;
  }
  return null;
}

export function resolveEffectiveSellingPrice(input: {
  listInclusivePaise: number;
  matchedRule: PricingRuleCandidate | null;
  verificationSpecificPercent?: number | null;
  verificationCommonPercent?: number;
}): EffectivePriceResult {
  const list = Math.max(0, Math.round(input.listInclusivePaise));

  if (
    input.matchedRule &&
    input.matchedRule.discountPercent !== null &&
    clampDiscountPercent(input.matchedRule.discountPercent) !== null
  ) {
    const percent = clampDiscountPercent(input.matchedRule.discountPercent) ?? 0;
    const priced = applyInclusiveDiscount(list, percent);
    const source =
      input.matchedRule.scope === "customer"
        ? "customer_rule"
        : input.matchedRule.scope === "dealer"
          ? "dealer_rule"
          : "category_rule";
    return {
      listInclusivePaise: list,
      discountPercent: priced.discountPercent,
      netInclusivePaise: priced.netInclusivePaise,
      source,
      ruleId: input.matchedRule.id,
    };
  }

  if (
    input.verificationSpecificPercent !== null &&
    input.verificationSpecificPercent !== undefined &&
    clampDiscountPercent(input.verificationSpecificPercent) !== null
  ) {
    const percent = clampDiscountPercent(input.verificationSpecificPercent) ?? 0;
    const priced = applyInclusiveDiscount(list, percent);
    return {
      listInclusivePaise: list,
      discountPercent: priced.discountPercent,
      netInclusivePaise: priced.netInclusivePaise,
      source: "verification_specific",
      ruleId: null,
    };
  }

  const common = clampDiscountPercent(input.verificationCommonPercent ?? 0) ?? 0;
  if (common > 0) {
    const priced = applyInclusiveDiscount(list, common);
    return {
      listInclusivePaise: list,
      discountPercent: priced.discountPercent,
      netInclusivePaise: priced.netInclusivePaise,
      source: "verification_common",
      ruleId: null,
    };
  }

  return {
    listInclusivePaise: list,
    discountPercent: 0,
    netInclusivePaise: list,
    source: "listing",
    ruleId: null,
  };
}

export function publicEffectivePrice(result: EffectivePriceResult) {
  return {
    listInclusivePaise: result.listInclusivePaise,
    discountPercent: result.discountPercent,
    netInclusivePaise: result.netInclusivePaise,
    source: result.source,
  };
}

export function assertScope(scope: unknown): PricingRuleScope | null {
  if (typeof scope !== "string") return null;
  return (PRICING_RULE_SCOPES as readonly string[]).includes(scope)
    ? (scope as PricingRuleScope)
    : null;
}
