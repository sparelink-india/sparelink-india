/**
 * Goods receipt validation helpers.
 * Over-receipt is blocked. Partial receipt is supported.
 * PO creation must never increase stock — only confirmed receipts do.
 */

export type PoLineReceiptState = {
  purchaseOrderItemId: string;
  orderedQuantity: number;
  alreadyReceivedQuantity: number;
};

export type ReceiptLineRequest = {
  purchaseOrderItemId: string;
  quantityReceived: number;
};

export type ValidatedReceiptLine = {
  purchaseOrderItemId: string;
  quantityReceived: number;
  pendingAfter: number;
};

export function pendingQuantity(ordered: number, alreadyReceived: number): number {
  return Math.max(0, Math.round(ordered) - Math.max(0, Math.round(alreadyReceived)));
}

export function validateReceiptLines(input: {
  poStatus: string;
  poSupplierId: string;
  requestSupplierId?: string | null;
  lines: ReceiptLineRequest[];
  poLines: PoLineReceiptState[];
}):
  | { ok: true; lines: ValidatedReceiptLine[]; allFullyReceivedAfter: boolean }
  | { ok: false; error: string } {
  const blocked = new Set(["draft", "cancelled"]);
  if (blocked.has(input.poStatus)) {
    return {
      ok: false,
      error: `Cannot receive goods for purchase order in status '${input.poStatus}'.`,
    };
  }

  if (
    input.requestSupplierId &&
    input.requestSupplierId !== input.poSupplierId
  ) {
    return { ok: false, error: "Supplier does not match the purchase order." };
  }

  if (!input.lines.length) {
    return { ok: false, error: "At least one receipt line is required." };
  }

  const byId = new Map(input.poLines.map((l) => [l.purchaseOrderItemId, l]));
  const seen = new Set<string>();
  const validated: ValidatedReceiptLine[] = [];

  for (const line of input.lines) {
    if (!line.purchaseOrderItemId || seen.has(line.purchaseOrderItemId)) {
      return {
        ok: false,
        error: "Each purchase order item may appear once per receipt.",
      };
    }
    seen.add(line.purchaseOrderItemId);

    const poLine = byId.get(line.purchaseOrderItemId);
    if (!poLine) {
      return {
        ok: false,
        error: `Purchase order item not found on this PO: ${line.purchaseOrderItemId}`,
      };
    }

    const qty = line.quantityReceived;
    if (!Number.isInteger(qty) || qty <= 0) {
      return {
        ok: false,
        error: "quantityReceived must be a positive integer.",
      };
    }

    const pending = pendingQuantity(
      poLine.orderedQuantity,
      poLine.alreadyReceivedQuantity,
    );
    if (qty > pending) {
      return {
        ok: false,
        error: `Over-receipt blocked for item ${line.purchaseOrderItemId}: pending ${pending}, requested ${qty}.`,
      };
    }

    validated.push({
      purchaseOrderItemId: line.purchaseOrderItemId,
      quantityReceived: qty,
      pendingAfter: pending - qty,
    });
  }

  // After this receipt, are all PO lines fully received?
  const receivedDelta = new Map(
    validated.map((v) => [v.purchaseOrderItemId, v.quantityReceived]),
  );
  const allFullyReceivedAfter = input.poLines.every((poLine) => {
    const add = receivedDelta.get(poLine.purchaseOrderItemId) ?? 0;
    return (
      pendingQuantity(poLine.orderedQuantity, poLine.alreadyReceivedQuantity + add) ===
      0
    );
  });

  return { ok: true, lines: validated, allFullyReceivedAfter };
}

export function nextPoStatusAfterReceipt(input: {
  previousStatus: string;
  allFullyReceivedAfter: boolean;
  anyReceived: boolean;
}): string {
  if (input.allFullyReceivedAfter) return "received";
  if (input.anyReceived) return "partially_received";
  return input.previousStatus;
}
