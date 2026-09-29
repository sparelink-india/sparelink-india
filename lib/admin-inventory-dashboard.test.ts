import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LOW_STOCK_THRESHOLD } from "./admin-dashboard";
import {
  INVENTORY_ABSENT,
  INVENTORY_FILTERS,
  INVENTORY_SORTS,
  describeAdjustment,
  filterInventory,
  hasActiveInventoryFilters,
  inventoryDealer,
  inventoryEmptyMessage,
  inventoryErrorMessage,
  inventoryPart,
  matchesInventoryFilter,
  matchesInventoryQuery,
  sortInventory,
  stockBand,
  summariseInventory,
  validateAdjustmentQuantity,
  validateAdjustmentReason,
  type AdminInventoryRow,
} from "./admin-inventory-dashboard";

function row(overrides: Partial<AdminInventoryRow> = {}): AdminInventoryRow {
  return {
    id: "i1",
    dealerListingId: "dl1",
    partName: "Brake Pad Set",
    dealerName: "Ambaji Traders",
    quantity: 20,
    price: 45000,
    lastUpdated: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

const SAMPLE: AdminInventoryRow[] = [
  row({ id: "a", partName: "Oil Filter", dealerName: "Ambaji Traders", quantity: 0 }),
  row({ id: "b", partName: "Spark Plug", dealerName: "Hind Motors", quantity: LOW_STOCK_THRESHOLD }),
  row({ id: "c", partName: "Drive Belt", dealerName: "India Sales", quantity: 1 }),
  row({ id: "d", partName: "Air Filter", dealerName: "Ambaji Traders", quantity: 250 }),
];

describe("stock banding", () => {
  it("uses the shared low-stock threshold, never a local copy", () => {
    assert.equal(stockBand(LOW_STOCK_THRESHOLD).band, "low");
    assert.equal(stockBand(LOW_STOCK_THRESHOLD + 1).band, "healthy");
  });

  it("treats zero and negatives as out of stock", () => {
    assert.equal(stockBand(0).band, "out");
    assert.equal(stockBand(-4).band, "out");
  });

  it("treats a non-numeric quantity as out of stock rather than NaN-banded", () => {
    assert.equal(stockBand(Number.NaN).band, "out");
  });

  it("gives every band a distinct label and class", () => {
    const bands = [stockBand(0), stockBand(1), stockBand(100)];
    assert.equal(new Set(bands.map((b) => b.label)).size, 3);
    assert.equal(new Set(bands.map((b) => b.className)).size, 3);
  });

  it("states the threshold in the low-stock label", () => {
    assert.match(stockBand(1).label, new RegExp(String(LOW_STOCK_THRESHOLD)));
  });
});

describe("inventory field accessors", () => {
  it("never invents a part or dealer name", () => {
    assert.equal(inventoryPart(row()), "Brake Pad Set");
    assert.equal(inventoryDealer(row()), "Ambaji Traders");
    assert.equal(inventoryPart(row({ partName: "  " })), INVENTORY_ABSENT);
    assert.equal(inventoryDealer(row({ dealerName: "" })), INVENTORY_ABSENT);
  });
});

describe("inventory search and filter", () => {
  it("matches part, dealer and quantity", () => {
    // SAMPLE[0] is the Oil Filter at Ambaji Traders with 0 units.
    assert.equal(matchesInventoryQuery(SAMPLE[0], "oil"), true);
    assert.equal(matchesInventoryQuery(SAMPLE[0], "ambaji"), true);
    assert.equal(matchesInventoryQuery(SAMPLE[0], "0"), true);
    assert.equal(matchesInventoryQuery(SAMPLE[0], "hind"), false);
    // SAMPLE[1] belongs to Hind Motors; SAMPLE[3] holds 250 units.
    assert.equal(matchesInventoryQuery(SAMPLE[1], "hind"), true);
    assert.equal(matchesInventoryQuery(SAMPLE[3], "250"), true);
    assert.equal(matchesInventoryQuery(SAMPLE[0], "zzz"), false);
    assert.equal(matchesInventoryQuery(SAMPLE[0], ""), true);
  });

  it("filters by band using the shared threshold", () => {
    assert.equal(matchesInventoryFilter(SAMPLE[0], "out"), true);
    assert.equal(matchesInventoryFilter(SAMPLE[1], "low"), true);
    assert.equal(matchesInventoryFilter(SAMPLE[2], "low"), true);
    assert.equal(matchesInventoryFilter(SAMPLE[3], "healthy"), true);
    assert.equal(matchesInventoryFilter(SAMPLE[3], "all"), true);
  });

  it("exposes exactly the declared filters and sorts", () => {
    assert.deepEqual([...INVENTORY_FILTERS], ["all", "low", "out", "healthy"]);
    assert.deepEqual([...INVENTORY_SORTS], ["stock", "part", "updated", "dealer"]);
  });

  it("reports whether filters are narrowing the list", () => {
    assert.equal(hasActiveInventoryFilters({ query: "", filter: "all" }), false);
    assert.equal(hasActiveInventoryFilters({ query: "oil", filter: "all" }), true);
    assert.equal(hasActiveInventoryFilters({ query: "", filter: "low" }), true);
  });
});

describe("inventory sorting", () => {
  it("puts the emptiest stock first", () => {
    const rows = sortInventory(SAMPLE, "stock");
    assert.deepEqual(
      rows.map((r) => r.quantity),
      [0, 1, LOW_STOCK_THRESHOLD, 250],
    );
  });

  it("sorts by part, dealer and recency", () => {
    assert.deepEqual(
      sortInventory(SAMPLE, "part").map((r) => r.partName),
      ["Air Filter", "Drive Belt", "Oil Filter", "Spark Plug"],
    );
    assert.equal(typeof sortInventory(SAMPLE, "dealer")[0].dealerName, "string");
    assert.equal(sortInventory(SAMPLE, "updated").length, SAMPLE.length);
  });

  it("does not mutate its input", () => {
    const before = SAMPLE.map((r) => r.id);
    sortInventory(SAMPLE, "stock");
    assert.deepEqual(SAMPLE.map((r) => r.id), before);
  });

  it("combines filter, query and sort", () => {
    const rows = filterInventory(SAMPLE, { query: "", filter: "low", sort: "stock" });
    assert.deepEqual(rows.map((r) => r.id), ["c", "b"]);
  });
});

describe("inventory summary", () => {
  it("counts bands and units from the returned rows only", () => {
    const summary = summariseInventory(SAMPLE);
    assert.equal(summary.totalRows, 4);
    assert.equal(summary.out, 1);
    assert.equal(summary.low, 2);
    assert.equal(summary.healthy, 1);
    assert.equal(summary.totalUnits, 0 + 1 + LOW_STOCK_THRESHOLD + 250);
    assert.equal(summary.dealers, 3);
  });

  it("is all zeroes for no stock", () => {
    const summary = summariseInventory([]);
    assert.equal(summary.totalRows, 0);
    assert.equal(summary.totalUnits, 0);
    assert.equal(summary.dealers, 0);
  });

  it("treats a non-numeric quantity as zero units", () => {
    const summary = summariseInventory([row({ quantity: Number.NaN })]);
    assert.equal(summary.totalUnits, 0);
    assert.equal(summary.out, 1);
  });
});

describe("adjustment validation mirrors the server", () => {
  it("accepts zero and positive whole numbers", () => {
    assert.equal(validateAdjustmentQuantity("0"), null);
    assert.equal(validateAdjustmentQuantity("7"), null);
    assert.equal(validateAdjustmentQuantity(" 12 "), null);
  });

  it("rejects blank, fractional, negative and non-numeric input", () => {
    assert.ok(validateAdjustmentQuantity(""));
    assert.ok(validateAdjustmentQuantity("   "));
    assert.ok(validateAdjustmentQuantity("1.5"));
    assert.ok(validateAdjustmentQuantity("-2"));
    assert.ok(validateAdjustmentQuantity("abc"));
  });

  it("requires a reason", () => {
    assert.equal(validateAdjustmentReason("Stock count"), null);
    assert.ok(validateAdjustmentReason(""));
    assert.ok(validateAdjustmentReason("   "));
  });
});

describe("adjustment result copy", () => {
  it("describes an increase, a decrease and no change", () => {
    assert.match(describeAdjustment({ partName: "Oil Filter", quantity: 12, delta: 4 }), /increased by 4 to 12/);
    assert.match(describeAdjustment({ partName: "Oil Filter", quantity: 6, delta: -6 }), /decreased by 6 to 6/);
    assert.match(describeAdjustment({ partName: "Oil Filter", quantity: 8, delta: 0 }), /No net change/);
  });

  it("falls back to a neutral name rather than rendering a blank", () => {
    assert.match(describeAdjustment({ partName: "  ", quantity: 1, delta: 0 }), /Listing/);
  });
});

describe("inventory empty and error states", () => {
  it("distinguishes loading, filtered-empty and genuinely empty", () => {
    assert.match(
      inventoryEmptyMessage({ loading: true, hasData: true, filtered: true }).title,
      /Loading/i,
    );
    assert.match(
      inventoryEmptyMessage({ loading: false, hasData: true, filtered: true }).title,
      /match/i,
    );
    assert.match(
      inventoryEmptyMessage({ loading: false, hasData: true, filtered: false }).title,
      /No stock recorded/i,
    );
    assert.match(
      inventoryEmptyMessage({ loading: false, hasData: false, filtered: false }).title,
      /No inventory yet/i,
    );
  });

  it("always produces a non-empty error message", () => {
    assert.equal(inventoryErrorMessage(new Error("nope"), "fallback"), "nope");
    assert.equal(inventoryErrorMessage(new Error(""), "fallback"), "fallback");
    assert.equal(inventoryErrorMessage(undefined, "fallback"), "fallback");
  });
});
