import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterAutocompleteHits,
  isPartNumberRelevant,
  parseExactHsnQuery,
  parseSearchIntent,
  scorePartNumberMatch,
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

  it("recognizes exact HSN forms without treating malformed values as HSN", () => {
    assert.equal(parseExactHsnQuery("87083000"), "87083000");
    assert.equal(parseExactHsnQuery("HSN 84212300"), "84212300");
    assert.equal(parseExactHsnQuery("HSN: 8421 2300"), null);
    assert.equal(parseExactHsnQuery("842123"), null);
    assert.equal(parseExactHsnQuery("HSN 8421230"), null);
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

  it("matches hyphenated, prefix, and digit-infix part numbers without description hits", () => {
    const hits = [
      { part_number: "856", name: "EXACT", brand: "CI", description: "" },
      { part_number: "M-856", name: "HYPHEN", brand: "CI", description: "" },
      { part_number: "1856", name: "INFIX", brand: "CI", description: "" },
      { part_number: "M-1856", name: "PREFIX INFIX", brand: "CI", description: "" },
      { part_number: "9999", name: "Contains 856 in description", brand: "CI", description: "OEM 856 adapter" },
    ];
    const ranked = filterAutocompleteHits(parseSearchIntent("856"), hits, (doc) => doc, 12);
    assert.deepEqual(
      ranked.map((hit) => hit.part_number),
      ["856", "M-856", "1856", "M-1856"],
    );
    assert.ok(scorePartNumberMatch("856", "856") > scorePartNumberMatch("856", "1856"));
    assert.equal(isPartNumberRelevant("M-856", "856"), true);
    assert.equal(isPartNumberRelevant("M-856", "1856"), false);
    assert.equal(isPartNumberRelevant("1856", "M-1856"), true);
  });

  it("preserves exact regressions for known catalogue part numbers", () => {
    for (const q of ["856", "M-856", "1856", "M-865", "M-854", "101", "103", "113"]) {
      const intent = parseSearchIntent(q);
      assert.equal(intent.isPartNumberQuery, true, q);
      assert.equal(intent.typesenseQuery, q);
      assert.equal(intent.naturalLanguage, null);
    }
  });

  it("keeps brand-style queries non-inventive", () => {
    const pensol = parseSearchIntent("Pensol");
    assert.equal(pensol.isPartNumberQuery, false);
    assert.ok(pensol.typesenseQuery.toLowerCase().includes("pensol"));
  });
});
