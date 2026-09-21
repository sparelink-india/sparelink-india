import { NextResponse } from "next/server";
import { count, lt } from "drizzle-orm";
import {
  inventory,
  purchaseOrder,
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
  const [low] = await db
    .select({ n: count() })
    .from(inventory)
    .where(lt(inventory.quantity, 5));

  return NextResponse.json({
    salesOrders: so?.n ?? 0,
    purchaseOrders: po?.n ?? 0,
    quotations: qt?.n ?? 0,
    suppliers: sup?.n ?? 0,
    lowStock: low?.n ?? 0,
    stockAdjustments: adj?.n ?? 0,
  });
}
