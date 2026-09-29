import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  HERO_COLLECTION_SLOTS,
  HERO_SLOT_META,
  HERO_BULK_CONFIRM_THRESHOLD,
  HERO_MAX_EXPLICIT_PART_IDS,
  heroCollectionHref,
  HERO_COLLECTION_FALLBACK,
  isHeroCollectionSlot,
  isWellFormedHeroPartId,
  summariseHeroSlots,
  validateHeroMutationRequest,
  type HeroCollectionSlot,
} from "./hero-collections";
import {
  describeHeroResult,
  emptyHeroResult,
  performHeroCollectionMutation,
  type HeroCollectionDeps,
} from "./hero-collection-service";

const SLOT = "earthmover" as HeroCollectionSlot;

describe("the eight approved hero slots", () => {
  it("has eight, with Passenger Vehicle split into two", () => {
    assert.equal(HERO_COLLECTION_SLOTS.length, 8);
    assert.equal(new Set(HERO_COLLECTION_SLOTS).size, 8, "slots must be distinct");
    assert.ok(HERO_COLLECTION_SLOTS.includes("passenger-red-suv"));
    assert.ok(HERO_COLLECTION_SLOTS.includes("passenger-white-saloon"));
  });

  it("describes every slot", () => {
    assert.equal(HERO_SLOT_META.length, HERO_COLLECTION_SLOTS.length);
    for (const meta of HERO_SLOT_META) {
      assert.ok(meta.label.length > 0, `${meta.slot} needs a label`);
      assert.ok(meta.note.length > 0, `${meta.slot} needs a note`);
    }
  });

  it("rejects a slot that is not one of the eight", () => {
    assert.equal(isHeroCollectionSlot("earthmover"), true);
    for (const bad of ["", "universal", "EARTHMOVER", "passenger-vehicle", null, 42]) {
      assert.equal(isHeroCollectionSlot(bad), false, `${String(bad)} must not be a slot`);
    }
  });
});

describe("storefront routing", () => {
  const counts = new Map<HeroCollectionSlot, number>([[SLOT, 3]]);
  const enabled = new Set<HeroCollectionSlot>([SLOT]);

  it("routes an enabled, non-empty slot to its curated page", () => {
    assert.equal(heroCollectionHref(SLOT, counts, enabled), `/hero/${SLOT}`);
  });

  it("falls back to fitment for an empty, disabled or unknown slot", () => {
    const empty = new Map<HeroCollectionSlot, number>([[SLOT, 0]]);
    assert.equal(heroCollectionHref(SLOT, empty, enabled), HERO_COLLECTION_FALLBACK);
    assert.equal(heroCollectionHref(SLOT, counts, new Set()), HERO_COLLECTION_FALLBACK);
    assert.equal(heroCollectionHref("not-a-slot", counts, enabled), HERO_COLLECTION_FALLBACK);
  });
});

describe("request validation", () => {
  it("rejects an unknown slot before anything else", () => {
    const r = validateHeroMutationRequest({ action: "add", slot: "nope", partIds: ["a"] }, "add");
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.status, 404);
  });

  it("rejects an empty selection", () => {
    const r = validateHeroMutationRequest({ action: "add", slot: SLOT, partIds: [] }, "add");
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.status, 400);
  });

  it("rejects a duplicated id rather than silently de-duplicating", () => {
    const r = validateHeroMutationRequest(
      { action: "add", slot: SLOT, partIds: ["p1", "p1"] },
      "add",
    );
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /more than once/);
  });

  it("rejects a malformed id", () => {
    for (const bad of ["", "  ", "a/b", "a?b", "a b", "x".repeat(200)]) {
      assert.equal(isWellFormedHeroPartId(bad), false, `${bad} must be rejected`);
    }
    assert.equal(isWellFormedHeroPartId("part-air-filter-001"), true);
  });

  it("caps an explicit list", () => {
    const ids = Array.from({ length: HERO_MAX_EXPLICIT_PART_IDS + 1 }, (_, i) => `p${i}`);
    const r = validateHeroMutationRequest({ action: "add", slot: SLOT, partIds: ids }, "add");
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /limit/);
  });

  it("requires an acknowledged count for a bulk filtered change", () => {
    const bulk = HERO_BULK_CONFIRM_THRESHOLD;
    const unconfirmed = validateHeroMutationRequest(
      { action: "add", slot: SLOT, scope: "filtered", expectedCount: 184 },
      "add",
    );
    assert.equal(unconfirmed.ok, false, "a bulk change must be acknowledged");
    assert.match(unconfirmed.ok === false ? unconfirmed.error : "", /bulk operation/);

    const confirmed = validateHeroMutationRequest(
      { action: "add", slot: SLOT, scope: "filtered", expectedCount: 184, confirmCount: 184 },
      "add",
    );
    assert.equal(confirmed.ok, true);

    const stale = validateHeroMutationRequest(
      { action: "add", slot: SLOT, scope: "filtered", expectedCount: 184, confirmCount: 10 },
      "add",
    );
    assert.equal(stale.ok, false, "a stale confirmation must not pass");

    assert.equal(
      validateHeroMutationRequest(
        { action: "add", slot: SLOT, scope: "filtered", expectedCount: bulk - 1 },
        "add",
      ).ok,
      true,
      "a small correction is not bulk",
    );
  });
});

/* ------------------------------------------------------------------ fakes */

function fakeDeps(seed: { existing?: string[] } = {}): {
  calls: { inserted: string[][]; deleted: string[][]; audit: number; ensureSlot: number };
  deps: HeroCollectionDeps;
} {
  const calls = { inserted: [] as string[][], deleted: [] as string[][], audit: 0, ensureSlot: 0 };
  const existing = new Set<string>(seed.existing ?? []);
  const deps: HeroCollectionDeps = {
    async resolveExistingPartIds(ids) {
      return new Set(ids);
    },
    async findCollectedPartIds(_slot, ids) {
      return new Set(ids.filter((id) => existing.has(id)));
    },
    async resolveFilteredPartIds(filters) {
      return filters.q ? [`match-${filters.q}`, "match-2"] : ["match-1", "match-2"];
    },
    async ensureSlot() {
      calls.ensureSlot += 1;
    },
    async insertItems(_slot, ids) {
      calls.inserted.push(ids);
      for (const id of ids) existing.add(id);
    },
    async deleteItems(_slot, ids) {
      calls.deleted.push(ids);
      for (const id of ids) existing.delete(id);
    },
    async listSlotCounts() {
      return new Map([[SLOT, { isEnabled: true, count: existing.size }]]);
    },
    async listItemPartIds() {
      return [...existing];
    },
    async setSlotEnabled() {},
    async audit() {
      calls.audit += 1;
    },
  };
  return { calls, deps };
}

describe("the mutation service", () => {
  it("adds, reports true counts, and audits after the write", async () => {
    const { calls, deps } = fakeDeps();
    const outcome = await performHeroCollectionMutation(
      "add",
      { action: "add", slot: SLOT, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
      "Earthmover",
    );
    assert.equal(outcome.ok, true);
    assert.equal(outcome.ok && outcome.result.changed, 2);
    assert.equal(outcome.ok && outcome.result.alreadyInState, 0);
    assert.equal(calls.inserted.length, 1, "one insert call");
    assert.equal(calls.audit, 1, "the change is audited");
  });

  it("reports an already-present product instead of failing the batch", async () => {
    const { calls, deps } = fakeDeps({ existing: ["p1"] });
    const outcome = await performHeroCollectionMutation(
      "add",
      { action: "add", slot: SLOT, partIds: ["p1", "p2"] },
      "admin-1",
      deps,
      "Earthmover",
    );
    assert.equal(outcome.ok && outcome.result.changed, 1);
    assert.equal(outcome.ok && outcome.result.alreadyInState, 1);
    assert.equal(calls.inserted[0].length, 1, "only the genuinely new part is written");
  });

  it("refuses a product that does not exist rather than writing a dangling row", async () => {
    const { calls, deps } = fakeDeps();
    deps.resolveExistingPartIds = async () => new Set(["p1"]);
    const outcome = await performHeroCollectionMutation(
      "add",
      { action: "add", slot: SLOT, partIds: ["p1", "ghost"] },
      "admin-1",
      deps,
      "Earthmover",
    );
    assert.equal(outcome.ok, false);
    assert.equal(outcome.ok === false && outcome.status, 404);
    assert.equal(calls.inserted.length, 0, "nothing is written when one id is unknown");
    assert.equal(calls.audit, 0, "a rejected change is not audited as applied");
  });

  it("removes only the selected products, scoped to the slot", async () => {
    const { calls, deps } = fakeDeps({ existing: ["p1", "p2", "p3"] });
    const outcome = await performHeroCollectionMutation(
      "remove",
      { action: "remove", slot: SLOT, partIds: ["p2"] },
      "admin-1",
      deps,
      "Earthmover",
    );
    assert.equal(outcome.ok && outcome.result.changed, 1);
    assert.equal(calls.deleted[0].length, 1);
    assert.deepEqual(calls.deleted[0], ["p2"], "only the selected part is deleted");
  });

  it("re-confirms when the filtered set changed since the admin read it", async () => {
    const { deps } = fakeDeps();
    const outcome = await performHeroCollectionMutation(
      "add",
      { action: "add", slot: SLOT, scope: "filtered", expectedCount: 5, filters: { q: "x" } },
      "admin-1",
      deps,
      "Earthmover",
    );
    assert.equal(outcome.ok, false);
    assert.equal(outcome.ok === false && outcome.status, 409);
  });

  it("does not audit when nothing actually changed", async () => {
    const { calls, deps } = fakeDeps({ existing: ["p1"] });
    const outcome = await performHeroCollectionMutation(
      "add",
      { action: "add", slot: SLOT, partIds: ["p1"] },
      "admin-1",
      deps,
      "Earthmover",
    );
    assert.equal(outcome.ok && outcome.result.changed, 0);
    assert.equal(calls.audit, 0, "a no-op is not recorded as a change");
  });

  it("describes a no-op honestly", () => {
    const r = emptyHeroResult("add", SLOT);
    assert.match(describeHeroResult(r), /Added 0/);
  });
});

describe("slot inventory", () => {
  it("summarises all eight slots, reporting absent rows as zero", () => {
    const rows = summariseHeroSlots([{ slot: SLOT, isEnabled: true, count: 4 }]);
    assert.equal(rows.length, 8);
    const earth = rows.find((r) => r.slot === SLOT);
    assert.equal(earth?.count, 4);
    assert.equal(earth?.enabled, true);
    assert.equal(rows.filter((r) => r.count === 0).length, 7);
  });
});

describe("these tables are separate from vehicle compatibility", () => {
  const src = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

  it("never writes to part_vehicle_compatibility", () => {
    for (const f of [
      "lib/hero-collections.ts",
      "lib/hero-collection-service.ts",
      "lib/hero-collection-repository.ts",
      "app/api/admin/hero-collections/route.ts",
      "app/api/admin/hero-collections/[slot]/route.ts",
    ]) {
      const s = src(f);
      const inserts = s.match(/insert\(partVehicleCompatibility\)|insertInto.*part_vehicle/g);
      assert.equal(inserts, null, `${f} must not write compatibility rows`);
    }
  });

  it("never even reads the compatibility table", () => {
    for (const f of ["lib/hero-collection-service.ts", "app/hero/[slot]/route.ts"]) {
      assert.equal(
        /partVehicleCompatibility/.test(src(f)),
        false,
        `${f} must not read compatibility; a curated set is not a fitment claim`,
      );
    }
  });

  it("authenticates before touching a dependency", () => {
    for (const f of [
      "app/api/admin/hero-collections/route.ts",
      "app/api/admin/hero-collections/[slot]/route.ts",
    ]) {
      const s = src(f);
      const guard = s.indexOf("requireAdminApi()");
      const deps = s.indexOf("createHeroCollectionDeps()");
      assert.ok(guard >= 0, `${f} must call requireAdminApi()`);
      if (deps >= 0) {
        const firstGuard = s.indexOf("const access = await requireAdminApi()");
        assert.ok(firstGuard >= 0 && firstGuard < deps, `${f}: auth must precede dependency work`);
      }
    }
  });
});
