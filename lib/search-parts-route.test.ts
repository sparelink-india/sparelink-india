import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextRequest } from "next/server";
import { Errors } from "typesense";

import {
  GET,
  searchFailureResponse,
} from "@/app/api/search/parts/route";

/**
 * ROUTE-LEVEL SEARCH CONTRACT TESTS (PostgreSQL backend).
 *
 * PostgreSQL is the search backend: there is no separate search service to
 * be "unconfigured", so the old 503 branch is gone. A missing database
 * surfaces from getDb() and is answered by the outer handler as an honest
 * 500 — exactly what these tests assert, with no environment surgery (the
 * test process has no DATABASE_URL) and no live connections (nothing is
 * ever queried: getDb() throws on its presence guard first).
 *
 * Auth/session, pricing, and enrichment are deliberately NOT stubbed.
 * Every path below answers before any of them is awaited, so no live
 * dependency is reached and no unhandled session promise can escape.
 */

const SEARCH_500_MESSAGE = "Unable to search parts right now. Please try again.";

function request(path: string): NextRequest {
  return {
    nextUrl: new URL(`http://localhost${path}`),
  } as unknown as NextRequest;
}

async function withErrorSpy<T>(run: (errors: unknown[][]) => Promise<T>): Promise<{
  result: T;
  errors: unknown[][];
}> {
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    return { result: await run(errors), errors };
  } finally {
    console.error = originalError;
  }
}

describe("GET /api/search/parts failure behaviour", () => {
  it("rejects a missing query with 400 before touching any dependency", async () => {
    const response = await GET(request("/api/search/parts"));
    assert.equal(response.status, 400);
  });

  it("rejects an overlong query with 400 before touching any dependency", async () => {
    const response = await GET(request(`/api/search/parts?q=${"x".repeat(201)}`));
    assert.equal(response.status, 400);
  });

  it("answers 500 with the existing message when the database is unavailable", async () => {
    const { result: response, errors } = await withErrorSpy(async () => {
      return GET(request("/api/search/parts?q=brake&suggest=1"));
    });
    assert.equal(response.status, 500);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.error, SEARCH_500_MESSAGE);
    assert.ok(errors.length >= 1, "the failure must reach the server log");
  });

  it("answers 500 with the existing message and logs a sanitised diagnostic on dependency failure", async () => {
    // Invokes the route's extracted failure contract directly: it is the
    // exact code the outer catch runs, without needing a live backend. The
    // diagnostic derives from the actual exception (name/code/status below)
    // but never carries the raw object, its message, stack, or any request
    // internals — see describeSearchFailure in the route module.
    const boom = new Errors.ServerError("database transport exploded", "", 500);
    const { result: response, errors } = await withErrorSpy(async () => {
      return searchFailureResponse(boom);
    });
    assert.equal(response.status, 500);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.error, SEARCH_500_MESSAGE);
    const diagnostic = errors
      .flat()
      .find(
        (arg): arg is Record<string, unknown> =>
          typeof arg === "object" &&
          arg !== null &&
          ["category", "code", "httpStatus", "name"].every((field) => field in arg),
      );
    assert.ok(diagnostic, "the log must carry the sanitised diagnostic");
    assert.equal(diagnostic.name, "ServerError");
    assert.equal(diagnostic.httpStatus, 500);
    assert.equal(diagnostic.category, "upstream_error");
    // ... while the client sees only the generic message.
    assert.ok(
      !JSON.stringify(body).includes("exploded"),
      "no exception detail may leak to the client",
    );
  });

  it("routes every handler failure through the logging contract", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("app/api/search/parts/route.ts", "utf8"),
    );
    assert.ok(
      /catch\s*\(\s*error\s*\)\s*\{\s*return searchFailureResponse\(error\);?\s*\}/
        .test(source),
      "the outer catch must bind the error and delegate to searchFailureResponse",
    );
  });

  it("keeps the success envelope shape (results/found/facets) on the happy path", async () => {
    // A full 200 needs a live database with catalogue rows, so it cannot run
    // hermetically; the PostgreSQL module returns the same success shape the
    // route already processes. This pins the route's side of the contract:
    // the success block must still emit all three keys.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("app/api/search/parts/route.ts", "utf8"),
    );
    for (const key of ["results:", "found,", "facets:"]) {
      assert.ok(
        source.includes(key),
        `success envelope must still include ${key}`,
      );
    }
  });

  it("no longer gates on Typesense configuration", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("app/api/search/parts/route.ts", "utf8"),
    );
    assert.ok(
      !source.includes("Search service is not configured"),
      "the unconfigured-service 503 belongs to the retired backend",
    );
    assert.ok(
      !source.includes('collections("parts")'),
      "no Typesense collection reads may remain on the search path",
    );
  });
});
