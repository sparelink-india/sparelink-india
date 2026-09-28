import {
  buildVehicleIdsPayload,
  chunk,
  DB_CHUNK_SIZE,
  emptySyncState,
  MAX_FILTERED_SCOPE_PART_IDS,
  planLink,
  planUnlink,
  summariseLink,
  summariseUnlink,
  validateMutationRequest,
  type CompatibilityFilters,
  type MutationAction,
  type MutationResult,
  type NormalisedMutation,
  type LinkResult,
  type UnlinkResult,
  type SyncState,
  type ValidationResult,
} from "@/lib/admin-vehicle-compatibility-mutations";

/**
 * Vehicle compatibility mutation service.
 *
 * The whole mutation is expressed as one function over INJECTED boundaries, so
 * the ordering rules that matter — commit the database, THEN tell Typesense,
 * and never pretend the external update was part of the transaction — are
 * testable with fakes and are not buried inside route handlers.
 *
 * WHY TYPESENSE IS NOT IN THE TRANSACTION
 *
 * Postgres and Typesense cannot share a transaction. Pretending otherwise would
 * mean either holding a database transaction open across a network call (the
 * pool is `max: 1`, so that stalls the whole app) or pretending a rollback can
 * undo a remote write (it cannot). So the order is fixed:
 *
 *   1. commit the database change - this is the authority
 *   2. read the authoritative compatibility set back out of Postgres
 *   3. push only the affected documents to Typesense
 *   4. if step 3 fails, LEAVE the database change in place, report the failure,
 *      and write an audit record naming the parts that need re-syncing
 *
 * A failed sync is therefore a visible, retryable inconsistency rather than a
 * silent one, and the storefront keeps answering from Postgres in the meantime
 * because search derives its vehicle ids from the database, not from Typesense.
 *
 * NO COMPATIBILITY DECISION IS MADE HERE. This module never reads
 * `vehicle_types`, `specifications` or the source catalogue, and it never
 * decides what a part fits. It only adds and removes rows in
 * `part_vehicle_compatibility` and republishes the result.
 */

export type AuditRecord = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
};

export type MutationDeps = {
  /** True only when the id is a row in the `vehicle` table. */
  vehicleExists(vehicleId: string): Promise<boolean>;
  /** The subset of the requested ids that are real `part` rows. */
  resolveExistingPartIds(partIds: string[]): Promise<Set<string>>;
  /** Of those, the ones already linked to this vehicle. */
  findLinkedPartIds(vehicleId: string, partIds: string[]): Promise<Set<string>>;
  /** Server-side resolution of a filtered scope; ids only. */
  resolveFilteredPartIds(filters: CompatibilityFilters): Promise<string[]>;
  /** Transactional insert, race-safe. Must not throw on an existing pair. */
  insertLinks(vehicleId: string, partIds: string[]): Promise<void>;
  /** Transactional delete, scoped to this vehicle AND these parts. */
  deleteLinks(vehicleId: string, partIds: string[]): Promise<void>;
  /** Complete `vehicle_ids` per part, straight from Postgres. */
  readAuthoritativeVehicleIds(partIds: string[]): Promise<Map<string, string[]>>;
  /** Parts that are actually in the search index (published and approved). */
  filterIndexedPartIds(partIds: string[]): Promise<string[]>;
  /** Push documents. Never throws; reports failure instead. */
  syncTypesense(
    documents: Array<{ id: string; vehicle_ids: string[] }>,
  ): Promise<{ ok: boolean; error?: string }>;
  audit(record: AuditRecord): Promise<void>;
};

export type MutationFailure = {
  ok: false;
  status: 400 | 404 | 409;
  error: string;
};

export type MutationOutcome =
  | { ok: true; result: MutationResult }
  | MutationFailure;

function validPartIds(requested: readonly string[], existing: ReadonlySet<string>): {
  valid: string[];
  unknown: string[];
} {
  const valid: string[] = [];
  const unknown: string[] = [];
  for (const partId of requested) {
    if (existing.has(partId)) valid.push(partId);
    else unknown.push(partId);
  }
  return { valid, unknown };
}

async function syncAffected(
  deps: MutationDeps,
  actorUserId: string,
  mutation: NormalisedMutation,
  affected: string[],
): Promise<SyncState> {
  const state = emptySyncState();
  if (affected.length === 0) return state;
  state.attempted = true;

  /* Only parts that are actually indexed are republished. An unpublished or
     unapproved part has no Typesense document, and upserting one would create a
     document missing the required `part_number`/`name` fields, or worse, expose
     a product the storefront is meant to hide. Those parts are reported as
     skipped instead. */
  const indexed = await deps.filterIndexedPartIds(affected);
  state.skipped = affected.length - indexed.length;

  if (indexed.length === 0) {
    state.documents = 0;
    return state;
  }

  const authoritative = await deps.readAuthoritativeVehicleIds(indexed);
  const documents = buildVehicleIdsPayload(authoritative, indexed);
  state.documents = documents.length;
  if (documents.length === 0) return state;

  const outcome = await deps.syncTypesense(documents);
  if (outcome.ok) {
    state.ok = true;
    state.error = null;
    return state;
  }

  /* The database is already committed and stays that way. This is recorded, not
     undone: a Typesense outage must not cost the admin a committed change they
     can see in the database. */
  state.ok = false;
  state.error = outcome.error ?? "Typesense synchronisation failed.";

  await deps.audit({
    actorUserId,
    action: "vehicle_compatibility.typesense_sync_failed",
    entityType: "vehicle",
    entityId: mutation.vehicleId,
    metadata: {
      mutation: mutation.action,
      vehicles_in_docs: documents.map((doc) => doc.id),
      document_count: documents.length,
      error: state.error,
      retryable: true,
      note: "Database change is committed and authoritative. Re-run the sync for these parts.",
    },
  });

  return state;
}

/**
 * Resolve a request into the concrete part ids it will act on.
 *
 * A filtered scope is re-resolved server-side and checked against the count the
 * admin confirmed, so the browser never ships thousands of ids and the server
 * never acts on a set the admin was not shown.
 */
async function resolveTargets(
  deps: MutationDeps,
  mutation: NormalisedMutation,
): Promise<{ ids: string[] } | { status: 409 | 400; error: string }> {
  if (mutation.scope === "ids") {
    return { ids: mutation.partIds };
  }

  const resolved = await deps.resolveFilteredPartIds(mutation.filters);
  if (resolved.length === 0) {
    return { status: 409, error: "That filter now matches no products. Re-run the search." };
  }
  if (resolved.length > MAX_FILTERED_SCOPE_PART_IDS) {
    return {
      status: 400,
      error: `That filter matches ${resolved.length} products, above the ${MAX_FILTERED_SCOPE_PART_IDS} limit. Narrow it, or select products page by page.`,
    };
  }
  if (mutation.expectedCount !== null && resolved.length !== mutation.expectedCount) {
    return {
      status: 409,
      error: `That filter now matches ${resolved.length} products, not ${mutation.expectedCount}. Confirm again to continue.`,
    };
  }
  return { ids: resolved };
}

/**
 * Overloaded so a caller that asked for "link" gets a `LinkResult` and not a
 * union. The action is a compile-time constant at every call site, so making the
 * caller narrow a union it already knows the answer to would be noise, and it
 * would let a typo like `result.unlinked` on a link slip through.
 */
export async function performCompatibilityMutation(
  action: "link",
  rawBody: unknown,
  actorUserId: string,
  deps: MutationDeps,
): Promise<{ ok: true; result: LinkResult } | MutationFailure>;
export async function performCompatibilityMutation(
  action: "unlink",
  rawBody: unknown,
  actorUserId: string,
  deps: MutationDeps,
): Promise<{ ok: true; result: UnlinkResult } | MutationFailure>;
export async function performCompatibilityMutation(
  action: MutationAction,
  rawBody: unknown,
  actorUserId: string,
  deps: MutationDeps,
): Promise<MutationOutcome>;

export async function performCompatibilityMutation(
  action: MutationAction,
  rawBody: unknown,
  actorUserId: string,
  deps: MutationDeps,
): Promise<MutationOutcome> {
  const validation: ValidationResult = validateMutationRequest(rawBody, action);
  if (!validation.ok) {
    return { ok: false, status: validation.status, error: validation.error };
  }
  const mutation = validation.value;

  if (!(await deps.vehicleExists(mutation.vehicleId))) {
    return { ok: false, status: 404, error: "That vehicle does not exist." };
  }

  const targets = await resolveTargets(deps, mutation);
  if ("status" in targets) {
    return { ok: false, status: targets.status, error: targets.error };
  }

  const { valid, unknown } = validPartIds(
    targets.ids,
    await deps.resolveExistingPartIds(targets.ids),
  );
  const requestedCount = targets.ids.length;

  /* Nothing real to act on: an all-unknown batch is a client error, but an
     already-satisfied batch is a successful no-op, because the admin asked for
     a state they already have. */
  if (valid.length === 0) {
    return {
      ok: false,
      status: 400,
      error:
        action === "link"
          ? "None of the selected products exist."
          : "None of the selected products exist.",
    };
  }

  const alreadyLinked = await deps.findLinkedPartIds(mutation.vehicleId, valid);

  if (action === "link") {
    const plan = planLink(alreadyLinked, valid);
    if (plan.toInsert.length > 0) {
      for (const batch of chunk(plan.toInsert, DB_CHUNK_SIZE)) {
        await deps.insertLinks(mutation.vehicleId, batch);
      }
    }
    /* Both newly linked and already-linked parts are republished: the second
       group may still carry a stale index entry, and the authoritative read is
       cheap for at most a few hundred ids. */
    const sync = await syncAffected(deps, actorUserId, mutation, valid);
    const result = summariseLink({
      vehicleId: mutation.vehicleId,
      requested: requestedCount,
      inserted: plan.toInsert.length,
      alreadyLinked: plan.alreadyLinked.length,
      failed: unknown.length,
      sync,
    });

    await deps.audit({
      actorUserId,
      action: "vehicle_compatibility.link",
      entityType: "vehicle",
      entityId: mutation.vehicleId,
      metadata: {
        requested: result.requested,
        linked: result.linked,
        already_linked: result.alreadyLinked,
        failed: result.failed,
        scope: mutation.scope,
        typesense_synced: result.sync.ok,
        typesense_error: result.sync.error,
        typesense_skipped: result.sync.skipped,
        typesense_documents: result.sync.documents,
      },
    });

    return { ok: true, result };
  }

  const plan = planUnlink(alreadyLinked, valid);
  if (plan.toDelete.length > 0) {
    for (const batch of chunk(plan.toDelete, DB_CHUNK_SIZE)) {
      await deps.deleteLinks(mutation.vehicleId, batch);
    }
  }
  const sync = await syncAffected(deps, actorUserId, mutation, valid);
  const result = summariseUnlink({
    vehicleId: mutation.vehicleId,
    requested: requestedCount,
    removed: plan.toDelete.length,
    alreadyUnlinked: plan.alreadyUnlinked.length,
    failed: unknown.length,
    sync,
  });

  await deps.audit({
    actorUserId,
    action: "vehicle_compatibility.unlink",
    entityType: "vehicle",
    entityId: mutation.vehicleId,
    metadata: {
      requested: result.requested,
      unlinked: result.unlinked,
      already_unlinked: result.alreadyUnlinked,
      failed: result.failed,
      scope: mutation.scope,
      typesense_synced: result.sync.ok,
      typesense_error: result.sync.error,
      typesense_skipped: result.sync.skipped,
      typesense_documents: result.sync.documents,
    },
  });

  return { ok: true, result };
}
