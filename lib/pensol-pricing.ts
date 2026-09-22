/**
 * Pensol payment discounts are fixed paise per UOM, never percentages.
 * DLP/list price stays GST-inclusive and is not recalculated from MRP.
 */

export type PensolSettlement = "cash" | "credit";
export type PensolCategory = "oil" | "grease";
export type PensolUnit = "kg" | "ltr" | "pcs";

export type PensolRate = {
  cashDiscountPaisePerUnit: number;
  creditDiscountPaisePerUnit: number;
};

export type PensolDiscountConfig = {
  oil: PensolRate | null;
  grease: PensolRate | null;
  sku: Record<string, PensolRate>;
};

export type ResolvedPensolDiscount = {
  source: "sku" | "category" | "common" | "none";
  category: PensolCategory | null;
  unit: PensolUnit | null;
  packUnits: number | null;
  rate: PensolRate | null;
  cashDiscountPaisePerUnit: number;
  creditDiscountPaisePerUnit: number;
};

const EMPTY_CONFIG: PensolDiscountConfig = { oil: null, grease: null, sku: {} };

export function emptyPensolConfig(): PensolDiscountConfig {
  return { oil: null, grease: null, sku: {} };
}

export function isPensolProduct(input: {
  brand?: string | null;
  name?: string | null;
  manufacturer?: string | null;
}): boolean {
  const haystack = [input.brand, input.name, input.manufacturer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes("pensol");
}

export function parsePensolSettlement(value: unknown): PensolSettlement | "invalid" | null {
  if (value === undefined || value === null || value === "") return null;
  if (value === "cash" || value === "credit") return value;
  return "invalid";
}

export function parsePaisePerUnit(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100_000_000) return undefined;
  return numeric;
}

export function rupeesToPaise(rupees: unknown): number | null | undefined {
  if (rupees === undefined) return undefined;
  if (rupees === null || rupees === "") return null;
  const numeric = typeof rupees === "number" ? rupees : Number(rupees);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 1_000_000) return undefined;
  return numeric * 100;
}

export function normalizePensolUnit(raw: string | null | undefined): PensolUnit | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (/\bkg\b|kgs|kilogram/.test(value)) return "kg";
  if (/\bltr\b|\blitre\b|\bliter\b|\bl\b/.test(value)) return "ltr";
  if (/\bpcs\b|\bpc\b|\bpiece/.test(value)) return "pcs";
  return null;
}

export function parsePackUnits(
  uom?: string | null,
  name?: string | null,
  specifications?: string | null,
): { unit: PensolUnit | null; packUnits: number | null } {
  const haystack = [uom, name, specifications].filter(Boolean).join(" ");
  const match = haystack.match(
    /(\d+)\s*(kg|kgs|kilogram|ltr|litre|liter|l|pcs|pc|piece)s?\b/i,
  );
  if (match) {
    const packUnits = Number(match[1]);
    if (!Number.isInteger(packUnits) || packUnits <= 0) {
      return { unit: normalizePensolUnit(haystack), packUnits: null };
    }
    return { unit: normalizePensolUnit(match[2]), packUnits };
  }
  const unit = normalizePensolUnit(haystack);
  if (unit) return { unit, packUnits: 1 };
  return { unit: null, packUnits: null };
}

export function detectPensolCategory(
  categoryName?: string | null,
  name?: string | null,
): PensolCategory | null {
  const haystack = [categoryName, name].filter(Boolean).join(" ").toLowerCase();
  const grease = haystack.includes("grease");
  const oil = /\boil\b|lubricant/.test(haystack);
  if (grease && !oil) return "grease";
  if (oil && !grease) return "oil";
  return null;
}

export function normalizePensolConfig(value: unknown): PensolDiscountConfig {
  if (!value || typeof value !== "object") return emptyPensolConfig();
  const raw = value as Record<string, unknown>;
  const skuRaw =
    raw.sku && typeof raw.sku === "object" ? (raw.sku as Record<string, unknown>) : {};
  const sku: Record<string, PensolRate> = {};
  for (const [key, rate] of Object.entries(skuRaw)) {
    const parsed = parsePensolRate(rate);
    if (parsed && key.trim()) sku[key.trim()] = parsed;
  }
  return {
    oil: parsePensolRate(raw.oil),
    grease: parsePensolRate(raw.grease),
    sku,
  };
}

function parsePensolRate(value: unknown): PensolRate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const cash = parsePaisePerUnit(raw.cashDiscountPaisePerUnit);
  const credit = parsePaisePerUnit(raw.creditDiscountPaisePerUnit);
  if (cash === undefined || credit === undefined || cash === null || credit === null) {
    return null;
  }
  return {
    cashDiscountPaisePerUnit: cash,
    creditDiscountPaisePerUnit: credit,
  };
}

export function resolvePensolDiscount(input: {
  isPensol: boolean;
  sku?: string | null;
  categoryName?: string | null;
  name?: string | null;
  uom?: string | null;
  specifications?: string | null;
  customerConfig: PensolDiscountConfig | null;
  commonConfig: PensolDiscountConfig;
}): ResolvedPensolDiscount {
  const pack = parsePackUnits(input.uom, input.name, input.specifications);
  const category = detectPensolCategory(input.categoryName, input.name);
  const none: ResolvedPensolDiscount = {
    source: "none",
    category,
    unit: pack.unit,
    packUnits: pack.packUnits,
    rate: null,
    cashDiscountPaisePerUnit: 0,
    creditDiscountPaisePerUnit: 0,
  };
  if (!input.isPensol) return none;

  const skuKey = String(input.sku || "").trim();
  const customer = input.customerConfig ?? EMPTY_CONFIG;
  const skuRate = skuKey ? customer.sku[skuKey] || input.commonConfig.sku[skuKey] : null;
  if (skuRate) {
    return {
      source: customer.sku[skuKey] ? "sku" : "common",
      category,
      unit: pack.unit,
      packUnits: pack.packUnits,
      rate: skuRate,
      cashDiscountPaisePerUnit: skuRate.cashDiscountPaisePerUnit,
      creditDiscountPaisePerUnit: skuRate.creditDiscountPaisePerUnit,
    };
  }

  if (category && customer[category]) {
    const rate = customer[category];
    return {
      source: "category",
      category,
      unit: pack.unit,
      packUnits: pack.packUnits,
      rate,
      cashDiscountPaisePerUnit: rate.cashDiscountPaisePerUnit,
      creditDiscountPaisePerUnit: rate.creditDiscountPaisePerUnit,
    };
  }

  if (category && input.commonConfig[category]) {
    const rate = input.commonConfig[category];
    return {
      source: "common",
      category,
      unit: pack.unit,
      packUnits: pack.packUnits,
      rate,
      cashDiscountPaisePerUnit: rate.cashDiscountPaisePerUnit,
      creditDiscountPaisePerUnit: rate.creditDiscountPaisePerUnit,
    };
  }

  return none;
}

export function pensolLineDiscountPaise(
  discountPaisePerUnit: number,
  packUnits: number | null,
  quantity: number,
): number | null {
  if (packUnits === null || !Number.isInteger(packUnits) || packUnits <= 0) return null;
  if (!Number.isInteger(quantity) || quantity <= 0) return 0;
  const perUnit = Math.max(0, Math.round(discountPaisePerUnit));
  return perUnit * packUnits * quantity;
}

export function applyPensolNet(
  dlpInclusivePaise: number,
  discountPaisePerUnit: number,
  packUnits: number,
  quantity: number,
) {
  const dlp = Math.max(0, Math.round(dlpInclusivePaise));
  const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  const pack = Number.isInteger(packUnits) && packUnits > 0 ? packUnits : 0;
  const discountPaise = Math.max(0, Math.round(discountPaisePerUnit)) * pack * qty;
  const lineDlp = dlp * qty;
  const applied = Math.min(lineDlp, discountPaise);
  return {
    dlpInclusivePaise: dlp,
    packUnits: pack,
    quantity: qty,
    billableUnits: pack * qty,
    discountPaise: applied,
    netInclusivePaise: lineDlp - applied,
    lineDlpPaise: lineDlp,
  };
}
