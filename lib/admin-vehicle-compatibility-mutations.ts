/**
 * Vehicle compatibility mutations - pure logic.
 *
 * Validation, planning, chunking, Typesense payload construction and result
 * shaping. No database, no Typesense, no network. Every function here is a
 * total function over plain data, which is what makes the mutation rules
 * testable without touching production.
 *
 * THE TWO INVARIANTS THIS MODULE EXISTS TO ENFORCE
 *
 * 1. A batch is bounded before it ever reaches SQL. An unbounded `IN (...)` is
 *    how an admin screen takes down a database, so the limits are explicit
 *    constants rather than an incidental consequence of a loop.
 *
 * 2. Idempotence is a plan, not an afterthought. Link and unlink both ask "what
 *    is the difference between what the admin asked for and what the table
 *    already holds?", and the answer is computed before any write. That is why a
 *    double-click or a retried request cannot create a duplicate row or report a
 *    phantom failure.
 *
 * `part_vehicle_compatibility` is the only authority. Nothing in this module
 * reads `vehicle_types`, `specifications`, the source catalogue or Typesense to
 * decide what is compatible.
 */

/** Hard ceiling on an explicit `partIds` list in one request. */
export const MAX_EXPLICIT_PART_IDS = 500;

/**
 * Ceiling on a filtered-scope mutation, which resolves server-side rather than
 * shipping thousands of ids from the browser. Higher than the explicit limit
 * because the admin is naming a filter, not a list, and the work is chunked.
 */
export const MAX_FILTERED_SCOPE_PART_IDS = 2000;

/**
 * Filtered-scope size at which a mutation must be explicitly acknowledged.
 *
 * Anything at or above this many products is a bulk operation, so it requires
 * `confirmCount` to echo the affected count. Introduced after the 2026-09-28
 * incident, in which a filtered link silently affected 184 products. Bulk work
 * is still permitted; it just cannot happen by accident.
 */
export const BULK_CONFIRM_THRESHOLD = 25;

/**
 * Rows per SQL statement. The pool is `max: 1` (lib/db/index.ts), so a single
 * enormous statement would hold the only connection for the whole table scan.
 */
export const DB_CHUNK_SIZE = 250;

/** Id shape guard. Rejects anything that could not be a real primary key. */
const MAX_ID_LENGTH = 120;

export type MutationAction = "link" | "unlink";

export type MutationScope = "ids" | "filtered";

export type CompatibilityFilters = {
  q: string;
  brand: string;
  categoryId: string;
  /** Always "all" or "not_linked" for a mutation: "linked" rows need no work. */
  status: string;
};

export const EMPTY_MUTATION_FILTERS: CompatibilityFilters = {
  q: "",
  brand: "",
  categoryId: "",
  status: "all",
};

export type NormalisedMutation = {
  action: MutationAction;
  vehicleId: string;
  scope: MutationScope;
  partIds: string[];
  filters: CompatibilityFilters;
  expectedCount: number | null;
};

export type ValidationFailure = {
  ok: false;
  status: 400 | 409;
  error: string;
};

export type ValidationSuccess = { ok: true; value: NormalisedMutation };

export type ValidationResult = ValidationSuccess | ValidationFailure;

/** A plausible primary key: printable, no whitespace, bounded length. */
export function isWellFormedId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_ID_LENGTH) return false;
  return !/[\s\u0000-\u001f\u007f]/.test(trimmed);
}

function readFilters(raw: unknown): CompatibilityFilters {
  const source = (raw ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return {
    q: text(source.q),
    brand: text(source.brand),
    categoryId: text(source.categoryId),
    status: text(source.status) || "all",
  };
}

function fail(status: 400 | 409, error: string): ValidationFailure {
  return { ok: false, status, error };
}

/**
 * Validate and normalise a mutation request.
 *
 * Rejects rather than silently repairing: a duplicate id in the payload is
 * reported as a client error instead of being quietly de-duplicated, because a
 * request that does not match what the admin selected should not succeed.
 */
export function validateMutationRequest(
  raw: unknown,
  action: MutationAction,
): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail(400, "Invalid payload.");
  }
  const body = raw as Record<string, unknown>;

  const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
  if (!isWellFormedId(vehicleId)) {
    return fail(400, "A vehicleId is required.");
  }

  const scope: MutationScope = body.scope === "filtered" ? "filtered" : "ids";

  if (scope === "filtered") {
    const expectedRaw = body.expectedCount;
    const expectedCount =
      typeof expectedRaw === "number" && Number.isFinite(expectedRaw)
        ? Math.floor(expectedRaw)
        : Number.NaN;
    if (!Number.isFinite(expectedCount) || expectedCount < 1) {
      return fail(400, "A filtered mutation must state how many products it will affect.");
    }
    if (expectedCount > MAX_FILTERED_SCOPE_PART_IDS) {
      return fail(
        400,
        `A filtered mutation is limited to ${MAX_FILTERED_SCOPE_PART_IDS} products. Narrow the filter, or select the products individually.`,
      );
    }
    /* A filtered scope above this size is a bulk operation, not a correction.
       The 2026-09-28 incident was exactly this: a filtered link that touched 184
       products, which reads as a mis-click in a results grid and is not
       something the admin intended. Legitimate bulk work still works — it now
       has to be acknowledged deliberately, and the client echoes the count back
       in `confirmCount` so a stale dialog can never confirm a changed result
       set. The ceiling above is unchanged. */
    if (expectedCount >= BULK_CONFIRM_THRESHOLD) {
      const confirm = body.confirmCount;
      if (typeof confirm !== "number" || Math.floor(confirm) !== expectedCount) {
        return fail(
          400,
          `This affects ${expectedCount} products, so it is a bulk operation. Re-send with confirmCount: ${expectedCount} once the summary is confirmed.`,
        );
      }
    }
    return {
      ok: true,
      value: {
        action,
        vehicleId,
        scope,
        partIds: [],
        filters: readFilters(body.filters),
        expectedCount,
      },
    };
  }

  if (!Array.isArray(body.partIds)) {
    return fail(400, "Select at least one product.");
  }
  if (body.partIds.length === 0) {
    return fail(400, "Select at least one product.");
  }
  if (body.partIds.length > MAX_EXPLICIT_PART_IDS) {
    return fail(
      400,
      `Too many products in one request. The limit is ${MAX_EXPLICIT_PART_IDS}; select the matching results instead of listing them.`,
    );
  }

  const partIds: string[] = [];
  for (const candidate of body.partIds) {
    if (!isWellFormedId(candidate)) {
      return fail(400, "One or more product ids are malformed.");
    }
    const id = candidate.trim();
    if (partIds.includes(id)) {
      return fail(400, "The same product was listed more than once.");
    }
    partIds.push(id);
  }

  return {
    ok: true,
    value: {
      action,
      vehicleId,
      scope,
      partIds,
      filters: readFilters(body.filters),
      expectedCount: null,
    },
  };
}

/* ----------------------------------------------------------------- planning */

/**
 * Which links are new, and which the admin was told about but that already
 * exist. Request order is preserved so the result reads in selection order.
 */
export function planLink(
  alreadyLinkedPartIds: ReadonlySet<string>,
  requested: readonly string[],
): { toInsert: string[]; alreadyLinked: string[] } {
  const toInsert: string[] = [];
  const alreadyLinked: string[] = [];
  for (const partId of requested) {
    if (alreadyLinkedPartIds.has(partId)) alreadyLinked.push(partId);
    else toInsert.push(partId);
  }
  return { toInsert, alreadyLinked };
}

export function planUnlink(
  currentlyLinkedPartIds: ReadonlySet<string>,
  requested: readonly string[],
): { toDelete: string[]; alreadyUnlinked: string[] } {
  const toDelete: string[] = [];
  const alreadyUnlinked: string[] = [];
  for (const partId of requested) {
    if (currentlyLinkedPartIds.has(partId)) toDelete.push(partId);
    else alreadyUnlinked.push(partId);
  }
  return { toDelete, alreadyUnlinked };
}

/** Split into bounded statements. A non-positive size would loop forever. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const step = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) {
    out.push(items.slice(i, i + step));
  }
  return out;
}

/**
 * The authoritative `vehicle_ids` for each affected part.
 *
 * Built from the COMPLETE Postgres compatibility set for the part, never from
 * the vehicle the admin just touched. A part compatible with three vehicles
 * must be sent all three, or a one-vehicle link would erase the other two from
 * search.
 *
 * A part present in the map with an empty array means "Postgres is authoritative
 * and this part genuinely has no vehicle links", which is a real, verified state
 * and must be published as `[]` so the index stops advertising stale vehicles.
 * A part ABSENT from the map has no known set, so it is omitted: asserting an
 * empty list for a part nobody read would be fabricating state.
 *
 * The reader seeds every requested part it actually found, so the distinction
 * above is carried by presence in the map rather than by array length.
 */
export function buildVehicleIdsPayload(
  authoritative: ReadonlyMap<string, readonly string[]>,
  partIds: readonly string[],
): Array<{ id: string; vehicle_ids: string[] }> {
  const payload: Array<{ id: string; vehicle_ids: string[] }> = [];
  for (const partId of partIds) {
    /* `has`, not truthiness: an empty array is a verified "no vehicles" state
       and must be published, while an absent key means the part was never read. */
    if (!authoritative.has(partId)) continue;
    payload.push({ id: partId, vehicle_ids: [...(authoritative.get(partId) ?? [])].sort() });
  }
  return payload;
}

/* ------------------------------------------------------------------ results */

export type SyncState = {
  attempted: boolean;
  ok: boolean;
  error: string | null;
  /** Affected parts deliberately not synced because they are not in the index. */
  skipped: number;
  documents: number;
};

export type LinkResult = {
  action: "link";
  vehicleId: string;
  requested: number;
  /** Newly created links. */
  linked: number;
  /** Already present, so nothing was written for them. */
  alreadyLinked: number;
  /** Ids that matched no real part. */
  failed: number;
  sync: SyncState;
};

export type UnlinkResult = {
  action: "unlink";
  vehicleId: string;
  requested: number;
  unlinked: number;
  alreadyUnlinked: number;
  failed: number;
  sync: SyncState;
};

export type MutationResult = LinkResult | UnlinkResult;

export function emptySyncState(): SyncState {
  return { attempted: false, ok: true, error: null, skipped: 0, documents: 0 };
}

export function summariseLink(input: {
  vehicleId: string;
  requested: number;
  inserted: number;
  alreadyLinked: number;
  failed: number;
  sync: SyncState;
}): LinkResult {
  return {
    action: "link",
    vehicleId: input.vehicleId,
    requested: input.requested,
    linked: input.inserted,
    alreadyLinked: input.alreadyLinked,
    failed: input.failed,
    sync: input.sync,
  };
}

export function summariseUnlink(input: {
  vehicleId: string;
  requested: number;
  removed: number;
  alreadyUnlinked: number;
  failed: number;
  sync: SyncState;
}): UnlinkResult {
  return {
    action: "unlink",
    vehicleId: input.vehicleId,
    requested: input.requested,
    unlinked: input.removed,
    alreadyUnlinked: input.alreadyUnlinked,
    failed: input.failed,
    sync: input.sync,
  };
}

/** One line the admin can read, built from the result and nothing else. */
export function describeLinkResult(result: LinkResult): string {
  const parts = [`Linked ${result.linked}`];
  if (result.alreadyLinked) parts.push(`already linked ${result.alreadyLinked}`);
  if (result.failed) parts.push(`failed ${result.failed}`);
  return parts.join(", ");
}

export function describeUnlinkResult(result: UnlinkResult): string {
  const parts = [`Unlinked ${result.unlinked}`];
  if (result.alreadyUnlinked) parts.push(`already unlinked ${result.alreadyUnlinked}`);
  if (result.failed) parts.push(`failed ${result.failed}`);
  return parts.join(", ");
}
