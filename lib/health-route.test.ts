import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "../app/api/health/route";

/**
 * HEALTH-ENDPOINT CONTRACT — `app/api/health/route.ts`.
 *
 * The liveness probe must stay dependency-free (no auth, no database, no
 * env, no network) so monitors can trust a 200 as "process alive" and so
 * this test never needs a fixture. If the probe ever gains a downstream
 * dependency, these assertions force that decision to be revisited.
 */
describe("health endpoint contract", () => {
  it("answers 200 with ok:true and the service name", async () => {
    const res = await GET();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      ok: true,
      service: "sparelink-india-web",
    });
  });

  it("is never cached by intermediaries", async () => {
    const res = await GET();
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });
});
