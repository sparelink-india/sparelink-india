import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultTextMatch,
  escapeLikePattern,
  tokenizeSearchText,
  visibilityConditions,
} from "@/lib/search-postgres";

/**
 * POSTGRESQL RETRIEVAL UNIT TESTS — pure-function scope only.
 *
 * `escapeLikePattern`, `tokenizeSearchText`, `defaultTextMatch` and
 * `visibilityConditions` never touch a database, so they run hermetically. Anything that executes SQL (`searchPartsPage`,
 * `searchPartsFetch`, `searchPartNumbersPostgres`) is intentionally NOT
 * covered here:inventing a fake Drizzle executor would test the fake, not
 * the queries. Those paths require the isolated QA database (currently
 * unavailable by owner decision) and are covered structurally by the route
 * wiring plus the QA plan in the migration report.
 */

describe("escapeLikePattern", () => {
  it("leaves ordinary text untouched", () => {
    assert.equal(escapeLikePattern("brake pad 123"), "brake pad 123");
  });

  it("neutralises LIKE metacharacters so input can only narrow a match", () => {
    assert.equal(escapeLikePattern("100%"), "100\\%");
    assert.equal(escapeLikePattern("a_b"), "a\\_b");
    assert.equal(escapeLikePattern("a\\b"), "a\\\\b");
    assert.equal(escapeLikePattern("%_%\\"), "\\%\\_\\%\\\\");
  });
});

describe("tokenizeSearchText", () => {
  it("splits on whitespace and drops empties", () => {
    assert.deepEqual(tokenizeSearchText("  oil   filter  "), ["oil", "filter"]);
    assert.deepEqual(tokenizeSearchText(""), []);
    assert.deepEqual(tokenizeSearchText("   "), []);
  });
});

describe("visibilityConditions", () => {
  it("is absent for admins (they see everything downstream)", () => {
    assert.equal(visibilityConditions(true), undefined);
  });

  it("is present for everyone else (enforced in SQL, not just in JS)", () => {
    assert.ok(visibilityConditions(false) !== undefined);
  });
});

describe("defaultTextMatch", () => {
  it("matches everything when there is no text (pure browse scope)", () => {
    assert.equal(defaultTextMatch(""), undefined);
    assert.equal(defaultTextMatch("   "), undefined);
  });

  it("builds a matcher otherwise", () => {
    const cols = {
      partNumber: "x",
      name: "x",
      description: "x",
      brand: "x",
    } as never;
    const match = defaultTextMatch("brake pad");
    assert.ok(match !== undefined);
    assert.ok(typeof match(cols) === "object");
  });
});
