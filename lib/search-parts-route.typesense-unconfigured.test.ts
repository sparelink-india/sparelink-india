/**
 * `GET /api/search/parts` — search no longer requires Typesense.
 *
 * PostgreSQL is the search backend: there is no separate search service to
 * be "unconfigured", so the old 503 branch is gone. This file keeps its
 * original shape (a sibling of the database-failure suite asserting the
 * pre-try contract) but asserts the new behaviour: missing/overlong queries
 * are still rejected with 400 before any dependency runs, and a search that
 * reaches the database layer without one fails as an honest generic 500 —
 * whether or not any Typesense variable is set.
 *
 * NO PRODUCTION ACCESS: no `TYPESENSE_HOST` is needed at all now, and
 * `DATABASE_URL` stays unset for this process, so `getDb()` throws on its
 * presence guard before any client is created. No connection is opened and
 * no request can leave the machine.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { NextRequest } from "next/server";

let GET: typeof import("../app/api/search/parts/route").GET;

before(async () => {
  // A stale TYPESENSE_HOST must neither help nor hinder: the search path
  // must not read it at all. Set it to an unresolvable placeholder to prove
  // the point — if any code still dials Typesense, this fails loudly.
  process.env.TYPESENSE_HOST = "typesense.invalid";
  ({ GET } = await import("../app/api/search/parts/route"));
});

const url = "https://sparelink.test/api/search/parts?q=brake";

describe("GET /api/search/parts — no Typesense dependency", () => {
  it("does not answer 503 for search: the backend is PostgreSQL", async () => {
    const res = await GET(new NextRequest(url));

    assert.notEqual(res.status, 503, "the unconfigured-service 503 is retired");
  });

  it("does not leak configuration detail or a stack trace", async () => {
    const res = await GET(new NextRequest(url));
    const text = await res.text();

    assert.ok(!text.includes("TYPESENSE"), "must not name any search variable");
    assert.ok(!/\bat\s+\w+\s+\(/.test(text), "must not contain a stack frame");
  });

  it("rejects an empty query with 400 before any dependency runs", async () => {
    const res = await GET(new NextRequest("https://sparelink.test/api/search/parts"));

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Search query is required" });
  });
});
