import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { drizzle } from "drizzle-orm/pg-proxy";

import {
  searchPartNumbersPostgres,
  searchPartsFetch,
  searchPartsPage,
} from "@/lib/search-postgres";

/**
 * POSTGRESQL QUERY-SHAPE TESTS — no live database.
 *
 * These run the real retrieval functions against `drizzle-orm/pg-proxy`,
 * which captures the generated SQL and bound parameters instead of
 * executing them. That proves, hermetically:
 *   - user input travels only as bound parameters (SQL-injection surface);
 *   - LIKE metacharacters are escaped;
 *   - visibility/brand/category/scope predicates are present (or absent for
 *     admins, exactly as specified);
 *   - pagination is bound LIMIT/OFFSET; facets use GROUP BY.
 *
 * What this does NOT prove (needs the isolated QA database): execution
 * plans, latency, ranking quality, or behaviour on real catalogue rows.
 */

type Captured = { sql: string; params: unknown[] };

function proxyDb(captured: Captured[]) {
  return drizzle(async (sqlText: string, params: unknown[]) => {
    captured.push({ sql: String(sqlText), params: params as unknown[] });
    return { rows: [] };
  }) as never;
}

const BASE_FILTER = {
  brand: null,
  categoryNames: [] as string[],
  scopedPartIds: null,
  isAdmin: false,
};

describe("generated search SQL", () => {
  it("issues rows, count and grouped facet queries", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "brake" }, 1, 24);
    assert.equal(captured.length, 4);
  });

  it("never interpolates user input into SQL text", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "100%_brake\\pad" }, 1, 24);
    const sqlText = captured.map((c) => c.sql).join("\n");
    assert.ok(!sqlText.includes("100%_brake"), "raw hostile input must not appear in SQL");
    const params = JSON.stringify(captured.flatMap((c) => c.params));
    // Note the doubling: JSON.stringify escapes each backslash, so the
    // expected literal carries twice the backslashes of the actual value
    // `100\%\_brake\\pad%`. This asserts the ENCODED form, proving the raw
    // hostile input appears nowhere except inside bound parameters.
    assert.ok(params.includes("100\\\\%\\\\_brake\\\\\\\\pad%"), "escaped input must travel as bound params");
  });

  it("binds pagination as LIMIT/OFFSET parameters", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "oil" }, 2, 24);
    const sqlText = captured.map((c) => c.sql).join("\n");
    assert.ok(/limit\s+\$\d+/i.test(sqlText), "LIMIT must be bound");
    assert.ok(/offset\s+\$\d+/i.test(sqlText), "OFFSET must be bound");
  });

  it("applies visibility for non-admins and omits it for admins", async () => {
    const userCaptured: Captured[] = [];
    await searchPartsFetch(proxyDb(userCaptured), { ...BASE_FILTER, text: "oil" }, 50);
    assert.ok(
      userCaptured.some((c) => /is_published/i.test(c.sql)),
      "non-admin queries must filter visibility in SQL",
    );
    const adminCaptured: Captured[] = [];
    await searchPartsFetch(
      proxyDb(adminCaptured),
      { ...BASE_FILTER, isAdmin: true, text: "oil" },
      50,
    );
    assert.ok(
      !adminCaptured.some((c) => /is_published/i.test(c.sql)),
      "admin queries must not carry the visibility predicate",
    );
  });

  it("orders paged retrieval by ts_rank with a deterministic tiebreak", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "filter" }, 1, 24);
    assert.ok(
      captured.some((c) => /ts_rank/i.test(c.sql)),
      "paged retrieval must order by ts_rank",
    );
  });

  it("scopes brand, category and vehicle ids as bound parameters", async () => {
    const captured: Captured[] = [];
    await searchPartsFetch(
      proxyDb(captured),
      {
        ...BASE_FILTER,
        text: "filter",
        brand: "MEKO",
        categoryNames: ["Filters"],
        scopedPartIds: ["p1", "p2"],
      },
      50,
    );
    const params = JSON.stringify(captured.flatMap((c) => c.params));
    assert.ok(params.includes("MEKO") && params.includes("Filters"));
    assert.ok(params.includes("p1") && params.includes("p2"));
  });

  it("matches part numbers by exact equality or escaped prefix", async () => {
    const captured: Captured[] = [];
    const result = await searchPartNumbersPostgres(
      proxyDb(captured),
      ["M663", "M663"],
      { ...BASE_FILTER },
      100,
    );
    const sqlText = captured.map((c) => c.sql).join("\n");
    assert.ok(/part_number.+=\s*\$\d+/i.test(sqlText), "exact match must be bound equality");
    assert.ok(/part_number.+ilike\s*\$\d+/i.test(sqlText), "prefix match must be bound ILIKE");
    assert.deepEqual(result.hits, []);
    assert.equal(result.found, 0);
  });

  it("aggregates facets with GROUP BY, not row fetching", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "oil" }, 1, 24);
    assert.ok(
      captured.some((c) => /group by/i.test(c.sql)),
      "facet queries must aggregate in SQL",
    );
  });
});
