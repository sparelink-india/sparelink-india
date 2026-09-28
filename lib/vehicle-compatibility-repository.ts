import { randomUUID } from "node:crypto";
import { and, eq, ilike, inArray, or } from "drizzle-orm";

import { part, partVehicleCompatibility, vehicle } from "@/drizzle/schema";
import {
  chunk,
  DB_CHUNK_SIZE,
  type CompatibilityFilters,
} from "@/lib/admin-vehicle-compatibility-mutations";
import { getDb } from "@/lib/db";
import { typesense } from "@/lib/typesense";
import { writeAuditLog } from "@/lib/audit";
import type { AuditRecord, MutationDeps } from "@/lib/vehicle-compatibility-service";

/**
 * The `parts` collection requires `part_number` and `name` on every write.
 *
 * A compatibility sync only knows `vehicle_ids`, so the remaining declared fields
 * are read back from the stored document and carried through. Fields the
 * collection does not declare are dropped, because Typesense rejects unknown
 * fields outright.
 */
const TYPESENSE_REQUIRED_FIELDS = [
  "part_number",
  "name",
  "description",
  "brand",
  "category",
  "part_number_search",
] as const;

type TypesenseDocument = { id: string; vehicle_ids: string[] } & Record<string, unknown>;

/** Exported for tests: the shape actually sent to Typesense. */
export function completeTypesenseDocument(
  patch: { id: string; vehicle_ids: string[] },
  stored: Record<string, unknown> | null,
): TypesenseDocument {
  const out: TypesenseDocument = { ...(stored ?? {}), id: patch.id, vehicle_ids: patch.vehicle_ids };
  for (const key of Object.keys(out)) {
    if (key === "id" || key === "vehicle_ids") continue;
    if (!(TYPESENSE_REQUIRED_FIELDS as readonly string[]).includes(key)) delete out[key];
  }
  for (const key of TYPESENSE_REQUIRED_FIELDS) {
    if (out[key] === undefined) out[key] = "";
  }
  return out;
}

async function completeForTypesense(doc: { id: string; vehicle_ids: string[] }): Promise<TypesenseDocument> {
  let stored: Record<string, unknown> | null = null;
  try {
    /* Unreachable with a null client: syncTypesense already refuses in that case,
       so the assertion only narrows the type for the compiler. */
    if (!typesense) return completeTypesenseDocument(doc, null);
    stored = (await typesense.collections("parts").documents(doc.id).retrieve()) as Record<string, unknown>;
  } catch {
    /* No stored copy: the caller only syncs parts that are already indexed, so
       this is defensive. An empty required field is preferable to failing the
       batch, and Typesense reports the outcome either way. */
  }
  return completeTypesenseDocument(doc, stored);
}

/** Surfaces the first per-document reason, which the client otherwise buries. */
function describeTypesenseFailure(error: unknown): string {
  const results = (error as { importResults?: Array<{ error?: string }> })?.importResults;
  if (Array.isArray(results) && results.length > 0) {
    const first = results[0]?.error;
    const head = typeof first === "string" ? first.slice(0, 300) : "unknown error";
    return `${error instanceof Error ? error.message : "Typesense import failed."} First document error: ${head}`;
  }
  return error instanceof Error ? error.message : "Typesense import failed.";
}

/**
 * Real boundaries for the vehicle compatibility mutation service.
 *
 * Every function here is the production implementation of one member of
 * `MutationDeps`. Keeping them in one place is what lets the ordering rules in
 * the service be tested against fakes while production runs exactly this code.
 *
 * THE DELETE IS DELIBERATELY ASYMMETRIC. It filters `vehicle_id` with an
 * equality and `part_id` with an `IN` list. Both as `IN` lists would be a
 * cartesian match and would delete other vehicles' links for the same parts; one
 * equality plus one list is precisely the set the admin selected.
 *
 * THE INSERT IS IDEMPOTENT BY CONSTRAINT, NOT BY CHECK. `onConflictDoNothing`
 * targets the unique index from migration 0026, so two admins linking the same
 * part at the same moment produce one row, not a 500. The pre-read in the service
 * exists only to report accurate counts, never to make correctness depend on it.
 */

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function filterPredicate(filters: CompatibilityFilters) {
  const clauses = [];
  if (filters.q) {
    const needle = `%${escapeLike(filters.q)}%`;
    clauses.push(or(ilike(part.partNumber, needle), ilike(part.name, needle)));
  }
  if (filters.brand) clauses.push(eq(part.brand, filters.brand));
  if (filters.categoryId) clauses.push(eq(part.categoryId, filters.categoryId));  return clauses.length ? and(...clauses) : undefined;
}

export function createCompatibilityMutationDeps(): MutationDeps {
  return {
    async vehicleExists(vehicleId) {
      const rows = await getDb()
        .select({ id: vehicle.id })
        .from(vehicle)
        .where(eq(vehicle.id, vehicleId))
        .limit(1);
      return rows.length > 0;
    },

    async resolveExistingPartIds(partIds) {
      if (partIds.length === 0) return new Set<string>();
      const rows = await getDb()
        .select({ id: part.id })
        .from(part)
        .where(inArray(part.id, partIds));
      return new Set(rows.map((row) => row.id));
    },

    async findLinkedPartIds(vehicleId, partIds) {
      if (partIds.length === 0) return new Set<string>();
      const rows = await getDb()
        .select({ partId: partVehicleCompatibility.partId })
        .from(partVehicleCompatibility)
        .where(
          and(
            eq(partVehicleCompatibility.vehicleId, vehicleId),
            inArray(partVehicleCompatibility.partId, partIds),
          ),
        );
      return new Set(rows.map((row) => row.partId));
    },

    async resolveFilteredPartIds(filters) {
      /* No compatibility join here on purpose. This resolves "every part the
         current filter matches" for a link or an unlink of the whole result
         set, so the set must not depend on existing links. Ordering by part
         number keeps the resolved ids deterministic, and the service caps the
         returned count before anything is written. */
      const rows = await getDb()
        .select({ id: part.id })
        .from(part)
        .where(filterPredicate(filters))
        .orderBy(part.partNumber);
      return rows.map((row) => row.id);
    },

    async insertLinks(vehicleId, partIds) {
      const db = getDb();
      for (const batch of chunk(partIds, DB_CHUNK_SIZE)) {
        await db
          .insert(partVehicleCompatibility)
          .values(
            batch.map((partId) => ({
              id: randomUUID(),
              partId,
              vehicleId,
            })),
          )
          /* The unique index from migration 0026 is the race-safe guard. Two
             concurrent admins cannot both create the same link. */
          .onConflictDoNothing();
      }
    },

    async deleteLinks(vehicleId, partIds) {
      const db = getDb();
      for (const batch of chunk(partIds, DB_CHUNK_SIZE)) {
        await db
          .delete(partVehicleCompatibility)
          .where(
            and(
              eq(partVehicleCompatibility.vehicleId, vehicleId),
              inArray(partVehicleCompatibility.partId, batch),
            ),
          );
      }
    },

    async readAuthoritativeVehicleIds(partIds) {
      const out = new Map<string, string[]>();
      for (const partId of partIds) out.set(partId, []);
      if (partIds.length === 0) return out;

      const rows = await getDb()
        .select({
          partId: partVehicleCompatibility.partId,
          vehicleId: partVehicleCompatibility.vehicleId,
        })
        .from(partVehicleCompatibility)
        .where(inArray(partVehicleCompatibility.partId, partIds));

      for (const row of rows) {
        const list = out.get(row.partId);
        if (list) list.push(row.vehicleId);
      }
      return out;
    },

    async filterIndexedPartIds(partIds) {
      if (partIds.length === 0) return [];
      /* Mirrors scripts/index-parts.ts: only published, approved parts are in
         the `parts` collection, so only those can be republished. */
      const rows = await getDb()
        .select({ id: part.id })
        .from(part)
        .where(
          and(
            inArray(part.id, partIds),
            eq(part.isPublished, true),
            eq(part.approvalStatus, "APPROVED"),
          ),
        );
      return rows.map((row) => row.id);
    },

    async syncTypesense(documents) {
      if (!typesense) {
        return { ok: false, error: "Typesense is not configured." };
      }
      if (documents.length === 0) return { ok: true };

      try {
        /* The `parts` collection declares non-optional `part_number` and `name`,
           and a Typesense `upsert` must carry every declared field: omitting one
           is rejected with HTTP 400 "Field `name` has been declared in the
           schema, but is not found in the document", which fails the whole batch
           and leaves the index stale. Each document is therefore completed from
           the existing stored copy before it is sent, so the write stays limited
           to `vehicle_ids` while still satisfying the schema.

           `emit_doc`/`dirty_values` would sidestep this, but the client pins an
           older Typesense where that option is unavailable, so the merge below
           is the compatible route. Documents are chunked because the import
           endpoint takes a JSON array. */
        for (const batch of chunk(documents, 200)) {
          const completed = await Promise.all(batch.map((doc) => completeForTypesense(doc)));
          await typesense
            .collections("parts")
            .documents()
            .import(completed, { action: "upsert" });
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: describeTypesenseFailure(error),
        };
      }
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
