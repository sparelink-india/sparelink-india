/**
 * `GET /api/search/parts` — a failure inside the try block must produce the
 * existing HTTP 500, and a diagnostic derived from the caught exception must
 * reach the server log.
 *
 * This is the regression guard for the defect that made the production 500
 * undiagnosable: the handler used to be `catch { console.error("Parts search
 * failed") }`, which discarded the exception entirely.
 *
 * The log is deliberately sanitised. Logging the exception itself published the
 * Typesense API key through the Axios request config, so only name, code,
 * httpStatus and a coarse category are emitted — see
 * `search-parts-route.diagnostic-redaction.test.ts`.
 *
 * NO PRODUCTION ACCESS and no live services:
 *   - `TYPESENSE_HOST` is set to an unresolvable placeholder, so the Typesense
 *     client is constructed but never called (getDb() throws first).
 *   - `DATABASE_URL` is unset, so `getDb()` throws on its guard clause BEFORE it
 *     creates a Postgres client. No connection is opened, no query is sent, and
 *     no credential is required.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

// Type-only: erased at compile time, so the route module is still first
// evaluated inside `before`, after process.env is staged.
import type { SearchFailureDiagnostic } from "../app/api/search/parts/route";

import { NextRequest } from "next/server";

let GET: typeof import("../app/api/search/parts/route").GET;

before(async () => {
  // Before the route module is evaluated: lib/typesense.ts and lib/env.ts both
  // snapshot process.env at module load.
  process.env.TYPESENSE_HOST = "typesense.invalid";
  delete process.env.DATABASE_URL;
  ({ GET } = await import("../app/api/search/parts/route"));
});

type Captured = unknown[][];

/** Run the handler with console.error captured, so the test stays silent. */
async function callGet(query: string): Promise<{
  res: Awaited<ReturnType<typeof GET>>;
  captured: Captured;
}> {
  const captured: Captured = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args);
  };
  try {
    const res = await GET(
      new NextRequest(`https://sparelink.test/api/search/parts?q=${query}`),
    );
    return { res, captured };
  } finally {
    console.error = original;
  }
}

describe("GET /api/search/parts — dependency failure inside the try block", () => {
  it("returns the existing 500 response with the unchanged client message", async () => {
    const { res } = await callGet("brake");

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "Unable to search parts right now. Please try again.",
    });
  });

  it("logs a sanitised diagnostic derived from the ACTUAL exception, not a bare literal", async () => {
    const { captured } = await callGet("brake");

    assert.equal(captured.length, 1, "expected exactly one log line");

    const [message, thrown] = captured[0] ?? [];
    assert.equal(message, "Parts search failed:");

    // The failure is still derived from the real exception rather than a
    // literal, but it is reduced to the approved four fields first. Logging
    // the exception itself published the Typesense API key through the Axios
    // request config, so the message, stack and nested objects are no longer
    // emitted — only name, code, httpStatus and a coarse category.
    assert.ok(
      typeof thrown === "object" && thrown !== null,
      "the log must carry a diagnostic object",
    );
    assert.deepEqual(Object.keys(thrown as Record<string, unknown>).sort(), [
      "category",
      "code",
      "httpStatus",
      "name",
    ]);

    const diagnostic = thrown as SearchFailureDiagnostic;
    assert.equal(diagnostic.name, "Error");
    assert.ok(
      ["unreachable_host", "unknown", "timeout", "connection_refused"].includes(
        diagnostic.category,
      ),
      `unexpected category ${diagnostic.category}`,
    );

    // The database-missing message itself must NOT be reproduced: it is the
    // kind of string that can carry a connection target.
    assert.ok(
      !JSON.stringify(diagnostic).includes("DATABASE_URL"),
      "the diagnostic must not echo the connection guidance",
    );
  });

  it("does not expose the exception, stack or internals to the client", async () => {
    const { res } = await callGet("brake");
    const text = await res.text();

    assert.ok(!text.includes("DATABASE_URL"), "must not name the config variable");
    assert.ok(!text.includes("at "), "must not contain stack frames");
    assert.ok(!text.includes(".ts"), "must not contain source locations");
    assert.ok(!/error\.message/.test(text), "must not serialise the raw error");
  });

  it("logs no request headers, cookies or query text alongside the error", async () => {
    const { captured } = await callGet("brake");
    const line = captured[0] ?? [];

    assert.equal(line.length, 2, "message + diagnostic object only, nothing else");
    assert.equal(line[0], "Parts search failed:");
    // The payload is the fixed diagnostic, so it carries no `.message` at all
    // and therefore nothing the caller typed.
    assert.ok(
      !(line[1] as Record<string, unknown> | undefined)?.message,
      "the logged payload must not expose an error message",
    );
    const rendered = JSON.stringify(line[1] ?? {});
    assert.equal(rendered.includes("brake"), false, "must not log the raw query");
  });
});