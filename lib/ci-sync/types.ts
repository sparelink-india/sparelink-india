/**
 * CI / OnlineAutoHandles source catalogue sync — types and safety constants.
 * Source commercial fields stay separate from SpareLink selling price / stock.
 */

export const CI_SOURCE_KEY = "ci" as const;

export const APPROVAL_STATUS = {
  PENDING_ADMIN_APPROVAL: "PENDING_ADMIN_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type ApprovalStatus =
  (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export const SOURCE_STATUS = {
  LIVE: "LIVE",
  SOURCE_UPDATED: "SOURCE_UPDATED",
  SOURCE_REMOVED: "SOURCE_REMOVED",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
} as const;

export type SourceStatus = (typeof SOURCE_STATUS)[keyof typeof SOURCE_STATUS];

export const SYNC_RUN_STATUS = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;

export type SyncRunStatus = (typeof SYNC_RUN_STATUS)[keyof typeof SYNC_RUN_STATUS];

/** Normalized CI source row — never treat sourcePrice as SpareLink selling price. */
export type CiSourceProduct = {
  sourceId: string | null;
  sku: string;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  /** Source list price in paise. Null when source omitted price — never invent. */
  sourcePricePaise: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  oeCode: string | null;
  statusSource: string | null;
  categoryName: string | null;
};

export type ExistingSourceRecord = {
  id: string;
  sourceKey: string;
  sourceSku: string;
  sourceId: string | null;
  name: string | null;
  manufacturer: string | null;
  brand: string | null;
  sourcePricePaise: number | null;
  sourceImageUrl: string | null;
  sourceUrl: string | null;
  oeCode: string | null;
  sourceHash: string | null;
  sourceStatus: SourceStatus | string;
  approvalStatus: ApprovalStatus | string;
  partId: string | null;
  /** SpareLink commercial selling price when a listing exists — never overwritten by sync. */
  sparelinkPricePaise: number | null;
  lastSeenAt: string | null;
};

export type SyncDiffItem = {
  kind: "create" | "update" | "unchanged" | "remove";
  incoming: CiSourceProduct | null;
  existing: ExistingSourceRecord | null;
  sourcePriceChanged: boolean;
  imageChanged: boolean;
};

export type SyncDiff = {
  create: SyncDiffItem[];
  update: SyncDiffItem[];
  unchanged: SyncDiffItem[];
  remove: SyncDiffItem[];
};

export type SyncRunCounts = {
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  sourceRemovedCount: number;
  approvalPendingCount: number;
  failedCount: number;
};

export type SyncRunResult = SyncRunCounts & {
  status: SyncRunStatus;
  errorSummary: string | null;
  fetchComplete: boolean;
  dryRun: boolean;
  diffs: SyncDiff;
};

/** Customer visibility: approved + published only. Source price never exposed. */
export function isCustomerVisibleProduct(input: {
  isPublished: boolean;
  approvalStatus: string | null | undefined;
}): boolean {
  const approval = (input.approvalStatus || APPROVAL_STATUS.APPROVED).toUpperCase();
  return input.isPublished === true && approval === APPROVAL_STATUS.APPROVED;
}

/** Strip source-only fields from any object destined for customer APIs. */
export function omitSourceCommercialFields<T extends Record<string, unknown>>(
  row: T,
): Omit<T, "sourcePrice" | "sourcePricePaise" | "sourcePreviousPrice"> {
  const clone = { ...row } as Record<string, unknown>;
  delete clone.sourcePrice;
  delete clone.sourcePricePaise;
  delete clone.sourcePreviousPrice;
  return clone as Omit<T, "sourcePrice" | "sourcePricePaise" | "sourcePreviousPrice">;
}
