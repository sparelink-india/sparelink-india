import { createHash } from "node:crypto";

import type { CiSourceProduct } from "./types";

/**
 * Identity key for CI source matching.
 * Uses exact source SKU (preserves M-663 vs M663, 00110L vs 00110R).
 * Never match solely on product name.
 */
export function sourceIdentityKey(
  sourceKey: string,
  manufacturer: string | null | undefined,
  sku: string,
): string {
  const mfr = String(manufacturer || "ci").trim().toLowerCase();
  const exactSku = String(sku || "").trim();
  return `${sourceKey}\0${mfr}\0${exactSku}`;
}

export function normalizeManufacturer(value: string | null | undefined): string {
  return String(value || "ci").trim().toLowerCase() || "ci";
}

/** Content hash for change detection — excludes SpareLink commercial fields. */
export function hashSourceProduct(product: CiSourceProduct): string {
  const payload = [
    product.sku,
    product.name,
    product.manufacturer ?? "",
    product.brand ?? "",
    product.sourcePricePaise == null ? "" : String(product.sourcePricePaise),
    product.imageUrl ?? "",
    product.sourceUrl ?? "",
    product.oeCode ?? "",
    product.statusSource ?? "",
    product.categoryName ?? "",
    product.sourceId ?? "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function rupeesToPaise(rupees: number | null | undefined): number | null {
  if (rupees == null || !Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number | null | undefined): number | null {
  if (paise == null || !Number.isFinite(paise)) return null;
  return paise / 100;
}

/**
 * Map a raw OnlineAutoHandles / CI API item into a CiSourceProduct.
 * Missing fields stay null — never invent.
 */
export function mapCiApiProduct(raw: Record<string, unknown>): CiSourceProduct | null {
  const sku = String(raw.sku ?? raw.partNumber ?? raw.part_number ?? "").trim();
  const name = String(raw.name ?? raw.title ?? "").trim();
  if (!sku || !name) return null;

  const priceRaw = raw.rate ?? raw.price ?? raw.sourcePrice ?? raw.mrp;
  let sourcePricePaise: number | null = null;
  if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
    sourcePricePaise = rupeesToPaise(priceRaw);
  } else if (typeof priceRaw === "string" && priceRaw.trim()) {
    const n = Number(priceRaw);
    if (Number.isFinite(n)) sourcePricePaise = rupeesToPaise(n);
  }

  return {
    sourceId: raw.id != null ? String(raw.id) : raw.sourceId != null ? String(raw.sourceId) : null,
    sku,
    name,
    manufacturer:
      raw.manufacturer != null
        ? String(raw.manufacturer)
        : raw.brand != null
          ? String(raw.brand)
          : null,
    brand: raw.brand != null ? String(raw.brand) : null,
    sourcePricePaise,
    imageUrl: raw.imageUrl != null ? String(raw.imageUrl) : raw.image_url != null ? String(raw.image_url) : null,
    sourceUrl: raw.sourceUrl != null ? String(raw.sourceUrl) : raw.url != null ? String(raw.url) : null,
    oeCode: raw.oeCode != null ? String(raw.oeCode) : raw.oe_code != null ? String(raw.oe_code) : null,
    statusSource:
      raw.statusSource != null
        ? String(raw.statusSource)
        : raw.status != null
          ? String(raw.status)
          : null,
    categoryName:
      raw.categoryName != null
        ? String(raw.categoryName)
        : raw.category != null
          ? String(raw.category)
          : null,
  };
}
