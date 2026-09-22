import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  goodsReceipt,
  goodsReceiptItem,
  inventory,
  purchaseOrder,
  purchaseOrderItem,
  stockAdjustment,
  supplier,
} from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { nextB2bDocNumber } from "@/lib/b2b-lines";
import { getDb } from "@/lib/db";
import {
  nextPoStatusAfterReceipt,
  validateReceiptLines,
  type ReceiptLineRequest,
} from "@/lib/goods-receipt";

export async function confirmGoodsReceipt(input: {
  purchaseOrderId: string;
  lines: ReceiptLineRequest[];
  supplierId?: string | null;
  warehouseCode?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  actorUserId: string;
}): Promise<
  | {
      ok: true;
      receipt: typeof goodsReceipt.$inferSelect;
      created: boolean;
      stockIncreases: Array<{
        dealerListingId: string;
        delta: number;
        inventoryId: string;
      }>;
    }
  | { ok: false; error: string; status: number }
> {
  const db = getDb();

  if (input.idempotencyKey) {
    const existing = await db.query.goodsReceipt.findFirst({
      where: eq(goodsReceipt.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      return { ok: true, receipt: existing, created: false, stockIncreases: [] };
    }
  }

  const po = await db.query.purchaseOrder.findFirst({
    where: eq(purchaseOrder.id, input.purchaseOrderId),
  });
  if (!po) {
    return { ok: false, error: "Purchase order not found", status: 404 };
  }

  const supplierRow = await db.query.supplier.findFirst({
    where: eq(supplier.id, po.supplierId),
  });
  if (!supplierRow) {
    return { ok: false, error: "Supplier not found for PO", status: 400 };
  }

  const poItems = await db
    .select()
    .from(purchaseOrderItem)
    .where(eq(purchaseOrderItem.purchaseOrderId, po.id));

  const validated = validateReceiptLines({
    poStatus: po.status,
    poSupplierId: po.supplierId,
    requestSupplierId: input.supplierId,
    lines: input.lines,
    poLines: poItems.map((item) => ({
      purchaseOrderItemId: item.id,
      orderedQuantity: item.quantity,
      alreadyReceivedQuantity: item.receivedQuantity ?? 0,
    })),
  });
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 };
  }

  const warehouseCode =
    (input.warehouseCode && input.warehouseCode.trim()) ||
    po.warehouseCode ||
    "MAIN";

  const receiptId = randomUUID();
  const receiptNumber = nextB2bDocNumber("GRN");
  const stockIncreases: Array<{
    dealerListingId: string;
    delta: number;
    inventoryId: string;
  }> = [];

  try {
    await db.transaction(async (tx) => {
      await tx.insert(goodsReceipt).values({
        id: receiptId,
        receiptNumber,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        warehouseCode,
        status: "confirmed",
        idempotencyKey: input.idempotencyKey ?? null,
        notes: input.notes ?? null,
        receivedByUserId: input.actorUserId,
      });

      for (const line of validated.lines) {
        const poItem = poItems.find((p) => p.id === line.purchaseOrderItemId)!;
        const receiptItemId = randomUUID();
        let stockAdjustmentId: string | null = null;

        if (poItem.dealerListingId) {
          let inv = await tx.query.inventory.findFirst({
            where: eq(inventory.dealerListingId, poItem.dealerListingId),
          });

          if (!inv) {
            const invId = randomUUID();
            await tx.insert(inventory).values({
              id: invId,
              dealerListingId: poItem.dealerListingId,
              quantity: 0,
              reservedQuantity: 0,
              warehouseCode,
            });
            inv = await tx.query.inventory.findFirst({
              where: eq(inventory.id, invId),
            });
          }

          if (!inv) {
            throw new Error("Failed to ensure inventory row for goods receipt");
          }

          const previousQuantity = inv.quantity;
          const newQuantity = previousQuantity + line.quantityReceived;
          stockAdjustmentId = randomUUID();

          await tx
            .update(inventory)
            .set({ quantity: newQuantity, updatedAt: new Date() })
            .where(eq(inventory.id, inv.id));

          await tx.insert(stockAdjustment).values({
            id: stockAdjustmentId,
            inventoryId: inv.id,
            dealerListingId: poItem.dealerListingId,
            actorUserId: input.actorUserId,
            previousQuantity,
            newQuantity,
            delta: line.quantityReceived,
            reason: `Goods receipt ${receiptNumber}`,
            warehouseCode,
            goodsReceiptId: receiptId,
            goodsReceiptItemId: receiptItemId,
            referenceType: "goods_receipt",
            referenceId: receiptId,
          });

          stockIncreases.push({
            dealerListingId: poItem.dealerListingId,
            delta: line.quantityReceived,
            inventoryId: inv.id,
          });
        }

        await tx.insert(goodsReceiptItem).values({
          id: receiptItemId,
          goodsReceiptId: receiptId,
          purchaseOrderItemId: poItem.id,
          dealerListingId: poItem.dealerListingId,
          partId: poItem.partId,
          partNumber: poItem.partNumber,
          partName: poItem.partName,
          quantityReceived: line.quantityReceived,
          stockAdjustmentId,
        });

        await tx
          .update(purchaseOrderItem)
          .set({
            receivedQuantity:
              (poItem.receivedQuantity ?? 0) + line.quantityReceived,
          })
          .where(eq(purchaseOrderItem.id, poItem.id));
      }

      const nextStatus = nextPoStatusAfterReceipt({
        previousStatus: po.status,
        allFullyReceivedAfter: validated.allFullyReceivedAfter,
        anyReceived: true,
      });

      await tx
        .update(purchaseOrder)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(purchaseOrder.id, po.id));
    });
  } catch (error) {
    if (input.idempotencyKey) {
      const raced = await db.query.goodsReceipt.findFirst({
        where: eq(goodsReceipt.idempotencyKey, input.idempotencyKey),
      });
      if (raced) {
        return {
          ok: true,
          receipt: raced,
          created: false,
          stockIncreases: [],
        };
      }
    }
    throw error;
  }

  const receipt = await db.query.goodsReceipt.findFirst({
    where: eq(goodsReceipt.id, receiptId),
  });
  if (!receipt) {
    return { ok: false, error: "Receipt not found after create", status: 500 };
  }

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: "goods_receipt.confirm",
    entityType: "goods_receipt",
    entityId: receiptId,
    metadata: {
      purchaseOrderId: po.id,
      receiptNumber,
      lineCount: validated.lines.length,
      stockIncreases,
      warehouseCode,
    },
  });

  return { ok: true, receipt, created: true, stockIncreases };
}

export async function listGoodsReceipts(limit = 100) {
  return getDb()
    .select({
      id: goodsReceipt.id,
      receiptNumber: goodsReceipt.receiptNumber,
      purchaseOrderId: goodsReceipt.purchaseOrderId,
      poNumber: purchaseOrder.poNumber,
      supplierId: goodsReceipt.supplierId,
      supplierName: supplier.name,
      warehouseCode: goodsReceipt.warehouseCode,
      status: goodsReceipt.status,
      createdAt: goodsReceipt.createdAt,
    })
    .from(goodsReceipt)
    .innerJoin(purchaseOrder, eq(goodsReceipt.purchaseOrderId, purchaseOrder.id))
    .leftJoin(supplier, eq(goodsReceipt.supplierId, supplier.id))
    .orderBy(desc(goodsReceipt.createdAt))
    .limit(limit);
}
