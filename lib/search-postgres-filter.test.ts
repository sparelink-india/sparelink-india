import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { drizzle } from "drizzle-orm/pg-proxy";

import {
  parseSearchSort,
  searchPartsPage,
} from "@/lib/search-postgres";

/**
 * SORT + STOCK-FILTER QUERY-SHAPE TESTS — no live database.
 *
 * Same pg-proxy harness as `lib/search-postgres-sql.test.ts`: the real
 * retrieval functions run against a capturing proxy, proving hermetically
 * that sort keys are allow-listed, ordering is deterministic, and the stock
 * predicate is a correlated EXISTS over authoritative inventory state.
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

describe("parseSearchSort allow-list", () => {
  it("passes the three documented keys through", () => {
    assert.equal(parseSearchSort("relevance"), "relevance");
    assert.equal(parseSearchSort("name_asc"), "name_asc");
    assert.equal(parseSearchSort("name_desc"), "name_desc");
  });

  it("falls back to relevance for anything else", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "price_asc",
      "PRICE_DESC",
      "name asc",
      "relevance; drop table part",
      42,
      { sort: "name_asc" },
    ]) {
      assert.equal(parseSearchSort(bad), "relevance", JSON.stringify(bad));
    }
  });
});

describe("server result ordering", () => {
  it("orders by name ascending with an id tie-break", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(
      proxyDb(captured),
      { ...BASE_FILTER, text: "brake", sort: "name_asc" },
      1,
      24,
    );
    const rowsSql = captured[0].sql;
    assert.match(rowsSql, /order by/i);
    assert.match(rowsSql, /"name"\s+asc/i);
    assert.match(rowsSql, /"id"\s+asc/i);
    assert.ok(!/ts_rank/i.test(rowsSql), "name sort must not rank");
  });

  it("orders by name descending with an id tie-break", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(
      proxyDb(captured),
      { ...BASE_FILTER, text: "brake", sort: "name_desc" },
      1,
      24,
    );
    const rowsSql = captured[0].sql;
    assert.match(rowsSql, /"name"\s+desc/i);
    assert.match(rowsSql, /"id"\s+asc/i);
  });

  it("keeps ts_rank relevance order by default", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "brake" }, 1, 24);
    assert.match(captured[0].sql, /ts_rank/i);
  });

  it("never lets a hostile sort value reach SQL text", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(
      proxyDb(captured),
      { ...BASE_FILTER, text: "brake", sort: parseSearchSort("name_asc; drop table part") },
      1,
      24,
    );
    const sqlText = captured.map((c) => c.sql).join("\n");
    assert.ok(!/drop table/i.test(sqlText));
    assert.match(sqlText, /ts_rank/i);
  });

  it("keeps bound pagination alongside a sort", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(
      proxyDb(captured),
      { ...BASE_FILTER, text: "oil", sort: "name_desc" },
      2,
      24,
    );
    const rowsSql = captured[0].sql;
    assert.match(rowsSql, /limit\s+\$\d+/i);
    assert.match(rowsSql, /offset\s+\$\d+/i);
  });
});

describe("in-stock filter predicate", () => {
  it("adds a correlated EXISTS over active sellable listings", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(
      proxyDb(captured),
      { ...BASE_FILTER, text: "brake", inStock: true },
      1,
      24,
    );
    const rowsSql = captured[0].sql;
    assert.match(rowsSql, /exists\s*\(/i);
    assert.match(rowsSql, /dealer_listing/i);
    assert.match(rowsSql, /inventory/i);
    assert.match(rowsSql, /quantity/i);
    // "active" must travel as a bound parameter ($6 above), never as SQL text.
    assert.ok(!/active/i.test(rowsSql), "status literal must not appear in SQL");
    const params = JSON.stringify(captured.flatMap((c) => c.params));
    assert.ok(params.includes('"active"'), "status value must travel as a bound param");
  });

  it("negates the predicate for out-of-stock", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(
      proxyDb(captured),
      { ...BASE_FILTER, text: "brake", inStock: false },
      1,
      24,
    );
    assert.match(captured[0].sql, /not\s+exists\s*\(/i);
  });

  it("touches no listing table when the filter is absent", async () => {
    const captured: Captured[] = [];
    await searchPartsPage(proxyDb(captured), { ...BASE_FILTER, text: "brake" }, 1, 24);
    const rowsSql = captured[0].sql;
    assert.ok(!/dealer_listing/i.test(rowsSql));
    assert.ok(!/inventory/i.test(rowsSql));
  });
});
