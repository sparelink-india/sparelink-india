import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SPARELINK_FIRMS } from "./firms";
import { isCodEnabledForFirm } from "./bank-payment-config";
import { shouldRestockOnStatusChange } from "./order-cancel-restock";

describe("phase4 COD / cancel helpers", () => {
  it("COD defaults enabled for all three firms when env unset", () => {
    for (const firm of SPARELINK_FIRMS) {
      assert.equal(
        isCodEnabledForFirm(firm.id, firm.name, firm.code),
        true,
        firm.name,
      );
    }
  });

  it("restock only on first transition into cancelled", () => {
    assert.equal(shouldRestockOnStatusChange("placed", "cancelled"), true);
    assert.equal(shouldRestockOnStatusChange("processing", "cancelled"), true);
    assert.equal(shouldRestockOnStatusChange("cancelled", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("returned", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("placed", "shipped"), false);
    assert.equal(shouldRestockOnStatusChange("placed", undefined), false);
  });
});
