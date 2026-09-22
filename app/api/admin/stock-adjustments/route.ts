import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
  dealerListing,
  part,
  stockAdjustment,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const db = getDb();
  const rows = await db
    .select({
      id: stockAdjustment.id,
      inventoryId: stockAdjustment.inventoryId,
      dealerListingId: stockAdjustment.dealerListingId,
      actorUserId: stockAdjustment.actorUserId,
      previousQuantity: stockAdjustment.previousQuantity,
      newQuantity: stockAdjustment.newQuantity,
      delta: stockAdjustment.delta,
      reason: stockAdjustment.reason,
      warehouseCode: stockAdjustment.warehouseCode,
      createdAt: stockAdjustment.createdAt,
      partName: part.name,
      partNumber: part.partNumber,
    })
    .from(stockAdjustment)
    .leftJoin(
      dealerListing,
      eq(stockAdjustment.dealerListingId, dealerListing.id),
    )
    .leftJoin(part, eq(dealerListing.partId, part.id))
    .orderBy(desc(stockAdjustment.createdAt))
    .limit(100);

  return NextResponse.json({ adjustments: rows });
}
