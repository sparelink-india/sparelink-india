import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeSearchFailure,
  searchFailureResponse,
} from "@/app/api/search/parts/route";

/**
 * SEARCH FAILURE DIAGNOSTIC — REDACTION TESTS.
 *
 * The route used to log the thrown value itself. For an Axios error that value
 * carries `config.headers` (the Typesense API key), `config.url` (the whole
 * query string), and `request` (the serialised HTTP frame, key included). The
 * live Preview log confirmed the key in cleartext, so this file pins the
 * replacement: a fixed four-field diagnostic and nothing else.
 *
 * Every credential in this file is SYNTHETIC. No real key, host, connection
 * string or customer identifier appears here.
 */

const FAKE_API_KEY = "SYNTHETIC-KEY-MUST-NEVER-BE-LOGGED-0000";
const FAKE_HOST = "synthetic-cluster.invalid";
const FAKE_CONNECTION_STRING = "postgresql://synthetic:synthetic@db.invalid/sparelink";
const FAKE_QUERY_TERM = "SYNTHETIC-CUSTOMER-SEARCH-TERM-9999";

/** The exact object shape the live failure produced, minus real values. */
function axiosShapedFailure(): unknown {
  return {
    name: "AxiosError",
    message: `getaddrinfo ENOTFOUND ${FAKE_HOST}`,
    code: "ENOTFOUND",
    stack: `Error: getaddrinfo ENOTFOUND ${FAKE_HOST}\n    at Object.<anonymous>`,
    isAxiosError: true,
    config: {
      url: `https://${FAKE_HOST}:443/collections/parts/documents/search?q=${FAKE_QUERY_TERM}`,
      method: "get",
      headers: {
        "X-TYPESENSE-API-KEY": FAKE_API_KEY,
        Accept: "application/json",
      },
      params: { q: FAKE_QUERY_TERM },
    },
    request: {
      _headerSent: true,
      _header: `GET /collections/parts/documents/search?q=${FAKE_QUERY_TERM} HTTP/1.1\r\nX-TYPESENSE-API-KEY: ${FAKE_API_KEY}\r\nHost: ${FAKE_HOST}\r\n\r\n`,
      socket: { remoteAddress: FAKE_HOST },
    },
    cause: {
      code: "ENOTFOUND",
      errno: -3008,
      syscall: "getaddrinfo",
      hostname: FAKE_HOST,
    },
  };
}

/** Serialises everything console.error would ever render, for leak scanning. */
async function captureLoggedText(run: () => Promise<unknown> | unknown): Promise<string> {
  const chunks: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    chunks.push(args);
  };
  try {
    await run();
  } finally {
    console.error = original;
  }
  const seen = new Set<string>();
  const rendered: string[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (depth > 6) return;
    if (typeof value === "string") {
      if (!seen.has(value)) {
        seen.add(value);
        rendered.push(value);
      }
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const entry of Object.values(value as Record<string, unknown>)) {
      visit(entry, depth + 1);
    }
  };
  for (const chunk of chunks) visit(chunk, 0);
  return rendered.join("\n");
}

describe("describeSearchFailure — approved fields only", () => {
  it("emits exactly the four approved fields", () => {
    const diagnostic = describeSearchFailure(axiosShapedFailure());
    assert.deepEqual(Object.keys(diagnostic).sort(), [
      "category",
      "code",
      "httpStatus",
      "name",
    ]);
  });

  it("classifies a dead Typesense host without naming it", () => {
    const diagnostic = describeSearchFailure(axiosShapedFailure());
    assert.equal(diagnostic.name, "AxiosError");
    assert.equal(diagnostic.code, "ENOTFOUND");
    assert.equal(diagnostic.httpStatus, null);
    assert.equal(diagnostic.category, "unreachable_host");
  });

  it("classifies the documented Typesense status taxonomy", () => {
    const cases: Array<[number, string]> = [
      [401, "credentials_rejected"],
      [403, "credentials_rejected"],
      [404, "collection_missing"],
      [429, "rate_limited"],
      [400, "query_rejected"],
      [422, "query_rejected"],
      [500, "upstream_error"],
      [503, "upstream_error"],
    ];
    for (const [status, expected] of cases) {
      const diagnostic = describeSearchFailure({ name: "TypesenseError", httpStatus: status });
      assert.equal(diagnostic.httpStatus, status);
      assert.equal(diagnostic.category, expected, `status ${status}`);
    }
  });

  it("reads a code nested one level down, as Axios does", () => {
    const diagnostic = describeSearchFailure({
      name: "TypesenseError",
      cause: { code: "ECONNREFUSED" },
    });
    assert.equal(diagnostic.code, "ECONNREFUSED");
    assert.equal(diagnostic.category, "connection_refused");
  });

  it("survives a non-object throw and does not echo it", () => {
    for (const thrown of [undefined, null, "boom", 42, true]) {
      const diagnostic = describeSearchFailure(thrown);
      assert.deepEqual(Object.keys(diagnostic).sort(), [
        "category",
        "code",
        "httpStatus",
        "name",
      ]);
      assert.equal(diagnostic.name, "UnknownError");
      assert.equal(diagnostic.code, null);
      assert.equal(diagnostic.httpStatus, null);
      assert.equal(diagnostic.category, "unknown");
    }
  });

  it("refuses identifiers that are shaped like credentials", () => {
    // A 200-character "name" and a URL-shaped "code" are both rejected rather
    // than echoed, so a mislabelled error cannot smuggle a secret through.
    const diagnostic = describeSearchFailure({
      name: FAKE_API_KEY + "x".repeat(200),
      code: "https://user:pass@db.invalid/sparelink",
    });
    assert.equal(diagnostic.name, "UnknownError");
    assert.equal(diagnostic.code, null);
    assert.equal(diagnostic.category, "unknown");
  });

  it("rejects an out-of-range or non-integer httpStatus", () => {
    for (const status of [0, 99, 600, -500, 12.5, Number.NaN]) {
      assert.equal(describeSearchFailure({ httpStatus: status }).httpStatus, null);
    }
  });
});

describe("searchFailureResponse — nothing secret-bearing reaches the log", () => {
  it("never logs the API key, headers, query text, host or connection string", async () => {
    const logged = await captureLoggedText(() =>
      searchFailureResponse(axiosShapedFailure()),
    );

    for (const forbidden of [
      FAKE_API_KEY,
      FAKE_HOST,
      FAKE_QUERY_TERM,
      FAKE_CONNECTION_STRING,
      "X-TYPESENSE-API-KEY",
      "collections/parts",
      "config",
      "headers",
      "stack",
      "postgresql://",
    ]) {
      assert.ok(
        !logged.includes(forbidden),
        `log must not contain ${JSON.stringify(forbidden)}`,
      );
    }
  });

  it("does not retain a reference to the original error", async () => {
    const failure = axiosShapedFailure() as Record<string, unknown>;
    const diagnostic = describeSearchFailure(failure);
    assert.ok(!("config" in diagnostic));
    assert.ok(!("request" in diagnostic));
    assert.ok(!("message" in diagnostic));
    assert.ok(!("stack" in diagnostic));
    // Widened to `unknown` so the aliasing check is a runtime assertion
    // against untrusted values rather than a compile-time impossibility.
    for (const value of Object.values(diagnostic) as unknown[]) {
      assert.ok(
        value !== (failure as unknown) &&
          value !== (failure.config as unknown) &&
          value !== (failure.request as unknown),
        "no diagnostic field may alias the thrown error",
      );
    }
  });

  it("keeps the existing HTTP 500 contract byte-for-byte", async () => {
    const chunks: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      chunks.push(args);
    };
    let response;
    try {
      response = await searchFailureResponse(axiosShapedFailure());
    } finally {
      console.error = original;
    }
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Unable to search parts right now. Please try again.",
    });
    assert.ok(chunks.length > 0, "the failure must still be logged");
  });

  it("still logs a connection string error without reproducing the string", async () => {
    const logged = await captureLoggedText(() =>
      searchFailureResponse({
        name: "Error",
        message: `DATABASE_URL is not set. Copy .env.example to .env.local and provide a Postgres URL before using the database. ${FAKE_CONNECTION_STRING}`,
        code: "ECONNREFUSED",
      }),
    );
    assert.ok(!logged.includes(FAKE_CONNECTION_STRING));
    assert.ok(!logged.includes("DATABASE_URL"));
    assert.ok(logged.includes("connection_refused"));
  });
});
