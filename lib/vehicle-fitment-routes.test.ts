import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextRequest } from "next/server";

import { GET as getMakes } from "@/app/api/vehicle-fitment/makes/route";
import { GET as getModels } from "@/app/api/vehicle-fitment/models/route";
import { GET as getVariants } from "@/app/api/vehicle-fitment/variants/route";

/**
 * VEHICLE-SELECTOR ROUTE CONTRACT TESTS — no live database.
 *
 * The homepage hero fetches makes, then models for a make, then variants for
 * a make and model. Every route below answers parameter errors with 400
 * before touching any dependency, and a missing database surfaces from
 * getDb() as the same sanitised generic 500 the search API uses — verified
 * here with no DATABASE_URL set and no live connections (getDb() throws on
 * its presence guard first).
 */

function request(path: string): NextRequest {
  return {
    nextUrl: new URL(`http://localhost${path}`),
  } as unknown as NextRequest;
}

describe("GET /api/vehicle-fitment/makes", () => {
  it("answers 500 with a generic message when the database is unavailable", async () => {
    const response = await getMakes();
    assert.equal(response.status, 500);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.error, "Unable to load vehicle makes right now. Please try again.");
  });
});

describe("GET /api/vehicle-fitment/models", () => {
  it("rejects a missing make with 400 before touching any dependency", async () => {
    const response = await getModels(request("/api/vehicle-fitment/models"));
    assert.equal(response.status, 400);
  });

  it("rejects an overlong make with 400", async () => {
    const response = await getModels(
      request(`/api/vehicle-fitment/models?make=${"x".repeat(101)}`),
    );
    assert.equal(response.status, 400);
  });

  it("answers 500 with a generic message when the database is unavailable", async () => {
    const response = await getModels(request("/api/vehicle-fitment/models?make=Hyundai"));
    assert.equal(response.status, 500);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.error, "Unable to load vehicle models right now. Please try again.");
  });
});

describe("GET /api/vehicle-fitment/variants", () => {
  it("rejects missing parameters with 400 before touching any dependency", async () => {
    assert.equal(
      (await getVariants(request("/api/vehicle-fitment/variants"))).status,
      400,
    );
    assert.equal(
      (await getVariants(request("/api/vehicle-fitment/variants?make=Hyundai"))).status,
      400,
    );
  });

  it("answers 500 with a generic message when the database is unavailable", async () => {
    const response = await getVariants(
      request("/api/vehicle-fitment/variants?make=Hyundai&model=Creta"),
    );
    assert.equal(response.status, 500);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(
      body.error,
      "Unable to load vehicle variants right now. Please try again.",
    );
  });
});
