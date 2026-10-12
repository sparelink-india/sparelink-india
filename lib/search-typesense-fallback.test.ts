import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Errors } from "typesense";

import {
  isRankableQueryError,
  searchWithRankingFallback,
} from "@/lib/search-typesense-fallback";

/**
 * RANKING-FALLBACK CONTRACT TESTS.
 *
 * These use the REAL error classes from the installed `typesense` package —
 * not shape-alikes — so the classification is proven against the SDK the
 * route actually runs, not against an invented taxonomy. Reference:
 * `node_modules/typesense/lib/Typesense/ApiCall.js#customErrorForResponse`
 * (400->RequestMalformed, 401->RequestUnauthorized, 404->ObjectNotFound,
 * 409->ObjectAlreadyExists, 422->ObjectUnprocessable, 500-599->ServerError,
 * anything else->HTTPError; every instance carries `httpStatus`, and
 * `TypesenseError` sets `name` to the subclass name).
 */

const RANKED = { q: "brake", query_by_weights: "6,5,1,3,2", num_typos: 1 };
const PLAIN = { q: "brake" };

describe("isRankableQueryError", () => {
  it("treats real 400/422 SDK errors as rankable", () => {
    assert.equal(
      isRankableQueryError(new Errors.RequestMalformed("m", "b", 400)),
      true,
    );
    assert.equal(
      isRankableQueryError(new Errors.ObjectUnprocessable("m", "b", 422)),
      true,
    );
  });

  it("accepts a bare httpStatus 400/422 for builds without per-status subclasses", () => {
    assert.equal(isRankableQueryError({ httpStatus: 400 }), true);
    assert.equal(isRankableQueryError({ httpStatus: 422 }), true);
  });

  it("refuses every real infrastructure error class", () => {
    const infra = [
      new Errors.RequestUnauthorized("m", "b", 401),
      new Errors.ObjectNotFound("m", "b", 404),
      new Errors.ObjectAlreadyExists("m", "b", 409),
      new Errors.ServerError("m", "b", 500),
      new Errors.HTTPError("m", "b", 403),
      new Errors.HTTPError("m", "b", 429),
    ];
    for (const error of infra) {
      assert.equal(
        isRankableQueryError(error),
        false,
        `${error.name} must propagate, never retry`,
      );
    }
  });

  it("refuses transport failures, junk, and non-objects", () => {
    assert.equal(isRankableQueryError(new Error("socket hang up")), false);
    assert.equal(isRankableQueryError(new Errors.TypesenseError("boom")), false);
    for (const junk of [null, undefined, "RequestMalformed", 400, {}, []]) {
      assert.equal(isRankableQueryError(junk), false);
    }
  });
});

describe("searchWithRankingFallback", () => {
  it("returns a success untouched (results/found/facets preserved by identity)", async () => {
    const ok = { hits: [{ id: 1 }], found: 1, facet_counts: [{ a: 1 }] };
    let calls = 0;
    const result = await searchWithRankingFallback(
      async () => {
        calls += 1;
        return ok;
      },
      PLAIN,
      RANKED,
    );
    assert.equal(result, ok);
    assert.equal(calls, 1);
  });

  it("retries exactly once with the plain params on a rankable rejection", async () => {
    const seen: unknown[] = [];
    const plainResult = { hits: [], found: 0 };
    const result = await searchWithRankingFallback(
      async (params) => {
        seen.push(params);
        if (seen.length === 1) {
          throw new Errors.RequestMalformed("bad ranking params", "", 400);
        }
        return plainResult;
      },
      PLAIN,
      RANKED,
    );
    assert.equal(result, plainResult);
    assert.equal(seen.length, 2);
    assert.deepEqual(seen[0], RANKED);
    assert.deepEqual(seen[1], PLAIN);
  });

  it("propagates the retry's own error when the fallback also fails", async () => {
    const retryError = new Errors.ServerError("down", "", 500);
    await assert.rejects(
      searchWithRankingFallback(
        async (params) => {
          if (params === PLAIN) throw retryError;
          throw new Errors.ObjectUnprocessable("shape", "", 422);
        },
        PLAIN,
        RANKED,
      ),
      (error: unknown) => error === retryError,
    );
  });

  it("never retries infrastructure failures (single call, original error)", async () => {
    for (const infra of [
      new Errors.RequestUnauthorized("bad key", "", 401),
      new Errors.ObjectNotFound("no collection", "", 404),
      new Errors.ServerError("down", "", 500),
      new Errors.HTTPError("limited", "", 429),
      new Error("socket hang up"),
    ]) {
      let calls = 0;
      await assert.rejects(
        searchWithRankingFallback(
          async () => {
            calls += 1;
            throw infra;
          },
          PLAIN,
          RANKED,
        ),
        (error: unknown) => error === infra,
      );
      assert.equal(calls, 1, `${(infra as Error).name} must not be retried`);
    }
  });
});
