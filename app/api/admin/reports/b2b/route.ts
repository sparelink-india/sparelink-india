import { NextResponse } from "next/server";
import { count, lt, sql } from "drizzle-orm";
import {
  goodsReceipt,
  inventory,
  partyLedgerEntry,
  pricingRule,
  purchaseOrder,
  purchaseOrderItem,
  quotation,
  salesOrder,
  stockAdjustment,
  supplier,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();

  const [so] = await db.select({ n: count() }).from(salesOrder);
  const [po] = await db.select({ n: count() }).from(purchaseOrder);
  const [qt] = await db.select({ n: count() }).from(quotation);
  const [sup] = await db.select({ n: count() }).from(supplier);
  const [adj] = await db.select({ n: count() }).from(stockAdjustment);
  const [grn] = await db.select({ n: count() }).from(goodsReceipt);
  const [rules] = await db.select({ n: count() }).from(pricingRule);
  const [ledger] = await db.select({ n: count() }).from(partyLedgerEntry);
  const [low] = await db
    .select({ n: count() })
    .from(inventory)
    .where(lt(inventory.quantity, 5));

  const poByStatus = await db
    .select({
      status: purchaseOrder.status,
      n: count(),
    })
    .from(purchaseOrder)
    .groupBy(purchaseOrder.status);

  const [pendingRecv] = await db
    .select({
      pendingQty: sql<number>`coalesce(sum(${purchaseOrderItem.quantity} - ${purchaseOrderItem.receivedQuantity}), 0)`,
    })
    .from(purchaseOrderItem);

  const [exposure] = await db
    .select({
      // Latest balances aren't a simple sum; report entry count + max absolute balance sample via subquery would be heavy.
      // Expose ledger entry count only — outstanding per dealer is on /api/admin/credit.
      n: count(),
    })
    .from(partyLedgerEntry);

  return NextResponse.json({
    salesOrders: so?.n ?? 0,
    purchaseOrders: po?.n ?? 0,
    quotations: qt?.n ?? 0,
    suppliers: sup?.n ?? 0,
    lowStock: low?.n ?? 0,
    stockAdjustments: adj?.n ?? 0,
    goodsReceipts: grn?.n ?? 0,
    pricingRules: rules?.n ?? 0,
    ledgerEntries: ledger?.n ?? 0,
    purchaseOrderStatus: Object.fromEntries(
      poByStatus.map((row) => [row.status, row.n]),
    ),
    pendingReceiveQuantity: Number(pendingRecv?.pendingQty ?? 0),
    creditLedgerEntryCount: exposure?.n ?? 0,
  });
}
