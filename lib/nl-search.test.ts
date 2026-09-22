import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  looksLikeNaturalLanguageQuery,
  parseNaturalLanguageIntent,
} from "./nl-search";
import {
  filterAutocompleteHits,
  parseSearchIntent,
  scoreSearchDocument,
} from "./search-intent";

describe("natural language search", () => {
  it("parses Hinglish Bolero left door handle without inventing a part", () => {
    const nl = parseNaturalLanguageIntent("Bolero ka left door handle");
    assert.equal(nl.side, "left");
    assert.ok(nl.vehicleHints.includes("bolero"));
    assert.ok(nl.productHints.some((h) => h.includes("door handle")));
    assert.match(nl.normalizedQuery, /bolero/);
    assert.match(nl.normalizedQuery, /left/);
    assert.match(nl.normalizedQuery, /door/);
    assert.match(nl.normalizedQuery, /handle/);
    assert.equal(nl.fillerRemoved, true);
  });

  it("maps pani pump to water pump", () => {
    const nl = parseNaturalLanguageIntent("Bolero ka pani pump");
    assert.ok(nl.productHints.includes("water pump"));
    assert.match(nl.normalizedQuery, /water pump/);
  });

  it("extracts Pensol viscosity and brand from Hinglish oil query", () => {
    const nl = parseNaturalLanguageIntent("mujhe 20w40 Pensol oil chahiye");
    assert.ok(nl.brandHints.includes("pensol"));
    assert.ok(nl.viscosityHints.some((v) => /20W40/i.test(v)));
    assert.ok(nl.productHints.some((h) => h.includes("oil")) || nl.normalizedQuery.includes("oil"));
  });

  it("does not treat bare part numbers as natural language", () => {
    assert.equal(looksLikeNaturalLanguageQuery("856"), false);
    assert.equal(looksLikeNaturalLanguageQuery("M-856"), false);
    assert.equal(looksLikeNaturalLanguageQuery("101"), false);
    assert.equal(parseSearchIntent("856").isPartNumberQuery, true);
    assert.equal(parseSearchIntent("856").naturalLanguage, null);
  });

  it("builds search intent for Swift window regulator", () => {
    const intent = parseSearchIntent("Swift ka window regulator");
    assert.equal(intent.isPartNumberQuery, false);
    assert.ok(intent.naturalLanguage);
    assert.ok(intent.typesenseQuery.includes("swift"));
    assert.ok(intent.typesenseQuery.includes("window") || intent.hasProductIntent);
  });

  it("ranks left door handle above unrelated Bolero parts", () => {
    const intent = parseSearchIntent("Bolero ka left door handle");
    const leftHandle = {
      name: "DOOR HANDLE OUTER LEFT BOLERO",
      brand: "CI AUTOMOTIVE LLP",
      category: "Body Parts",
      part_number: "DH-L-1",
      description: "",
    };
    const oilFilter = {
      name: "OIL FILTER BOLERO",
      brand: "MEKO",
      category: "Filters",
      part_number: "OF-1",
      description: "",
    };
    assert.ok(
      scoreSearchDocument(intent, leftHandle).score >
        scoreSearchDocument(intent, oilFilter).score,
    );
    const hits = filterAutocompleteHits(intent, [oilFilter, leftHandle], (d) => d);
    assert.equal(hits[0]?.part_number, "DH-L-1");
  });

  it("never invents product identity from ambiguous language", () => {
    const intent = parseSearchIntent("something unknown xyzzy");
    assert.equal(intent.isPartNumberQuery, false);
    // Ambiguous query still only ranks real candidate docs — empty catalogue stays empty.
    const hits = filterAutocompleteHits(intent, [], (d) => d);
    assert.deepEqual(hits, []);
  });

  it("brand query Pensol 20w40 prefers Pensol viscosity matches", () => {
    const intent = parseSearchIntent("Pensol 20w40");
    const pensol = {
      name: "PENSOL ENGINE OIL 20W40",
      brand: "PENSOL",
      category: "Lubricants",
      part_number: "P-20W40",
      description: "",
    };
    const other = {
      name: "GENERIC GREASE",
      brand: "OTHER",
      category: "Lubricants",
      part_number: "G-1",
      description: "",
    };
    assert.ok(scoreSearchDocument(intent, pensol).score > scoreSearchDocument(intent, other).score);
  });
});
