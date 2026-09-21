import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNoInventedCommercialFields,
  filterSearchPartsForCustomer,
} from "./search-safety";

describe("search safety", () => {
  it("hides pending and unpublished parts from customers", () => {
    const parts = [
      {
        id: "1",
        partNumber: "A",
        name: "Approved",
        brand: "CI",
        isPublished: true,
        approvalStatus: "APPROVED",
      },
      {
        id: "2",
        partNumber: "B",
        name: "Pending",
        brand: "CI",
        isPublished: false,
        approvalStatus: "PENDING_ADMIN_APPROVAL",
      },
      {
        id: "3",
        partNumber: "C",
        name: "Unpublished",
        brand: "CI",
        isPublished: false,
        approvalStatus: "APPROVED",
      },
    ];
    const visible = filterSearchPartsForCustomer(parts);
    assert.deepEqual(
      visible.map((p) => p.partNumber),
      ["A"],
    );
  });

  it("refuses invented commercial fields", () => {
    assert.throws(() => assertNoInventedCommercialFields({ invented: true }));
    assert.deepEqual(assertNoInventedCommercialFields({ pricePaise: 100, stock: 2 }), {
      pricePaise: 100,
      stock: 2,
    });
  });
});
