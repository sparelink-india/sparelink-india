import { hashSourceProduct, sourceIdentityKey } from "./normalize";
import {
  CI_SOURCE_KEY,
  type CiSourceProduct,
  type ExistingSourceRecord,
  type SyncDiff,
  type SyncDiffItem,
} from "./types";

export type ComputeSyncDiffOptions = {
  sourceKey?: string;
  /**
   * When false (failed / partial fetch), NEVER interpret missing SKUs as removals.
   * Critical safety rule from Phase 7.
   */
  fetchComplete: boolean;
};

/**
 * Diff incoming CI source rows against existing source records.
 * Matching is by source manufacturer + exact source SKU only.
 */
export function computeSyncDiff(
  incoming: CiSourceProduct[],
  existing: ExistingSourceRecord[],
  options: ComputeSyncDiffOptions,
): SyncDiff {
  const sourceKey = options.sourceKey ?? CI_SOURCE_KEY;
  const existingByKey = new Map<string, ExistingSourceRecord>();
  for (const row of existing) {
    const key = sourceIdentityKey(sourceKey, row.manufacturer, row.sourceSku);
    existingByKey.set(key, row);
  }

  const seenKeys = new Set<string>();
  const create: SyncDiffItem[] = [];
  const update: SyncDiffItem[] = [];
  const unchanged: SyncDiffItem[] = [];

  for (const product of incoming) {
    const key = sourceIdentityKey(sourceKey, product.manufacturer, product.sku);
    if (seenKeys.has(key)) {
      // Duplicate SKU in same fetch — keep first, skip later (no name-based merge).
      continue;
    }
    seenKeys.add(key);
    const prior = existingByKey.get(key);
    if (!prior) {
      create.push({
        kind: "create",
        incoming: product,
        existing: null,
        sourcePriceChanged: false,
        imageChanged: false,
      });
      continue;
    }

    const nextHash = hashSourceProduct(product);
    const sourcePriceChanged =
      prior.sourcePricePaise !== product.sourcePricePaise &&
      product.sourcePricePaise != null;
    const imageChanged =
      Boolean(product.imageUrl) &&
      product.imageUrl !== prior.sourceImageUrl;
    const hashChanged = prior.sourceHash !== nextHash;

    if (!hashChanged && !sourcePriceChanged) {
      unchanged.push({
        kind: "unchanged",
        incoming: product,
        existing: prior,
        sourcePriceChanged: false,
        imageChanged: false,
      });
      continue;
    }

    update.push({
      kind: "update",
      incoming: product,
      existing: prior,
      sourcePriceChanged,
      imageChanged,
    });
  }

  const remove: SyncDiffItem[] = [];
  if (options.fetchComplete) {
    for (const row of existing) {
      const key = sourceIdentityKey(sourceKey, row.manufacturer, row.sourceSku);
      if (!seenKeys.has(key)) {
        remove.push({
          kind: "remove",
          incoming: null,
          existing: row,
          sourcePriceChanged: false,
          imageChanged: false,
        });
      }
    }
  }

  return { create, update, unchanged, remove };
}

/**
 * Resolve image URL for an update: never replace a good existing image with
 * a missing/broken incoming URL.
 */
export function resolvePreservedImageUrl(
  existingImageUrl: string | null | undefined,
  incomingImageUrl: string | null | undefined,
  imageDownloadFailed = false,
): string | null {
  const incoming = incomingImageUrl?.trim() || null;
  const existing = existingImageUrl?.trim() || null;
  if (imageDownloadFailed || !incoming) return existing;
  return incoming;
}

/**
 * Sync must never overwrite SpareLink selling price with CI source price.
 */
export function resolveSparelinkPriceAfterSync(
  existingSparelinkPricePaise: number | null | undefined,
): number | null {
  if (
    existingSparelinkPricePaise == null ||
    !Number.isFinite(existingSparelinkPricePaise)
  ) {
    return null;
  }
  return existingSparelinkPricePaise;
}
