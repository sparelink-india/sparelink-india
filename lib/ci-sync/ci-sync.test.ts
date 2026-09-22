import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeSyncDiff, resolvePreservedImageUrl, resolveSparelinkPriceAfterSync } from "./diff";
import { hashSourceProduct, mapCiApiProduct, sourceIdentityKey } from "./normalize";
import { createMemorySyncStore, fixtureFetcher, runCiSync } from "./run";
import {
  APPROVAL_STATUS,
  CI_SOURCE_KEY,
  SOURCE_STATUS,
  isCustomerVisibleProduct,
  omitSourceCommercialFields,
  type CiSourceProduct,
  type ExistingSourceRecord,
} from "./types";

function product(partial: Partial<CiSourceProduct> & Pick<CiSourceProduct, "sku" | "name">): CiSourceProduct {
  return {
    sourceId: partial.sourceId ?? `id-${partial.sku}`,
    sku: partial.sku,
    name: partial.name,
    manufacturer: partial.manufacturer ?? "CI AUTOMOTIVE LLP",
    brand: partial.brand ?? "CI AUTOMOTIVE LLP",
    sourcePricePaise: partial.sourcePricePaise ?? 48800,
    imageUrl: partial.imageUrl ?? "https://example.com/a.jpg",
    sourceUrl: partial.sourceUrl ?? "https://onlineautohandles.com/p/a",
    oeCode: partial.oeCode ?? null,
    statusSource: partial.statusSource ?? "Live",
    categoryName: partial.categoryName ?? "Body Parts",
  };
}

function existing(
  partial: Partial<ExistingSourceRecord> & Pick<ExistingSourceRecord, "sourceSku">,
): ExistingSourceRecord {
  return {
    id: partial.id ?? `row-${partial.sourceSku}`,
    sourceKey: CI_SOURCE_KEY,
    sourceSku: partial.sourceSku,
    sourceId: partial.sourceId ?? `id-${partial.sourceSku}`,
    name: partial.name ?? "Existing",
    manufacturer: partial.manufacturer ?? "CI AUTOMOTIVE LLP",
    brand: partial.brand ?? "CI AUTOMOTIVE LLP",
    sourcePricePaise: partial.sourcePricePaise ?? 48800,
    sourceImageUrl: partial.sourceImageUrl ?? "https://example.com/a.jpg",
    sourceUrl: partial.sourceUrl ?? null,
    oeCode: partial.oeCode ?? null,
    sourceHash: partial.sourceHash ?? hashSourceProduct(product({ sku: partial.sourceSku, name: partial.name ?? "Existing" })),
    sourceStatus: partial.sourceStatus ?? SOURCE_STATUS.LIVE,
    approvalStatus: partial.approvalStatus ?? APPROVAL_STATUS.APPROVED,
    partId: partial.partId ?? `part-${partial.sourceSku}`,
    sparelinkPricePaise: partial.sparelinkPricePaise ?? 52800,
    lastSeenAt: partial.lastSeenAt ?? new Date().toISOString(),
  };
}

describe("ci sync identity", () => {
  it("does not collapse M-663 and M663", () => {
    assert.notEqual(
      sourceIdentityKey(CI_SOURCE_KEY, "ci", "M-663"),
      sourceIdentityKey(CI_SOURCE_KEY, "ci", "M663"),
    );
  });

  it("does not collapse left/right SKUs", () => {
    assert.notEqual(
      sourceIdentityKey(CI_SOURCE_KEY, "ci", "00110L"),
      sourceIdentityKey(CI_SOURCE_KEY, "ci", "00110R"),
    );
  });
});

describe("ci sync workflows", () => {
  it("imports new CI product as pending approval with no SpareLink price", async () => {
    const store = createMemorySyncStore([]);
    const incoming = product({ sku: "NEW-1", name: "NEW HANDLE", sourcePricePaise: 48800 });
    const result = await runCiSync({
      fetcher: fixtureFetcher([incoming]),
      store,
    });
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.newCount, 1);
    assert.equal(result.approvalPendingCount, 1);
    assert.equal(store.records[0]?.approvalStatus, APPROVAL_STATUS.PENDING_ADMIN_APPROVAL);
    assert.equal(store.records[0]?.sparelinkPricePaise, null);
    assert.equal(store.records[0]?.sourcePricePaise, 48800);
    assert.equal(isCustomerVisibleProduct({ isPublished: false, approvalStatus: store.records[0]!.approvalStatus }), false);
  });

  it("updates source price without overwriting SpareLink selling price", async () => {
    const prior = product({ sku: "P-1", name: "HANDLE", sourcePricePaise: 48800 });
    const seed = existing({
      sourceSku: "P-1",
      name: "HANDLE",
      sourcePricePaise: 48800,
      sparelinkPricePaise: 52800,
      sourceHash: hashSourceProduct(prior),
    });
    const store = createMemorySyncStore([seed]);
    const incoming = product({ sku: "P-1", name: "HANDLE", sourcePricePaise: 50000 });
    const result = await runCiSync({
      fetcher: fixtureFetcher([incoming]),
      store,
    });
    assert.equal(result.updatedCount, 1);
    assert.equal(store.records[0]?.sourcePricePaise, 50000);
    assert.equal(store.records[0]?.sparelinkPricePaise, 52800);
    assert.equal(resolveSparelinkPriceAfterSync(52800), 52800);
  });

  it("marks source removed without deleting SpareLink commercial data", async () => {
    const prior = product({ sku: "GONE-1", name: "OLD" });
    const seed = existing({
      sourceSku: "GONE-1",
      name: "OLD",
      sparelinkPricePaise: 60000,
      sourceHash: hashSourceProduct(prior),
    });
    const store = createMemorySyncStore([seed]);
    const result = await runCiSync({
      fetcher: fixtureFetcher([]),
      store,
    });
    assert.equal(result.sourceRemovedCount, 1);
    assert.equal(store.records[0]?.sourceStatus, SOURCE_STATUS.SOURCE_REMOVED);
    assert.equal(store.records[0]?.sparelinkPricePaise, 60000);
    assert.equal(store.records[0]?.partId, "part-GONE-1");
  });

  it("re-run is idempotent — no duplicate creates", async () => {
    const incoming = product({ sku: "IDEM-1", name: "Same" });
    const store = createMemorySyncStore([]);
    await runCiSync({ fetcher: fixtureFetcher([incoming]), store });
    const second = await runCiSync({ fetcher: fixtureFetcher([incoming]), store });
    assert.equal(second.newCount, 0);
    assert.equal(second.unchangedCount, 1);
    assert.equal(store.records.length, 1);
  });

  it("failed / incomplete fetch does not mark products removed", async () => {
    const prior = product({ sku: "SAFE-1", name: "Keep" });
    const seed = existing({
      sourceSku: "SAFE-1",
      sourceHash: hashSourceProduct(prior),
    });
    const store = createMemorySyncStore([seed]);
    const result = await runCiSync({
      fetcher: fixtureFetcher([], { fetchComplete: false, errorSummary: "network down" }),
      store,
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.sourceRemovedCount, 0);
    assert.equal(store.records[0]?.sourceStatus, SOURCE_STATUS.LIVE);
  });

  it("preserves existing image when incoming image fails / missing", () => {
    assert.equal(
      resolvePreservedImageUrl("https://cdn/good.jpg", null, true),
      "https://cdn/good.jpg",
    );
    assert.equal(
      resolvePreservedImageUrl("https://cdn/good.jpg", "", false),
      "https://cdn/good.jpg",
    );
  });

  it("omits source price from customer payloads", () => {
    const cleaned = omitSourceCommercialFields({
      name: "HANDLE",
      pricePaise: 52800,
      sourcePricePaise: 48800,
      sourcePrice: 488,
    });
    assert.equal("sourcePricePaise" in cleaned, false);
    assert.equal("sourcePrice" in cleaned, false);
    assert.equal(cleaned.pricePaise, 52800);
  });

  it("dry-run does not mutate store", async () => {
    const store = createMemorySyncStore([]);
    const result = await runCiSync({
      dryRun: true,
      fetcher: fixtureFetcher([product({ sku: "DRY-1", name: "Dry" })]),
      store,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.newCount, 1);
    assert.equal(store.records.length, 0);
    assert.equal(store.mutations.length, 0);
  });

  it("maps raw CI API items without inventing missing fields", () => {
    const mapped = mapCiApiProduct({ sku: "X1", name: "Part X" });
    assert.ok(mapped);
    assert.equal(mapped.sourcePricePaise, null);
    assert.equal(mapped.oeCode, null);
    assert.equal(mapCiApiProduct({ name: "No SKU" }), null);
  });

  it("name similarity alone does not merge distinct SKUs", () => {
    const diffs = computeSyncDiff(
      [product({ sku: "A-1", name: "DOOR HANDLE LEFT" })],
      [existing({ sourceSku: "B-2", name: "DOOR HANDLE LEFT" })],
      { fetchComplete: true },
    );
    assert.equal(diffs.create.length, 1);
    assert.equal(diffs.remove.length, 1);
    assert.equal(diffs.update.length, 0);
  });
});
