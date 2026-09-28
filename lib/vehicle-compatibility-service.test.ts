import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildVehicleIdsPayload,
  chunk,
  DB_CHUNK_SIZE,
  EMPTY_MUTATION_FILTERS,
  describeLinkResult,
  describeUnlinkResult,
  emptySyncState,
  isWellFormedId,
  MAX_EXPLICIT_PART_IDS,
  MAX_FILTERED_SCOPE_PART_IDS,
  BULK_CONFIRM_THRESHOLD,
  planLink,
  planUnlink,
  summariseLink,
  summariseUnlink,
  validateMutationRequest,
} from "./admin-vehicle-compatibility-mutations";
import {
  performCompatibilityMutation,
  type AuditRecord,
  type MutationDeps,
} from "./vehicle-compatibility-service";
import { resolveActionAvailability } from "./admin-vehicle-compatibility";
import { completeTypesenseDocument } from "./vehicle-compatibility-repository";

/**
 * Mutation tests for the vehicle compatibility write path.
 *
 * NOTHING HERE TOUCHES A DATABASE. Every test drives
 * `performCompatibilityMutation` against an injected fake, so the ordering
 * rules that matter (commit first, sync second, never fake a rollback) are
 * asserted without writing to production. The real boundaries are covered by
 * static source assertions at the bottom of this file.
 */

const VEHICLE = "vehicle-maruti-swift";

type FakeState = {
  vehicles: Set<string>;
  parts: Set<string>;
  linked: Map<string, Set<string>>;
  indexed: Set<string>;
  syncOk: boolean;
  syncError?: string;
  filtered: string[];
  insertCalls: Array<{ vehicleId: string; partIds: string[] }>;
  deleteCalls: Array<{ vehicleId: string; partIds: string[] }>;
  syncCalls: Array<Array<{ id: string; vehicle_ids: string[] }>>;
  auditCalls: AuditRecord[];
  resolveExistingCalls: string[][];
  authoritativeCalls: string[][];
};

function fakeDeps(over: Partial<FakeState> = {}): { state: FakeState; deps: MutationDeps } {
  const state: FakeState = {
    vehicles: new Set([VEHICLE]),
    parts: new Set(),
    linked: new Map(),
    indexed: new Set(),
    syncOk: true,
    filtered: [],
    insertCalls: [],
    deleteCalls: [],
    syncCalls: [],
    auditCalls: [],
    resolveExistingCalls: [],
    authoritativeCalls: [],
    ...over,
  };

  const deps: MutationDeps = {
    async vehicleExists(vehicleId) {
      return state.vehicles.has(vehicleId);
    },
    async resolveExistingPartIds(partIds) {
      state.resolveExistingCalls.push([...partIds]);
      return new Set(partIds.filter((id) => state.parts.has(id)));
    },
    async findLinkedPartIds(vehicleId, partIds) {
      const set = state.linked.get(vehicleId) ?? new Set<string>();
      return new Set(partIds.filter((id) => set.has(id)));
    },
    async resolveFilteredPartIds() {
      return [...state.filtered];
    },
    async insertLinks(vehicleId, partIds) {
      state.insertCalls.push({ vehicleId, partIds: [...partIds] });
      const set = state.linked.get(vehicleId) ?? new Set<string>();
      for (const id of partIds) set.add(id);
      state.linked.set(vehicleId, set);
    },
    async deleteLinks(vehicleId, partIds) {
      state.deleteCalls.push({ vehicleId, partIds: [...partIds] });
      const set = state.linked.get(vehicleId) ?? new Set<string>();
      for (const id of partIds) set.delete(id);
    },
    async readAuthoritativeVehicleIds(partIds) {
      state.authoritativeCalls.push([...partIds]);
      const out = new Map<string, string[]>();
      for (const partId of partIds) {
        const vehicles: string[] = [];
        for (const [vehicleId, set] of state.linked) {
          if (set.has(partId)) vehicles.push(vehicleId);
        }
        out.set(partId, vehicles);
      }
      return out;
    },
    async filterIndexedPartIds(partIds) {
      return partIds.filter((id) => state.indexed.has(id));
    },
    async syncTypesense(documents) {
      state.syncCalls.push(documents.map((d) => ({ ...d })));
      return state.syncOk ? { ok: true } : { ok: false, error: state.syncError ?? "boom" };
    },
    async audit(record) {
      state.auditCalls.push(record);
    },
  };

  return { state, deps };
}

function seed(state: FakeState, partIds: string[], vehicleId = VEHICLE) {
  for (const id of partIds) {
    state.parts.add(id);
    state.indexed.add(id);
  }
  const set = new Set<string>();
  for (const id of partIds) set.add(id);
  state.linked.set(vehicleId, set);
}

/* ------------------------------------------------------------- 1. vehicle id */

describe("validation: vehicle", () => {
  it("1) rejects an unknown or malformed vehicle before touching the database", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["p1"]);

    const bad = await performCompatibilityMutation("link", { vehicleId: "vehicle-nope", partIds: ["p1"] }, "admin-1", deps);
    assert.equal(bad.ok, false);
    assert.equal(bad.ok === false && bad.status, 404);

    for (const vehicleId of ["", "   ", "veh icle", "x".repeat(200)]) {
      const result = validateMutationRequest({ vehicleId, partIds: ["p1"] }, "link");
      assert.equal(result.ok, false, `vehicleId ${JSON.stringify(vehicleId)} should be rejected`);
    }

    // A rejected request must not have written anything.
    assert.equal(state.insertCalls.length, 0);
    assert.deepEqual(state.auditCalls, []);
  });

  it("accepts a well-formed id and rejects malformed part ids", () => {
    assert.equal(isWellFormedId("vehicle-maruti-swift"), true);
    assert.equal(isWellFormedId("part-door-handle-113"), true);
    assert.equal(isWellFormedId("part id"), false);
    assert.equal(isWellFormedId(""), false);
    assert.equal(isWellFormedId(null), false);
    const result = validateMutationRequest({ vehicleId: VEHICLE, partIds: ["ok", "bad id"] }, "link");
    assert.equal(result.ok, false);
  });
});

/* --------------------------------------------------------- 2. empty payload */

describe("validation: payload", () => {
  it("2) rejects an empty part list", () => {
    for (const partIds of [[], undefined, null, "p1"]) {
      const result = validateMutationRequest({ vehicleId: VEHICLE, partIds }, "link");
      assert.equal(result.ok, false, `partIds=${JSON.stringify(partIds)} should be rejected`);
    }
  });

  it("rejects a non-object body", () => {
    for (const body of [null, undefined, "x", 5, [1, 2]]) {
      assert.equal(validateMutationRequest(body, "link").ok, false);
    }
  });

  it("3) rejects duplicate part ids rather than silently de-duplicating", () => {
    const result = validateMutationRequest(
      { vehicleId: VEHICLE, partIds: ["p1", "p2", "p1"] },
      "link",
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error.includes("more than once"), true);
  });

  it("4) enforces the explicit batch limit and names it", () => {
    const atLimit = Array.from({ length: MAX_EXPLICIT_PART_IDS }, (_, i) => `p${i}`);
    assert.equal(validateMutationRequest({ vehicleId: VEHICLE, partIds: atLimit }, "link").ok, true);

    const overLimit = [...atLimit, "one-too-many"];
    const result = validateMutationRequest({ vehicleId: VEHICLE, partIds: overLimit }, "link");
    assert.equal(result.ok, false);
    assert.equal(
      result.ok === false && result.error.includes(String(MAX_EXPLICIT_PART_IDS)),
      true,
      "the error must state the limit so the admin can act on it",
    );
  });

  it("caps a filtered mutation and requires a confirmed count", () => {
    assert.equal(
      validateMutationRequest({ vehicleId: VEHICLE, scope: "filtered" }, "link").ok,
      false,
      "a filtered mutation without a count is not confirmed",
    );
    const tooMany = validateMutationRequest(
      { vehicleId: VEHICLE, scope: "filtered", expectedCount: MAX_FILTERED_SCOPE_PART_IDS + 1 },
      "link",
    );
    assert.equal(tooMany.ok, false);
    assert.equal(
      tooMany.ok === false && tooMany.error.includes(String(MAX_FILTERED_SCOPE_PART_IDS)),
      true,
    );
  });

  it("requires a bulk filtered mutation to acknowledge its size", () => {
    /* The 2026-09-28 incident: a filtered link affecting 184 products was accepted
       with nothing but a count, and the count was small enough not to look like a
       bulk operation. Above the threshold the count must be echoed back, so the
       request is only valid against the result set the admin actually confirmed. */
    const bulk = BULK_CONFIRM_THRESHOLD;
    const unconfirmed = validateMutationRequest(
      { vehicleId: VEHICLE, scope: "filtered", expectedCount: 184 },
      "link",
    );
    assert.equal(unconfirmed.ok, false, "a bulk filtered mutation must be acknowledged");
    assert.equal(unconfirmed.ok === false && unconfirmed.error.includes("bulk operation"), true);

    const confirmed = validateMutationRequest(
      { vehicleId: VEHICLE, scope: "filtered", expectedCount: 184, confirmCount: 184 },
      "link",
    );
    assert.equal(confirmed.ok, true, "an acknowledged bulk mutation is still allowed");

    const stale = validateMutationRequest(
      { vehicleId: VEHICLE, scope: "filtered", expectedCount: 184, confirmCount: 150 },
      "link",
    );
    assert.equal(stale.ok, false, "a stale confirmation must not pass");

    /* A small correction is not a bulk operation and stays one request. */
    assert.equal(
      validateMutationRequest({ vehicleId: VEHICLE, scope: "filtered", expectedCount: bulk - 1 }, "link").ok,
      true,
    );
    /* An explicit id list is unaffected; the guard is on the filtered scope only.
       The real explicit ceiling is 500, so 200 must still be accepted here. */
    const explicit = validateMutationRequest(
      { vehicleId: VEHICLE, scope: "ids", partIds: Array.from({ length: 200 }, (_, i) => `p${i}`) },
      "link",
    );
    assert.equal(explicit.ok, true, explicit.ok === false ? explicit.error : "");
  });

  it("re-confirms when the filtered set changed since the admin saw it", async () => {
    const { state, deps } = fakeDeps();
    state.parts = new Set(["p1", "p2", "p3"]);
    state.indexed = new Set(["p1", "p2", "p3"]);
    state.filtered = ["p1", "p2", "p3"];

    const result = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, scope: "filtered", expectedCount: 2 },
      "admin-1",
      deps,
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 409);
    assert.equal(state.insertCalls.length, 0, "a stale confirmation must not write");
  });
});

/* ------------------------------------------------------------ 5. link paths */

describe("link", () => {
  it("5) links a genuinely new pair", async () => {
    const { state, deps } = fakeDeps();
    state.parts = new Set(["p1", "p2"]);
    state.indexed = new Set(["p1", "p2"]);

    const outcome = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);
    const result = outcome.ok ? outcome.result : null;
    assert.equal(result?.action, "link");
    assert.equal(result && "linked" in result ? result.linked : 0, 2);
    assert.equal(result && "alreadyLinked" in result ? result.alreadyLinked : -1, 0);
    assert.equal(result && "failed" in result ? result.failed : -1, 0);
    assert.equal(describeLinkResult(result as never), "Linked 2");
  });

  it("6) is idempotent for an already-linked pair and does not write again", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["p1", "p2"]);

    const outcome = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);
    const result = outcome.ok && "linked" in outcome.result ? outcome.result : null;
    assert.equal(result?.linked, 0, "nothing new to link");
    assert.equal(result?.alreadyLinked, 2);
    assert.equal(state.insertCalls.length, 0, "an already-satisfied link must not be written");
  });

  it("10) reports correct counts for a mixed batch", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["linked-1"]);
    state.parts.add("fresh-1");
    state.parts.add("fresh-2");
    // "ghost" is deliberately NOT added to `parts`: it stands for an id that
    // matches no real part and must be counted as failed, not linked.
    state.indexed.add("fresh-1");
    state.indexed.add("fresh-2");

    const outcome = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["linked-1", "fresh-1", "fresh-2", "ghost"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);
    const result = outcome.ok && "linked" in outcome.result ? outcome.result : null;
    assert.equal(result?.requested, 4);
    assert.equal(result?.linked, 2, "the two real, unlinked parts");
    assert.equal(result?.alreadyLinked, 1);
    assert.equal(result?.failed, 1, "the id that matches no part");
  });

  it("fails the whole request when no id matches a real part", async () => {
    const { state, deps } = fakeDeps();
    const outcome = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["ghost-1", "ghost-2"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, false);
    assert.equal(state.insertCalls.length, 0);
  });
});

/* ---------------------------------------------------------- 7. unlink paths */

describe("unlink", () => {
  it("7) unlinks an existing pair", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["p1", "p2"]);

    const outcome = await performCompatibilityMutation(
      "unlink",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);
    const result = outcome.ok && "unlinked" in outcome.result ? outcome.result : null;
    assert.equal(result?.unlinked, 2);
    assert.equal(result?.alreadyUnlinked, 0);
    assert.equal(describeUnlinkResult(result as never), "Unlinked 2");
    assert.equal(state.deleteCalls.length, 1);
  });

  it("8) is idempotent for an already-unlinked pair", async () => {
    const { state, deps } = fakeDeps();
    state.parts = new Set(["p1", "p2"]);
    state.indexed = new Set(["p1", "p2"]);
    state.linked.set(VEHICLE, new Set());

    const outcome = await performCompatibilityMutation(
      "unlink",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);
    const result = outcome.ok && "unlinked" in outcome.result ? outcome.result : null;
    assert.equal(result?.unlinked, 0);
    assert.equal(result?.alreadyUnlinked, 2);
    assert.equal(state.deleteCalls.length, 0);
  });

  it("9) can never touch another vehicle's compatibility", async () => {
    const otherVehicle = "vehicle-tata-nexon";
    const { state, deps } = fakeDeps();
    state.vehicles.add(otherVehicle);
    seed(state, ["p1"]); // linked to Swift
    // The same part is also linked to Nexon and must survive.
    state.linked.set(otherVehicle, new Set(["p1"]));

    const outcome = await performCompatibilityMutation(
      "unlink",
      { vehicleId: VEHICLE, partIds: ["p1"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);

    // The delete was scoped to the one vehicle.
    assert.equal(state.deleteCalls.length, 1);
    assert.equal(state.deleteCalls[0].vehicleId, VEHICLE);
    assert.deepEqual(state.deleteCalls[0].partIds, ["p1"]);

    // And the other vehicle still has its link.
    assert.equal(state.linked.get(otherVehicle)?.has("p1"), true);
  });

  it("reports correct counts for a mixed unlink batch", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["present-1"]);
    state.parts.add("absent-1");
    state.indexed.add("absent-1");

    const outcome = await performCompatibilityMutation(
      "unlink",
      { vehicleId: VEHICLE, partIds: ["present-1", "absent-1"] },
      "admin-1",
      deps,
    );
    const result = outcome.ok && "unlinked" in outcome.result ? outcome.result : null;
    assert.equal(result?.unlinked, 1);
    assert.equal(result?.alreadyUnlinked, 1);
  });
});

/* --------------------------------------------------------------- 11-12 sync */

describe("Typesense synchronisation", () => {
  it("11) republishes only the affected parts", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["p1", "p2", "p3"]);
    // p3 is also a real part but was never selected.
    state.parts.add("p3");
    state.indexed.add("p3");

    await performCompatibilityMutation(
      "unlink",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );

    assert.equal(state.syncCalls.length, 1);
    const syncedIds = state.syncCalls[0].map((d) => d.id).sort();
    assert.deepEqual(syncedIds, ["p1", "p2"], "an unselected part must not be republished");
    assert.equal(
      state.authoritativeCalls[0].includes("p3"),
      false,
      "the authoritative read must also be limited to affected parts",
    );
  });

  it("12) sends the COMPLETE authoritative vehicle set, not just the one touched", async () => {
    const { state, deps } = fakeDeps();
    seed(state, ["p1"], VEHICLE);
    // p1 also fits two other vehicles. A sync that sent only the vehicle just
    // linked would erase those from search.
    state.linked.set("vehicle-hyundai-i20", new Set(["p1"]));
    state.linked.set("vehicle-tata-nexon", new Set(["p1"]));

    const outcome = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["p1"] },
      "admin-1",
      deps,
    );
    assert.equal(outcome.ok, true);

    const doc = state.syncCalls[0][0];
    assert.deepEqual(doc, {
      id: "p1",
      vehicle_ids: [VEHICLE, "vehicle-hyundai-i20", "vehicle-tata-nexon"].sort(),
    });
  });

  it("skips parts that are not in the search index instead of creating documents", async () => {
    const { state, deps } = fakeDeps();
    state.parts = new Set(["hidden"]);
    // not added to `indexed` - e.g. unpublished or unapproved
    await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["hidden"] },
      "admin-1",
      deps,
    );
    assert.equal(state.syncCalls.length, 0, "an unindexed part must not be pushed");
    const outcome = state.auditCalls.at(-1);
    assert.equal(outcome && outcome.action, "vehicle_compatibility.link");
  });
});

/* --------------------------------------------------------------- 13-14 sync */

describe("a Typesense failure does not undo a committed change", () => {
  function failing() {
    const { state, deps } = fakeDeps({ syncOk: false, syncError: "Typesense unavailable" });
    seed(state, ["p1", "p2"]);
    return { state, deps };
  }

  it("13) leaves the database change committed and still reports the link", async () => {
    const { state, deps } = failing();
    // Remove p1 and p2 from the linked set so the link is a real write.
    state.linked.set(VEHICLE, new Set());

    const outcome = await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );

    assert.equal(outcome.ok, true, "the mutation itself must still report success");
    const result = outcome.ok && "linked" in outcome.result ? outcome.result : null;
    assert.equal(result?.linked, 2, "the committed links are reported as linked");
    assert.equal(result?.sync.ok, false);
    assert.equal(result?.sync.error, "Typesense unavailable");

    // The database write really happened, and nothing "rolled it back".
    assert.equal(state.insertCalls.length, 1);
    assert.equal(state.linked.get(VEHICLE)?.has("p1"), true);
    assert.equal(state.linked.get(VEHICLE)?.has("p2"), true);
  });

  it("14) records the sync failure so the drift is visible and retryable", async () => {
    const { state, deps } = failing();
    state.linked.set(VEHICLE, new Set());

    await performCompatibilityMutation(
      "link",
      { vehicleId: VEHICLE, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
    );

    const failure = state.auditCalls.find(
      (r) => r.action === "vehicle_compatibility.typesense_sync_failed",
    );
    assert.ok(failure, "a failed sync must leave an audit record");
    assert.equal(failure.entityId, VEHICLE);
    assert.equal(failure.metadata.retryable, true);
    assert.equal(failure.metadata.error, "Typesense unavailable");
    assert.deepEqual(
      (failure.metadata.vehicles_in_docs as string[]).sort(),
      ["p1", "p2"],
      "the record must name the parts that need re-syncing",
    );

    // The success audit still happened, and records that the sync failed.
    const success = state.auditCalls.find((r) => r.action === "vehicle_compatibility.link");
    assert.ok(success);
    assert.equal(success.metadata.typesense_synced, false);
    assert.equal(success.metadata.typesense_error, "Typesense unavailable");
  });
});

/* ---------------------------------------------------------- 15. authorising */

describe("authorisation", () => {
  it("15) is enforced before any dependency is reached", async () => {
    for (const file of [
      "app/api/admin/vehicle-compatibility/link/route.ts",
      "app/api/admin/vehicle-compatibility/unlink/route.ts",
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      const guard = source.indexOf("requireAdminApi");
      const body = source.indexOf("performCompatibilityMutation");
      assert.ok(guard > -1, `${file} must call requireAdminApi`);
      assert.ok(
        guard < body,
        `${file} must authenticate before doing any work`,
      );
      assert.ok(
        source.includes('if ("error" in access) return access.error;'),
        `${file} must return the gate's response verbatim`,
      );
    }
  });
});

/* ------------------------------------------------------------ pure helpers */

describe("planning and chunking", () => {
  it("preserves selection order when splitting a plan", () => {
    const plan = planLink(new Set(["a"]), ["a", "b", "c"]);
    assert.deepEqual(plan.toInsert, ["b", "c"]);
    assert.deepEqual(plan.alreadyLinked, ["a"]);

    const unlink = planUnlink(new Set(["b"]), ["a", "b"]);
    assert.deepEqual(unlink.toDelete, ["b"]);
    assert.deepEqual(unlink.alreadyUnlinked, ["a"]);
  });

  it("chunks into bounded statements and never loops forever", () => {
    const items = Array.from({ length: 1001 }, (_, i) => i);
    const batches = chunk(items, DB_CHUNK_SIZE);
    assert.equal(batches.length, 5);
    assert.equal(batches[0].length, DB_CHUNK_SIZE);
    assert.equal(batches[4].length, 1);
    assert.equal(batches.flat().length, 1001);
    assert.deepEqual(chunk([], 10), []);
    assert.deepEqual(chunk([1, 2, 3], 0).length, 3, "a zero size must not hang");
  });

  it("omits a part with no authoritative row rather than asserting an empty set", () => {
    const authoritative = new Map([["p1", ["v2", "v1"]]]);
    assert.deepEqual(buildVehicleIdsPayload(authoritative, ["p1", "missing"]), [
      { id: "p1", vehicle_ids: ["v1", "v2"] },
    ]);
  });

  it("publishes an empty set for a part the database says has no vehicles", () => {
    /* The 2026-09-28 incident: 184 parts were unlinked, so their authoritative
       set is genuinely empty. Omitting them left the index advertising whatever
       it already held, and the caller produced a zero-document sync that reported
       success without ever correcting anything. */
    const authoritative = new Map<string, string[]>([["p1", []], ["p2", ["v1"]]]);
    assert.deepEqual(buildVehicleIdsPayload(authoritative, ["p1", "p2"]), [
      { id: "p1", vehicle_ids: [] },
      { id: "p2", vehicle_ids: ["v1"] },
    ]);
  });

  it("publishes an emptied part instead of reporting a sync that sent nothing", async () => {
    /* Regression for the 2026-09-28 incident: unlinking the last vehicle from a
       part produced an empty payload, `documents === 0` short-circuited to
       `ok: true`, and the admin was told the search index had been updated when
       it had not been touched. The document must now be sent with an empty set. */
    const { state, deps } = fakeDeps();
    seed(state, ["p1"]);

    const outcome = await performCompatibilityMutation(
      "unlink",
      { action: "unlink", vehicleId: VEHICLE, scope: "ids", partIds: ["p1"], filters: EMPTY_MUTATION_FILTERS },
      "u1",
      deps,
    );

    assert.equal(outcome.ok, true);
    assert.equal(outcome.result.sync.attempted, true);
    assert.equal(outcome.result.sync.ok, true);
    assert.equal(state.syncCalls.length, 1, "the emptied part must still be published");
    assert.deepEqual(state.syncCalls[0], [{ id: "p1", vehicle_ids: [] }]);
  });

  it("summarises an untouched result without inventing numbers", () => {
    const sync = emptySyncState();
    const link = summariseLink({ vehicleId: VEHICLE, requested: 0, inserted: 0, alreadyLinked: 0, failed: 0, sync });
    assert.equal(describeLinkResult(link), "Linked 0");
    const unlink = summariseUnlink({ vehicleId: VEHICLE, requested: 3, removed: 0, alreadyUnlinked: 3, failed: 0, sync });
    assert.equal(describeUnlinkResult(unlink), "Unlinked 0, already unlinked 3");
  });
});

/* ------------------------------------------------ status-filter action gating */

describe("action availability follows the status filter", () => {
  const rows = (...linked: boolean[]) => linked.map((isLinked) => ({ isLinked }));

  it("status=linked disables Link and permits Unlink", () => {
    const plans = resolveActionAvailability({
      status: "linked",
      scopeIsFiltered: false,
      scopeTotal: 10,
      selectedProducts: rows(true, true, true),
    });
    assert.equal(plans.link.enabled, false);
    assert.equal(plans.link.count, 0, "nothing is linkable in a linked-only view");
    assert.match(plans.link.reason ?? "", /already linked/);
    assert.equal(plans.unlink.enabled, true);
    assert.equal(plans.unlink.count, 3);
    assert.equal(plans.unlink.exact, true);
  });

  it("status=not_linked permits Link and disables Unlink", () => {
    const plans = resolveActionAvailability({
      status: "not_linked",
      scopeIsFiltered: false,
      scopeTotal: 10,
      selectedProducts: rows(false, false),
    });
    assert.equal(plans.link.enabled, true);
    assert.equal(plans.link.count, 2);
    assert.equal(plans.unlink.enabled, false);
    assert.equal(plans.unlink.count, 0);
    assert.match(plans.unlink.reason ?? "", /not linked/);
  });

  it("status=all preserves both actions for a mixed selection", () => {
    const plans = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: false,
      scopeTotal: 10,
      selectedProducts: rows(true, false, false),
    });
    assert.equal(plans.link.enabled, true, "a mixed selection can still be linked");
    assert.equal(plans.link.count, 2, "only the not-linked rows are linkable");
    assert.equal(plans.unlink.enabled, true);
    assert.equal(plans.unlink.count, 1, "only the linked row is unlinkable");
    assert.equal(plans.link.exact, true);
    assert.equal(plans.unlink.exact, true);
  });

  it("counts only the actionable rows when status=all", () => {
    // The selected rows are 2 linked and 3 not linked, so Link is 3 and
    // Unlink is 2. Reporting the shared total of 5 for both would be wrong.
    const plans = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: false,
      scopeTotal: 5,
      selectedProducts: rows(true, true, false, false, false),
    });
    assert.equal(plans.link.count, 3);
    assert.equal(plans.unlink.count, 2);
  });

  it("a uniform filtered scope is exact; a mixed one is not", () => {
    const notLinkedScope = resolveActionAvailability({
      status: "not_linked",
      scopeIsFiltered: true,
      scopeTotal: 125,
      selectedProducts: [],
    });
    assert.equal(notLinkedScope.link.enabled, true);
    assert.equal(notLinkedScope.link.count, 125);
    assert.equal(notLinkedScope.link.exact, true, "a not-linked filter is entirely linkable");

    const linkedScope = resolveActionAvailability({
      status: "linked",
      scopeIsFiltered: true,
      scopeTotal: 125,
      selectedProducts: [],
    });
    assert.equal(linkedScope.link.enabled, false, "nothing to link in a linked-only scope");
    assert.equal(linkedScope.unlink.exact, true);

    const mixedScope = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: true,
      scopeTotal: 125,
      selectedProducts: [],
    });
    assert.equal(mixedScope.link.enabled, true);
    assert.equal(mixedScope.link.count, 125);
    assert.equal(
      mixedScope.link.exact,
      false,
      "a mixed filtered scope cannot be split without a second count query",
    );
    assert.equal(mixedScope.unlink.enabled, true);
    assert.equal(mixedScope.unlink.exact, false);
  });

  it("disables both actions when nothing matches the filter", () => {
    const plans = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: true,
      scopeTotal: 0,
      selectedProducts: [],
    });
    assert.equal(plans.link.enabled, false);
    assert.equal(plans.unlink.enabled, false);
    assert.equal(plans.link.count, 0);
  });

  it("an empty selection disables both actions even under status=all", () => {
    const plans = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: false,
      scopeTotal: 50,
      selectedProducts: [],
    });
    assert.equal(plans.link.enabled, false);
    assert.equal(plans.unlink.enabled, false);
  });

  it("always explains why an action is unavailable", () => {
    for (const status of ["all", "linked", "not_linked"] as const) {
      const plans = resolveActionAvailability({
        status,
        scopeIsFiltered: false,
        scopeTotal: 0,
        selectedProducts: [],
      });
      assert.ok(plans.link.reason, `link must explain itself under status=${status}`);
      assert.ok(plans.unlink.reason, `unlink must explain itself under status=${status}`);
    }
  });

  it("preserves the two selection scopes rather than merging them", () => {
    // The filter narrows what an action may do; it must never widen the scope.
    const byId = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: false,
      scopeTotal: 9000,
      selectedProducts: rows(false),
    });
    assert.equal(byId.link.count, 1, "an id selection submits only the ticked row");

    const byFilter = resolveActionAvailability({
      status: "all",
      scopeIsFiltered: true,
      scopeTotal: 9000,
      selectedProducts: [],
    });
    assert.equal(byFilter.link.count, 9000, "a filtered scope submits the whole result set");
  });
});

/* ------------------------------------------------- real boundary assertions */

describe("the real boundaries are written safely", () => {
  const repo = readFileSync(
    path.join(process.cwd(), "lib", "vehicle-compatibility-repository.ts"),
    "utf8",
  );

  it("scopes the delete by one equality and one list, never two lists", () => {
    const del = repo.slice(repo.indexOf("async deleteLinks"), repo.indexOf("async readAuthoritativeVehicleIds"));
    assert.ok(del.includes("eq(partVehicleCompatibility.vehicleId, vehicleId)"));
    assert.ok(del.includes("inArray(partVehicleCompatibility.partId, batch)"));
    assert.equal(
      /inArray\(partVehicleCompatibility\.vehicleId/.test(repo),
      false,
      "an IN list on vehicle_id would make the delete a cartesian match",
    );
  });

  it("relies on the unique index for race safety, not only on a pre-read", () => {
    const ins = repo.slice(repo.indexOf("async insertLinks"), repo.indexOf("async deleteLinks"));
    assert.ok(ins.includes("onConflictDoNothing"), "the unique index must be the backstop");
  });

  it("never decides compatibility from a second signal", () => {
    for (const forbidden of ["vehicleTypes", "vehicle_types", "specifications"]) {
      assert.equal(
        repo.includes(forbidden),
        false,
        `${forbidden} is not the compatibility authority and must not be read`,
      );
    }
  });

  it("publishes only indexed parts and upserts rather than replacing documents", () => {
    assert.ok(repo.includes("isPublished"));
    assert.ok(repo.includes("APPROVED"));
    assert.ok(repo.includes('action: "upsert"'));
  });

  it("completes each upsert with the fields the collection requires", () => {
    /* A bare `{id, vehicle_ids}` upsert is rejected with HTTP 400 because
       `part_number` and `name` are declared in the schema, which failed the whole
       batch on 2026-09-28 and left 184 documents unsynchronised. */
    assert.ok(repo.includes("TYPESENSE_REQUIRED_FIELDS"));
    assert.ok(repo.includes("completeTypesenseDocument"));
    assert.ok(
      repo.includes("batch.map((doc) => completeForTypesense(doc))"),
      "each document must be completed before the batch is sent",
    );
    for (const field of ["part_number", "name"]) {
      assert.ok(repo.includes(field), `schema field ${field} must be carried through`);
    }
  });
});

describe("Typesense document completion", () => {
  it("keeps the vehicle set and backfills required fields from the stored copy", () => {
    const out = completeTypesenseDocument(
      { id: "p1", vehicle_ids: ["v1"] },
      { id: "p1", name: "Air Filter", part_number: "SL-AIR-FILTER-001", description: "d", brand: "b", category: "c", part_number_search: "sl" },
    );
    assert.deepEqual(out.vehicle_ids, ["v1"]);
    assert.equal(out.name, "Air Filter");
    assert.equal(out.part_number, "SL-AIR-FILTER-001");
  });

  it("publishes an emptied vehicle set rather than dropping the document", () => {
    const out = completeTypesenseDocument(
      { id: "p1", vehicle_ids: [] },
      { id: "p1", name: "Air Filter", part_number: "P1" },
    );
    assert.deepEqual(out.vehicle_ids, [], "an emptied part must still be published");
    assert.equal(out.name, "Air Filter");
  });

  it("drops fields the collection does not declare and fills any that are absent", () => {
    const out = completeTypesenseDocument(
      { id: "p1", vehicle_ids: [] },
      { id: "p1", name: "n", part_number: "p", stray_field: "should not survive" },
    );
    assert.equal("stray_field" in out, false, "unknown fields are rejected by Typesense");
    assert.equal(out.description, "");
    assert.equal(out.brand, "");
    assert.equal(out.category, "");
  });

  it("still produces a valid document when nothing is stored", () => {
    const out = completeTypesenseDocument({ id: "p1", vehicle_ids: [] }, null);
    assert.equal(out.id, "p1");
    assert.equal(out.name, "");
    assert.equal(out.part_number, "");
  });
});
