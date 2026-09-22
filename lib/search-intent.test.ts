import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterAutocompleteHits,
  parseSearchIntent,
  scoreSearchDocument,
} from "./search-intent";

const rh = {
  name: "WINDOW REGULATOR ASSY POWER WITH MOTOR TATA ALTROZ REAR RH",
  brand: "CI AUTOMOTIVE LLP",
  category: "Body Parts",
  part_number: "1333,9805R",
  description: "",
};

const lh = {
  name: "WINDOW REGULATOR ASSY POWER WITH MOTOR TATA ALTROZ REAR LH",
  brand: "CI AUTOMOTIVE LLP",
  category: "Body Parts",
  part_number: "1333,9805L",
  description: "",
};

const mirror = {
  name: "SUB MIRROR TATA ALTROZ RH",
  brand: "CI AUTOMOTIVE LLP",
  category: "Body Parts",
  part_number: "9999",
  description: "",
};

const filter = {
  name: "AIR FILTER TATA ALTROZ",
  brand: "CI AUTOMOTIVE LLP",
  category: "Filters",
  part_number: "8888",
  description: "",
};

describe("search intent", () => {
  it("expands WR and ASSY without inventing a part number", () => {
    const intent = parseSearchIntent("TATA ALTROZ WR ASSY");
    assert.equal(intent.typesenseQuery, "tata altroz window regulator assy");
    assert.equal(intent.hasProductIntent, true);
    assert.equal(intent.isPartNumberQuery, false);
  });

  it("keeps exact part-number queries untouched", () => {
    assert.equal(parseSearchIntent("101").isPartNumberQuery, true);
    assert.equal(parseSearchIntent("103").typesenseQuery, "103");
    assert.equal(parseSearchIntent("5240L,M5").isPartNumberQuery, true);
  });

  it("ranks window regulator assy above generic Altroz parts", () => {
    const intent = parseSearchIntent("TATA ALTROZ WR ASSY");
    assert.ok(scoreSearchDocument(intent, rh).score > scoreSearchDocument(intent, mirror).score);
    assert.equal(scoreSearchDocument(intent, rh).strict, true);
    assert.equal(scoreSearchDocument(intent, mirror).strict, false);
  });

  it("autocomplete returns only strict WR ASSY matches when they exist", () => {
    const intent = parseSearchIntent("TATA ALTROZ WR ASSY");
    const hits = filterAutocompleteHits(intent, [mirror, filter, rh, lh], (doc) => doc);
    assert.deepEqual(
      hits.map((hit) => hit.name),
      [rh.name, lh.name],
    );
  });

  it("allows broader Altroz suggestions without product intent", () => {
    const intent = parseSearchIntent("TATA ALTROZ");
    const hits = filterAutocompleteHits(intent, [mirror, filter, rh], (doc) => doc);
    assert.equal(hits.length, 3);
  });
});
