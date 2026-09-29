/**
 * Real boundaries for the hero collection service.
 *
 * Every function is the production implementation of one member of
 * `HeroCollectionDeps`, which lets the ordering rules in the service be tested
 * against fakes while production runs exactly this code.
 *
 * NOTHING HERE TOUCHES VEHICLE COMPATIBILITY. The only two tables these queries
 * can reach are `hero_vehicle_collection` and `hero_vehicle_collection_item`.
 * There is deliberately no code path from this module to
 * `part_vehicle_compatibility`: a curated hero set is a merchandising decision,
 * and letting it write fitment rows would turn a marketing click into a
 * compatibility claim.
 *
 * ADD IS IDEMPOTENT BY CONSTRAINT, NOT BY CHECK. `onConflictDoNothing` targets
 * the composite primary key, so two admins adding the same product to the same
 * slot at the same moment produce one row rather than a 500. The pre-read in
 * the service exists only to report accurate counts.
 *
 * REMOVE IS SCOPED BY BOTH SLOT AND PART IDS. Filtering on either alone would be
 * wrong: slot alone deletes the whole collection, part ids alone would strip a
 * product from every collection that mentions it.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";

import { part, heroVehicleCollection, heroVehicleCollectionItem } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  HERO_SLOT_META,
  heroSlotLabel,
  isHeroCollectionSlot,
  type HeroCollectionSlot,
  type HeroFilters,
} from "@/lib/hero-collections";
import type { AuditRecord, HeroCollectionDeps } from "@/lib/hero-collection-service";

const DB_BATCH_SIZE = 250;

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const step = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

export function createHeroCollectionDeps(): HeroCollectionDeps {
  return {
    async resolveExistingPartIds(partIds) {
      if (partIds.length === 0) return new Set();
      const rows = await getDb()
        .select({ id: part.id })
        .from(part)
        .where(inArray(part.id, partIds));
      return new Set(rows.map((r) => r.id));
    },

    async findCollectedPartIds(slot, partIds) {
      if (partIds.length === 0) return new Set();
      const rows = await getDb()
        .select({ partId: heroVehicleCollectionItem.partId })
        .from(heroVehicleCollectionItem)
        .where(
          and(
            eq(heroVehicleCollectionItem.slot, slot),
            inArray(heroVehicleCollectionItem.partId, partIds),
          ),
        );
      return new Set(rows.map((r) => r.partId));
    },

    async resolveFilteredPartIds(filters: HeroFilters) {
      const clauses = [];
      if (filters.q) {
        clauses.push(
          or(ilike(part.partNumber, `%${filters.q}%`), ilike(part.name, `%${filters.q}%`)),
        );
      }
      if (filters.brand) clauses.push(ilike(part.brand, `%${filters.brand}%`));
      if (filters.categoryId) clauses.push(eq(part.categoryId, filters.categoryId));
      const rows = await getDb()
        .select({ id: part.id })
        .from(part)
        .where(clauses.length ? or(...clauses) : undefined)
        .limit(2000);
      return rows.map((r) => r.id);
    },

    async ensureSlot(slot, label) {
      /* onConflictDoNothing: the row is created once and an admin rename does not
         rewrite history. Without this a first-time add would fail on the foreign
         key from the item table. */
      await getDb()
        .insert(heroVehicleCollection)
        .values({ slot, label })
        .onConflictDoNothing();
    },

    async insertItems(slot, partIds) {
      if (partIds.length === 0) return;
      /* Ordering is assigned server-side, appended after whatever is already in
         the slot, so an admin's hand-built sequence is never reshuffled by a
         later add. Display order is computed in chunks to stay inside the
         parameter limit. */
      for (const batch of chunk(partIds, DB_BATCH_SIZE)) {
        const existing = await getDb()
          .select({ max: heroVehicleCollectionItem.displayOrder })
          .from(heroVehicleCollectionItem)
          .where(eq(heroVehicleCollectionItem.slot, slot));
        const start = (existing[0]?.max ?? -1) + 1;
        await getDb()
          .insert(heroVehicleCollectionItem)
          .values(
            batch.map((partId, i) => ({
              slot,
              partId,
              displayOrder: start + i,
            })),
          )
          .onConflictDoNothing();
      }
    },

    async deleteItems(slot, partIds) {
      if (partIds.length === 0) return;
      for (const batch of chunk(partIds, DB_BATCH_SIZE)) {
        await getDb()
          .delete(heroVehicleCollectionItem)
          .where(
            and(
              eq(heroVehicleCollectionItem.slot, slot),
              inArray(heroVehicleCollectionItem.partId, batch),
            ),
          );
      }
    },

    async listSlotCounts() {
      const rows = await getDb()
        .select({
          slot: heroVehicleCollection.slot,
          isEnabled: heroVehicleCollection.isEnabled,
          count: heroVehicleCollectionItem.partId,
        })
        .from(heroVehicleCollection)
        .leftJoin(
          heroVehicleCollectionItem,
          eq(heroVehicleCollectionItem.slot, heroVehicleCollection.slot),
        );
      const map = new Map<HeroCollectionSlot, { isEnabled: boolean; count: number }>();
      for (const r of rows) {
        if (!isHeroCollectionSlot(r.slot)) continue;
        const cur = map.get(r.slot) ?? { isEnabled: r.isEnabled, count: 0 };
        cur.count += 1;
        map.set(r.slot, cur);
      }
      return map;
    },

    async listItemPartIds(slot) {
      const rows = await getDb()
        .select({ partId: heroVehicleCollectionItem.partId })
        .from(heroVehicleCollectionItem)
        .where(eq(heroVehicleCollectionItem.slot, slot))
        .orderBy(asc(heroVehicleCollectionItem.displayOrder), asc(heroVehicleCollectionItem.createdAt));
      return rows.map((r) => r.partId);
    },

    async setSlotEnabled(slot, isEnabled) {
      await getDb()
        .update(heroVehicleCollection)
        .set({ isEnabled })
        .where(eq(heroVehicleCollection.slot, slot));
    },

    async audit(record: AuditRecord) {
      await writeAuditLog({
        actorUserId: record.actorUserId,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        metadata: record.metadata,
      });
    },
  };
}

export { HERO_SLOT_META, heroSlotLabel, randomUUID };
