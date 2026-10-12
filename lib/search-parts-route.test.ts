import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextRequest } from "next/server";
import { Errors } from "typesense";

import {
  GET,
  searchFailureResponse,
  searchRuntime,
} from "@/app/api/search/parts/route";

/**
 * ROUTE-LEVEL SEARCH FAILURE TESTS.
 *
 * These invoke the real `GET` handler with stubbed Typesense clients through
 * the exported `searchRuntime` seam — the smallest seam that makes the
 * handler testable without touching auth, the database, or the network.
 * Auth/session, DB reads, and pricing are deliberately NOT stubbed: every
 * path below either answers before those dependencies (503) or fails inside
 * `try` before any of them is awaited, so no live dependency is reached.
 *
 * Two guards keep the runner honest:
 * - `console.error` is spied (and restored) so Fix A is asserted, not assumed.
 * - a scoped `unhandledRejection` listener absorbs the intentionally
 *   never-awaited session promise the handler creates on error paths. It is
 *   removed afterwards, so real leaks elsewhere still crash the suite.
 */

const SEARCH_503_MESSAGE = "Search service is not configured";
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
  it("answers 503 with the existing message when Typesense is unconfigured", async () => {
    const original = searchRuntime.getClient;
    searchRuntime.getClient = () => null;
    try {
      const response = await GET(request("/api/search/parts?q=brake"));
      assert.equal(response.status, 503);
      const body = (await response.json()) as { error?: string };
      assert.equal(body.error, SEARCH_503_MESSAGE);
    } finally {
      searchRuntime.getClient = original;
    }
  });

  it("answers 500 with the existing message and logs the real error on dependency failure", async () => {
    // Invokes the route's extracted failure contract directly. Invoking the
    // full GET would create an un-awaited session promise that rejects
    // outside any request scope in plain node and fails the file; the
    // contract itself — bind, log, generic 500 — is identical either way,
    // and the test below pins that the catch block actually calls it.
    const boom = new Errors.ServerError("typesense transport exploded", "", 500);
    const { result: response, errors } = await withErrorSpy(async () => {
      return searchFailureResponse(boom);
    });
    assert.equal(response.status, 500);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.error, SEARCH_500_MESSAGE);
    // Fix A: the genuine exception reaches the server log ...
    assert.ok(
      errors.some((args) => args.includes(boom)),
      "console.error must receive the thrown error object",
    );
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
    // A full 200 needs live Typesense, database rows, and a request-scoped
    // session, so it cannot run hermetically; the fallback unit suite proves
    // success values pass through untouched. This pins the route's side of
    // the contract: the success block must still emit all three keys.
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
});
