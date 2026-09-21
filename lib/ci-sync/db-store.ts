import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import { catalogueSourceItem, catalogueSyncRun, dealerListing, part } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { normalizeManufacturer } from "@/lib/ci-sync/normalize";
import type { AppliedSyncMutation, SyncApplyStore } from "@/lib/ci-sync/run";
import {
  APPROVAL_STATUS,
  CI_SOURCE_KEY,
  SOURCE_STATUS,
  type CiSourceProduct,
  type ExistingSourceRecord,
} from "@/lib/ci-sync/types";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Drizzle-backed sync store. Never deletes parts. Never writes source price
 * into dealer_listing.price_paise.
 */
export function createDbSyncStore(): SyncApplyStore {
  const db = getDb();

  return {
    async listExisting(sourceKey: string): Promise<ExistingSourceRecord[]> {
      const rows = await db
        .select({
          id: catalogueSourceItem.id,
          sourceKey: catalogueSourceItem.sourceKey,
          sourceSku: catalogueSourceItem.sourceSku,
          sourceId: catalogueSourceItem.sourceId,
          name: catalogueSourceItem.name,
          manufacturer: catalogueSourceItem.manufacturer,
          brand: catalogueSourceItem.brand,
          sourcePricePaise: catalogueSourceItem.sourcePricePaise,
          sourceImageUrl: catalogueSourceItem.sourceImageUrl,
          sourceUrl: catalogueSourceItem.sourceUrl,
          oeCode: catalogueSourceItem.oeCode,
          sourceHash: catalogueSourceItem.sourceHash,
          sourceStatus: catalogueSourceItem.sourceStatus,
          approvalStatus: catalogueSourceItem.approvalStatus,
          partId: catalogueSourceItem.partId,
          lastSeenAt: catalogueSourceItem.lastSeenAt,
        })
        .from(catalogueSourceItem)
        .where(eq(catalogueSourceItem.sourceKey, sourceKey));

      const partIds = rows.map((r) => r.partId).filter((id): id is string => Boolean(id));
      const priceByPart = new Map<string, number>();
      if (partIds.length) {
        const listings = await db
          .select({
            partId: dealerListing.partId,
            pricePaise: dealerListing.pricePaise,
            status: dealerListing.status,
          })
          .from(dealerListing)
          .where(inArray(dealerListing.partId, partIds));
        for (const listing of listings) {
          if (!priceByPart.has(listing.partId)) {
            priceByPart.set(listing.partId, listing.pricePaise);
          }
        }
      }

      return rows.map((row) => ({
        id: row.id,
        sourceKey: row.sourceKey,
        sourceSku: row.sourceSku,
        sourceId: row.sourceId,
        name: row.name,
        manufacturer: row.manufacturer,
        brand: row.brand,
        sourcePricePaise: row.sourcePricePaise,
        sourceImageUrl: row.sourceImageUrl,
        sourceUrl: row.sourceUrl,
        oeCode: row.oeCode,
        sourceHash: row.sourceHash,
        sourceStatus: row.sourceStatus,
        approvalStatus: row.approvalStatus,
        partId: row.partId,
        sparelinkPricePaise: row.partId ? priceByPart.get(row.partId) ?? null : null,
        lastSeenAt: toIso(row.lastSeenAt),
      }));
    },

    async applyCreate(product: CiSourceProduct, hash: string): Promise<AppliedSyncMutation> {
      const manufacturer = normalizeManufacturer(product.manufacturer);
      const now = new Date();

      // Prefer linking an existing part with the same exact part number (no name merge).
      const existingParts = await db
        .select({ id: part.id, approvalStatus: part.approvalStatus, isPublished: part.isPublished })
        .from(part)
        .where(eq(part.partNumber, product.sku))
        .limit(1);

      let partId = existingParts[0]?.id ?? null;
      let approvalStatus = APPROVAL_STATUS.PENDING_ADMIN_APPROVAL;

      if (!partId) {
        partId = randomUUID();
        await db.insert(part).values({
          id: partId,
          partNumber: product.sku,
          name: product.name,
          description: null,
          brand: product.brand,
          oemNumber: product.oeCode,
          isPublished: false,
          approvalStatus: APPROVAL_STATUS.PENDING_ADMIN_APPROVAL,
        });
      } else {
        // Existing SpareLink part — do not auto-publish or invent price; keep commercial state.
        approvalStatus =
          (existingParts[0]?.approvalStatus as typeof approvalStatus) ||
          APPROVAL_STATUS.APPROVED;
      }

      const id = randomUUID();
      await db.insert(catalogueSourceItem).values({
        id,
        sourceKey: CI_SOURCE_KEY,
        sourceSku: product.sku,
        sourceId: product.sourceId,
        name: product.name,
        manufacturer,
        brand: product.brand,
        categoryName: product.categoryName,
        oeCode: product.oeCode,
        sourcePricePaise: product.sourcePricePaise,
        sourceImageUrl: product.imageUrl,
        sourceUrl: product.sourceUrl,
        sourceHash: hash,
        sourceStatus: SOURCE_STATUS.LIVE,
        approvalStatus:
          partId && existingParts[0]
            ? APPROVAL_STATUS.APPROVED
            : APPROVAL_STATUS.PENDING_ADMIN_APPROVAL,
        partId,
        lastSeenAt: now,
      });

      return {
        type: "create",
        sourceSku: product.sku,
        partId,
        approvalStatus:
          partId && existingParts[0]
            ? approvalStatus
            : APPROVAL_STATUS.PENDING_ADMIN_APPROVAL,
        sourceStatus: SOURCE_STATUS.LIVE,
        sourcePricePaise: product.sourcePricePaise,
        sparelinkPricePaise: null,
        imageUrl: product.imageUrl,
      };
    },

    async applySourceUpdate(
      existing,
      product,
      hash,
      imageUrl,
    ): Promise<AppliedSyncMutation> {
      const now = new Date();
      const priceChanged = existing.sourcePricePaise !== product.sourcePricePaise;

      await db
        .update(catalogueSourceItem)
        .set({
          name: product.name,
          brand: product.brand,
          manufacturer: normalizeManufacturer(product.manufacturer),
          categoryName: product.categoryName,
          oeCode: product.oeCode,
          sourcePricePaise: product.sourcePricePaise,
          sourceImageUrl: imageUrl,
          sourceUrl: product.sourceUrl,
          sourceHash: hash,
          sourceStatus: SOURCE_STATUS.SOURCE_UPDATED,
          lastSeenAt: now,
          sourcePriceChangedAt: priceChanged ? now : undefined,
          updatedAt: now,
        })
        .where(eq(catalogueSourceItem.id, existing.id));

      // Optionally refresh non-commercial part name/brand; never touch listing price.
      if (existing.partId) {
        await db
          .update(part)
          .set({
            name: product.name,
            brand: product.brand,
            oemNumber: product.oeCode ?? undefined,
            updatedAt: now,
          })
          .where(eq(part.id, existing.partId));
      }

      return {
        type: "update_source",
        sourceSku: product.sku,
        partId: existing.partId,
        approvalStatus: existing.approvalStatus,
        sourceStatus: SOURCE_STATUS.SOURCE_UPDATED,
        sourcePricePaise: product.sourcePricePaise,
        sparelinkPricePaise: existing.sparelinkPricePaise,
        imageUrl,
      };
    },

    async applySourceRemoved(existing): Promise<AppliedSyncMutation> {
      await db
        .update(catalogueSourceItem)
        .set({
          sourceStatus: SOURCE_STATUS.SOURCE_REMOVED,
          updatedAt: new Date(),
        })
        .where(eq(catalogueSourceItem.id, existing.id));

      // Never delete part / listings / images.
      return {
        type: "mark_removed",
        sourceSku: existing.sourceSku,
        partId: existing.partId,
        approvalStatus: existing.approvalStatus,
        sourceStatus: SOURCE_STATUS.SOURCE_REMOVED,
        sourcePricePaise: existing.sourcePricePaise,
        sparelinkPricePaise: existing.sparelinkPricePaise,
        imageUrl: existing.sourceImageUrl,
      };
    },
  };
}

export async function recordSyncRun(input: {
  id: string;
  sourceKey: string;
  status: string;
  dryRun: boolean;
  fetchComplete: boolean;
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  sourceRemovedCount: number;
  approvalPendingCount: number;
  failedCount: number;
  errorSummary: string | null;
  startedAt: Date;
  finishedAt: Date;
  triggeredBy: string | null;
}) {
  const db = getDb();
  await db.insert(catalogueSyncRun).values({
    id: input.id,
    sourceKey: input.sourceKey,
    status: input.status,
    dryRun: input.dryRun,
    fetchComplete: input.fetchComplete,
    fetchedCount: input.fetchedCount,
    newCount: input.newCount,
    updatedCount: input.updatedCount,
    unchangedCount: input.unchangedCount,
    sourceRemovedCount: input.sourceRemovedCount,
    approvalPendingCount: input.approvalPendingCount,
    failedCount: input.failedCount,
    errorSummary: input.errorSummary,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    triggeredBy: input.triggeredBy,
  });
}

export async function countSourceQueues() {
  const db = getDb();
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogueSourceItem)
    .where(eq(catalogueSourceItem.approvalStatus, APPROVAL_STATUS.PENDING_ADMIN_APPROVAL));
  const [updated] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogueSourceItem)
    .where(eq(catalogueSourceItem.sourceStatus, SOURCE_STATUS.SOURCE_UPDATED));
  const [removed] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogueSourceItem)
    .where(eq(catalogueSourceItem.sourceStatus, SOURCE_STATUS.SOURCE_REMOVED));
  return {
    pendingApproval: pending?.count ?? 0,
    sourceUpdated: updated?.count ?? 0,
    sourceRemoved: removed?.count ?? 0,
  };
}

export async function approveSourceItem(input: {
  sourceItemId: string;
  sellingPricePaise: number;
  mrpPaise?: number | null;
  firmId: string;
  dealerId: string;
}) {
  if (!Number.isFinite(input.sellingPricePaise) || input.sellingPricePaise <= 0) {
    throw new Error("SpareLink selling price is required");
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(catalogueSourceItem)
    .where(eq(catalogueSourceItem.id, input.sourceItemId))
    .limit(1);

  if (!row) throw new Error("Source item not found");
  if (!row.partId) throw new Error("Source item has no linked part");

  const now = new Date();
  await db
    .update(part)
    .set({
      isPublished: true,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      updatedAt: now,
    })
    .where(eq(part.id, row.partId));

  await db
    .update(catalogueSourceItem)
    .set({
      approvalStatus: APPROVAL_STATUS.APPROVED,
      sourceStatus:
        row.sourceStatus === SOURCE_STATUS.SOURCE_REMOVED
          ? SOURCE_STATUS.SOURCE_REMOVED
          : SOURCE_STATUS.LIVE,
      updatedAt: now,
    })
    .where(eq(catalogueSourceItem.id, row.id));

  const existingListings = await db
    .select({ id: dealerListing.id })
    .from(dealerListing)
    .where(and(eq(dealerListing.partId, row.partId), eq(dealerListing.firmId, input.firmId)))
    .limit(1);

  if (existingListings[0]) {
    await db
      .update(dealerListing)
      .set({
        pricePaise: input.sellingPricePaise,
        mrpPaise: input.mrpPaise ?? null,
        status: "active",
        sku: row.sourceSku,
        updatedAt: now,
      })
      .where(eq(dealerListing.id, existingListings[0].id));
  } else {
    await db.insert(dealerListing).values({
      id: randomUUID(),
      dealerId: input.dealerId,
      firmId: input.firmId,
      partId: row.partId,
      sku: row.sourceSku,
      pricePaise: input.sellingPricePaise,
      mrpPaise: input.mrpPaise ?? null,
      status: "active",
    });
  }

  return {
    partId: row.partId,
    sourcePricePaise: row.sourcePricePaise,
    sellingPricePaise: input.sellingPricePaise,
  };
}
