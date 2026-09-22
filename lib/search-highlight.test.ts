import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitHighlight } from "./search-highlight";

describe("search highlight", () => {
  it("marks the query without changing stored text", () => {
    const parts = splitHighlight("WATER SEPARATOR BHARAT BENZ", "WATER");
    assert.equal(parts.map((part) => part.text).join(""), "WATER SEPARATOR BHARAT BENZ");
    assert.equal(parts.filter((part) => part.match).map((part) => part.text).join(""), "WATER");
  });

  it("does not invent a match for short or empty queries", () => {
    assert.deepEqual(splitHighlight("M-856", "8"), [{ text: "M-856", match: false }]);
    assert.deepEqual(splitHighlight("M-856", ""), [{ text: "M-856", match: false }]);
  });
});
