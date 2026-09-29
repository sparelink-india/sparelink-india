/**
 * Hero collection mutation service.
 *
 * THE ORDERING RULES ARE THE POINT, and they are the same ones the vehicle
 * compatibility service follows, deliberately:
 *
 *   1. validate the request and resolve the real part ids
 *   2. read what is already in the slot, so the counts reported are true
 *   3. apply the change in the database
 *   4. only then, audit it
 *
 * The database is the authority. A hero click that renders a curated set reads
 * these tables, so an audited change that is not committed is a lie and a
 * committed change that is not audited is invisible. Both are avoided by doing
 * the write first and the record second.
 *
 * NO COMPATIBILITY IS DECIDED HERE. This module never reads
 * `part_vehicle_compatibility`, `vehicle`, `vehicle_types` or the source
 * catalogue. It adds and removes rows in the hero collection tables and nothing
 * else. Curating an earthmover shortlist says what a marketing click shows; it
 * does not say what a part fits.
 */
import { readHeroFilters, validateHeroMutationRequest, type HeroCollectionSlot, type HeroFilters, type NormalisedHeroMutation } from "@/lib/hero-collections";

export type { NormalisedHeroMutation };

export type AuditRecord = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
};

export type HeroCollectionDeps = {
  /** True only when the id is a row in the `part` table. */
  resolveExistingPartIds(partIds: string[]): Promise<Set<string>>;
  /** Of those, the ones already in this slot. */
  findCollectedPartIds(slot: HeroCollectionSlot, partIds: string[]): Promise<Set<string>>;
  /** Server-side resolution of a filtered scope; ids only. */
  resolveFilteredPartIds(filters: HeroFilters): Promise<string[]>;
  /** Create the slot row if absent; never rewrites an existing one. */
  ensureSlot(slot: HeroCollectionSlot, label: string): Promise<void>;
  /** Insert items, idempotent on the composite primary key. */
  insertItems(slot: HeroCollectionSlot, partIds: string[]): Promise<void>;
  /** Delete items scoped to this slot AND these parts. */
  deleteItems(slot: HeroCollectionSlot, partIds: string[]): Promise<void>;
  listSlotCounts(): Promise<Map<HeroCollectionSlot, { isEnabled: boolean; count: number }>>;
  listItemPartIds(slot: HeroCollectionSlot): Promise<string[]>;
  setSlotEnabled(slot: HeroCollectionSlot, isEnabled: boolean): Promise<void>;
  audit(record: AuditRecord): Promise<void>;
};

export type HeroMutationFailure = { ok: false; status: 400 | 404 | 409; error: string };
export type HeroMutationOutcome = { ok: true; result: HeroMutationResult } | HeroMutationFailure;

export type HeroMutationResult = {
  action: "add" | "remove";
  slot: HeroCollectionSlot;
  requested: number;
  changed: number;
  alreadyInState: number;
  unknown: string[];
};

export function emptyHeroResult(
  action: "add" | "remove",
  slot: HeroCollectionSlot,
): HeroMutationResult {
  return { action, slot, requested: 0, changed: 0, alreadyInState: 0, unknown: [] };
}

function partition<T>(requested: readonly T[], existing: ReadonlySet<T>): { valid: T[]; unknown: T[] } {
  const valid: T[] = [];
  const unknown: T[] = [];
  for (const id of requested) {
    if (existing.has(id)) valid.push(id);
    else unknown.push(id);
  }
  return { valid, unknown };
}

export async function performHeroCollectionMutation(
  action: "add" | "remove",
  body: Parameters<typeof validateHeroMutationRequest>[0],
  actorUserId: string,
  deps: HeroCollectionDeps,
  label: string,
): Promise<HeroMutationOutcome> {
  const parsed = validateHeroMutationRequest(body, action);
  if (!parsed.ok) return { ok: false, status: parsed.status, error: parsed.error };
  const mutation: NormalisedHeroMutation = parsed.value;

  // 1. resolve the ids this request will actually touch
  let partIds: string[];
  if (mutation.scope === "filtered") {
    partIds = await deps.resolveFilteredPartIds(readHeroFilters(body.filters));
  } else {
    partIds = mutation.partIds;
  }
  if (partIds.length === 0) {
    return { ok: false, status: 400, error: "No products matched this selection." };
  }

  /* The filter can return a different set between the admin reading the count
     and the mutation landing. That is the 409, and it is a re-confirm rather
     than a silent surprise. */
  if (mutation.scope === "filtered" && mutation.expectedCount !== null) {
    if (partIds.length !== mutation.expectedCount) {
      return {
        ok: false,
        status: 409,
        error: `This filter now matches ${partIds.length} products, not ${mutation.expectedCount}. Review and confirm again.`,
      };
    }
  }

  // 2. every id must be a real part
  const realPartIds = await deps.resolveExistingPartIds(partIds);
  const { valid, unknown } = partition(partIds, realPartIds);
  if (unknown.length > 0) {
    return {
      ok: false,
      status: 404,
      error: `${unknown.length} product${unknown.length === 1 ? " does" : "s do"} not exist.`,
    };
  }

  // 3. read the current state so the reported counts are true
  const already = await deps.findCollectedPartIds(mutation.slot, valid);
  const toChange = action === "add" ? valid.filter((id) => !already.has(id)) : valid.filter((id) => already.has(id));
  const alreadyInState = valid.length - toChange.length;

  // 4. write, then audit
  if (toChange.length > 0) {
    if (action === "add") {
      await deps.ensureSlot(mutation.slot, label);
      await deps.insertItems(mutation.slot, toChange);
    } else {
      await deps.deleteItems(mutation.slot, toChange);
    }
    await deps.audit({
      actorUserId,
      action: `hero_collection.${action}`,
      entityType: "hero_collection",
      entityId: mutation.slot,
      metadata: {
        slot: mutation.slot,
        action,
        scope: mutation.scope,
        requested: valid.length,
        changed: toChange.length,
        already_in_state: alreadyInState,
        /* The part ids are recorded so an accidental curation is reversible by
           reading the audit trail. This is merchandising data, not customer or
           payment data, so it belongs in the record. */
        part_ids: toChange.slice(0, 500),
        truncated: toChange.length > 500,
      },
    });
  }

  return {
    ok: true,
    result: {
      action,
      slot: mutation.slot,
      requested: valid.length,
      changed: toChange.length,
      alreadyInState,
      unknown: [],
    },
  };
}

export function describeHeroResult(result: HeroMutationResult): string {
  const verb = result.action === "add" ? "Added" : "Removed";
  if (result.changed === 0) {
    return `${verb} 0${result.alreadyInState > 0 ? `, already ${result.action === "add" ? "in" : "out of"} the collection ${result.alreadyInState}` : ""}`;
  }
  return `${verb} ${result.changed}${result.alreadyInState > 0 ? `, ${result.alreadyInState} already ${result.action === "add" ? "in" : "out of"} the collection` : ""}`;
}
