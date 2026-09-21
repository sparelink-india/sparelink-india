import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nextPoStatusAfterReceipt,
  pendingQuantity,
  validateReceiptLines,
} from "./goods-receipt";

describe("goods receipt → stock foundation", () => {
  const basePoLines = [
    {
      purchaseOrderItemId: "item-1",
      orderedQuantity: 100,
      alreadyReceivedQuantity: 0,
    },
    {
      purchaseOrderItemId: "item-2",
      orderedQuantity: 50,
      alreadyReceivedQuantity: 0,
    },
  ];

  it("PO pending starts at full ordered qty (create does not receive)", () => {
    assert.equal(pendingQuantity(100, 0), 100);
  });

  it("blocks receipt on draft/cancelled PO", () => {
    const draft = validateReceiptLines({
      poStatus: "draft",
      poSupplierId: "sup-1",
      lines: [{ purchaseOrderItemId: "item-1", quantityReceived: 10 }],
      poLines: basePoLines,
    });
    assert.equal(draft.ok, false);

    const cancelled = validateReceiptLines({
      poStatus: "cancelled",
      poSupplierId: "sup-1",
      lines: [{ purchaseOrderItemId: "item-1", quantityReceived: 10 }],
      poLines: basePoLines,
    });
    assert.equal(cancelled.ok, false);
  });

  it("blocks wrong supplier", () => {
    const result = validateReceiptLines({
      poStatus: "submitted",
      poSupplierId: "sup-1",
      requestSupplierId: "sup-other",
      lines: [{ purchaseOrderItemId: "item-1", quantityReceived: 10 }],
      poLines: basePoLines,
    });
    assert.equal(result.ok, false);
  });

  it("supports partial receipt", () => {
    const first = validateReceiptLines({
      poStatus: "submitted",
      poSupplierId: "sup-1",
      lines: [{ purchaseOrderItemId: "item-1", quantityReceived: 40 }],
      poLines: basePoLines,
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.lines[0]?.pendingAfter, 60);
      assert.equal(first.allFullyReceivedAfter, false);
      assert.equal(
        nextPoStatusAfterReceipt({
          previousStatus: "submitted",
          allFullyReceivedAfter: false,
          anyReceived: true,
        }),
        "partially_received",
      );
    }
  });

  it("supports second partial receipt to completion", () => {
    const second = validateReceiptLines({
      poStatus: "partially_received",
      poSupplierId: "sup-1",
      lines: [
        { purchaseOrderItemId: "item-1", quantityReceived: 60 },
        { purchaseOrderItemId: "item-2", quantityReceived: 50 },
      ],
      poLines: [
        {
          purchaseOrderItemId: "item-1",
          orderedQuantity: 100,
          alreadyReceivedQuantity: 40,
        },
        {
          purchaseOrderItemId: "item-2",
          orderedQuantity: 50,
          alreadyReceivedQuantity: 0,
        },
      ],
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.allFullyReceivedAfter, true);
      assert.equal(
        nextPoStatusAfterReceipt({
          previousStatus: "partially_received",
          allFullyReceivedAfter: true,
          anyReceived: true,
        }),
        "received",
      );
    }
  });

  it("blocks over-receipt", () => {
    const result = validateReceiptLines({
      poStatus: "submitted",
      poSupplierId: "sup-1",
      lines: [{ purchaseOrderItemId: "item-1", quantityReceived: 101 }],
      poLines: basePoLines,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Over-receipt/i);
  });

  it("blocks unknown PO item", () => {
    const result = validateReceiptLines({
      poStatus: "submitted",
      poSupplierId: "sup-1",
      lines: [{ purchaseOrderItemId: "nope", quantityReceived: 1 }],
      poLines: basePoLines,
    });
    assert.equal(result.ok, false);
  });

  it("blocks duplicate lines in one receipt", () => {
    const result = validateReceiptLines({
      poStatus: "submitted",
      poSupplierId: "sup-1",
      lines: [
        { purchaseOrderItemId: "item-1", quantityReceived: 1 },
        { purchaseOrderItemId: "item-1", quantityReceived: 1 },
      ],
      poLines: basePoLines,
    });
    assert.equal(result.ok, false);
  });
});
