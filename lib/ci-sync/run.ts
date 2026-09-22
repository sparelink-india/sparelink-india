import { computeSyncDiff, resolvePreservedImageUrl, resolveSparelinkPriceAfterSync } from "./diff";
import { hashSourceProduct, mapCiApiProduct } from "./normalize";
import {
  APPROVAL_STATUS,
  CI_SOURCE_KEY,
  SOURCE_STATUS,
  SYNC_RUN_STATUS,
  type CiSourceProduct,
  type ExistingSourceRecord,
  type SyncRunResult,
} from "./types";

export type CiFetchResult = {
  products: CiSourceProduct[];
  /** True only when the adapter confirms the full catalogue was retrieved. */
  fetchComplete: boolean;
  errorSummary: string | null;
};

export type CiCatalogueFetcher = () => Promise<CiFetchResult>;

export type AppliedSyncMutation = {
  type: "create" | "update_source" | "mark_removed";
  sourceSku: string;
  partId: string | null;
  approvalStatus: string;
  sourceStatus: string;
  sourcePricePaise: number | null;
  sparelinkPricePaise: number | null;
  imageUrl: string | null;
};

export type SyncApplyStore = {
  listExisting(sourceKey: string): Promise<ExistingSourceRecord[]>;
  applyCreate(product: CiSourceProduct, hash: string): Promise<AppliedSyncMutation>;
  applySourceUpdate(
    existing: ExistingSourceRecord,
    product: CiSourceProduct,
    hash: string,
    imageUrl: string | null,
  ): Promise<AppliedSyncMutation>;
  applySourceRemoved(existing: ExistingSourceRecord): Promise<AppliedSyncMutation>;
};

export type RunCiSyncOptions = {
  sourceKey?: string;
  dryRun?: boolean;
  fetcher: CiCatalogueFetcher;
  store?: SyncApplyStore;
};

/**
 * Run a CI catalogue sync. Failed/partial fetches never mark products removed.
 * New products are PENDING_ADMIN_APPROVAL with no SpareLink selling price.
 */
export async function runCiSync(options: RunCiSyncOptions): Promise<SyncRunResult> {
  const sourceKey = options.sourceKey ?? CI_SOURCE_KEY;
  const dryRun = options.dryRun === true;

  let fetch: CiFetchResult;
  try {
    fetch = await options.fetcher();
  } catch (error) {
    return {
      status: SYNC_RUN_STATUS.FAILED,
      fetchedCount: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      sourceRemovedCount: 0,
      approvalPendingCount: 0,
      failedCount: 1,
      errorSummary: error instanceof Error ? error.message : "Fetch failed",
      fetchComplete: false,
      dryRun,
      diffs: { create: [], update: [], unchanged: [], remove: [] },
    };
  }

  if (!fetch.fetchComplete) {
    return {
      status: fetch.errorSummary ? SYNC_RUN_STATUS.FAILED : SYNC_RUN_STATUS.PARTIAL,
      fetchedCount: fetch.products.length,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      sourceRemovedCount: 0,
      approvalPendingCount: 0,
      failedCount: fetch.errorSummary ? 1 : 0,
      errorSummary:
        fetch.errorSummary ||
        "Incomplete fetch — refusing removals and writes until a full catalogue is available",
      fetchComplete: false,
      dryRun,
      diffs: { create: [], update: [], unchanged: [], remove: [] },
    };
  }

  const existing = options.store
    ? await options.store.listExisting(sourceKey)
    : [];
  const diffs = computeSyncDiff(fetch.products, existing, {
    sourceKey,
    fetchComplete: true,
  });

  let failedCount = 0;
  const errorParts: string[] = [];
  let approvalPendingCount = 0;

  if (!dryRun && options.store) {
    for (const item of diffs.create) {
      if (!item.incoming) continue;
      try {
        const applied = await options.store.applyCreate(
          item.incoming,
          hashSourceProduct(item.incoming),
        );
        if (applied.approvalStatus === APPROVAL_STATUS.PENDING_ADMIN_APPROVAL) {
          approvalPendingCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        errorParts.push(
          `create ${item.incoming.sku}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }

    for (const item of diffs.update) {
      if (!item.incoming || !item.existing) continue;
      try {
        const imageUrl = resolvePreservedImageUrl(
          item.existing.sourceImageUrl,
          item.incoming.imageUrl,
          false,
        );
        // Explicitly preserve SpareLink price (documented invariant).
        resolveSparelinkPriceAfterSync(item.existing.sparelinkPricePaise);
        await options.store.applySourceUpdate(
          item.existing,
          item.incoming,
          hashSourceProduct(item.incoming),
          imageUrl,
        );
      } catch (error) {
        failedCount += 1;
        errorParts.push(
          `update ${item.incoming.sku}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }

    for (const item of diffs.remove) {
      if (!item.existing) continue;
      try {
        await options.store.applySourceRemoved(item.existing);
      } catch (error) {
        failedCount += 1;
        errorParts.push(
          `remove ${item.existing.sourceSku}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }
  } else {
    approvalPendingCount = diffs.create.length;
  }

  const status =
    failedCount > 0
      ? diffs.create.length + diffs.update.length + diffs.remove.length > failedCount
        ? SYNC_RUN_STATUS.PARTIAL
        : SYNC_RUN_STATUS.FAILED
      : SYNC_RUN_STATUS.SUCCESS;

  return {
    status,
    fetchedCount: fetch.products.length,
    newCount: diffs.create.length,
    updatedCount: diffs.update.length,
    unchangedCount: diffs.unchanged.length,
    sourceRemovedCount: diffs.remove.length,
    approvalPendingCount,
    failedCount,
    errorSummary: errorParts.length ? errorParts.slice(0, 20).join("; ") : fetch.errorSummary,
    fetchComplete: true,
    dryRun,
    diffs,
  };
}

/** Build a fetcher from in-memory fixture products (tests / dry-run). */
export function fixtureFetcher(
  products: CiSourceProduct[],
  options?: { fetchComplete?: boolean; errorSummary?: string | null },
): CiCatalogueFetcher {
  return async () => ({
    products,
    fetchComplete: options?.fetchComplete !== false,
    errorSummary: options?.errorSummary ?? null,
  });
}

/** Build a fetcher from raw API-shaped JSON fixtures. */
export function fixtureFetcherFromRaw(
  rawItems: Record<string, unknown>[],
  options?: { fetchComplete?: boolean; errorSummary?: string | null },
): CiCatalogueFetcher {
  const products = rawItems
    .map((item) => mapCiApiProduct(item))
    .filter((item): item is CiSourceProduct => Boolean(item));
  return fixtureFetcher(products, options);
}

/** In-memory sync store for deterministic unit tests. */
export function createMemorySyncStore(
  seed: ExistingSourceRecord[] = [],
): SyncApplyStore & { records: ExistingSourceRecord[]; mutations: AppliedSyncMutation[] } {
  const records = [...seed];
  const mutations: AppliedSyncMutation[] = [];

  return {
    records,
    mutations,
    async listExisting(sourceKey: string) {
      return records.filter((row) => row.sourceKey === sourceKey);
    },
    async applyCreate(product, hash) {
      const mutation: AppliedSyncMutation = {
        type: "create",
        sourceSku: product.sku,
        partId: null,
        approvalStatus: APPROVAL_STATUS.PENDING_ADMIN_APPROVAL,
        sourceStatus: SOURCE_STATUS.LIVE,
        sourcePricePaise: product.sourcePricePaise,
        sparelinkPricePaise: null,
        imageUrl: product.imageUrl,
      };
      mutations.push(mutation);
      records.push({
        id: `src-${product.sku}`,
        sourceKey: CI_SOURCE_KEY,
        sourceSku: product.sku,
        sourceId: product.sourceId,
        name: product.name,
        manufacturer: product.manufacturer,
        brand: product.brand,
        sourcePricePaise: product.sourcePricePaise,
        sourceImageUrl: product.imageUrl,
        sourceUrl: product.sourceUrl,
        oeCode: product.oeCode,
        sourceHash: hash,
        sourceStatus: SOURCE_STATUS.LIVE,
        approvalStatus: APPROVAL_STATUS.PENDING_ADMIN_APPROVAL,
        partId: null,
        sparelinkPricePaise: null,
        lastSeenAt: new Date().toISOString(),
      });
      return mutation;
    },
    async applySourceUpdate(existing, product, hash, imageUrl) {
        const sparelinkPricePaise = resolveSparelinkPriceAfterSync(
          existing.sparelinkPricePaise,
        );
      const mutation: AppliedSyncMutation = {
        type: "update_source",
        sourceSku: product.sku,
        partId: existing.partId,
        approvalStatus: existing.approvalStatus,
        sourceStatus: SOURCE_STATUS.SOURCE_UPDATED,
        sourcePricePaise: product.sourcePricePaise,
        sparelinkPricePaise,
        imageUrl,
      };
      mutations.push(mutation);
      const idx = records.findIndex((row) => row.id === existing.id);
      if (idx >= 0) {
        records[idx] = {
          ...records[idx],
          name: product.name,
          brand: product.brand,
          manufacturer: product.manufacturer,
          sourcePricePaise: product.sourcePricePaise,
          sourceImageUrl: imageUrl,
          sourceUrl: product.sourceUrl,
          oeCode: product.oeCode,
          sourceHash: hash,
          sourceStatus: SOURCE_STATUS.SOURCE_UPDATED,
          lastSeenAt: new Date().toISOString(),
          sparelinkPricePaise,
        };
      }
      return mutation;
    },
    async applySourceRemoved(existing) {
      const mutation: AppliedSyncMutation = {
        type: "mark_removed",
        sourceSku: existing.sourceSku,
        partId: existing.partId,
        approvalStatus: existing.approvalStatus,
        sourceStatus: SOURCE_STATUS.SOURCE_REMOVED,
        sourcePricePaise: existing.sourcePricePaise,
        sparelinkPricePaise: existing.sparelinkPricePaise,
        imageUrl: existing.sourceImageUrl,
      };
      mutations.push(mutation);
      const idx = records.findIndex((row) => row.id === existing.id);
      if (idx >= 0) {
        records[idx] = {
          ...records[idx],
          sourceStatus: SOURCE_STATUS.SOURCE_REMOVED,
        };
      }
      return mutation;
    },
  };
}
