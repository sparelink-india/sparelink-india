import { and, eq, inArray } from "drizzle-orm";
import {
  dealerListing,
  inventory,
  part,
} from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { isAllowedFirmId } from "@/lib/firms";
import { computeInclusiveLine } from "@/lib/b2b-lines";

export type ResolvedListingLine = {
  dealerListingId: string;
  partId: string;
  partNumber: string;
  partName: string;
  sku: string | null;
  firmId: string | null;
  unitPricePaise: number;
  gstRate: number;
  quantity: number;
  lineGstPaise: number;
  lineTotalPaise: number;
  stock: number | null;
};

export async function loadActiveListingById(listingId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: dealerListing.id,
      firmId: dealerListing.firmId,
      partId: dealerListing.partId,
      sku: dealerListing.sku,
      pricePaise: dealerListing.pricePaise,
      status: dealerListing.status,
      partNumber: part.partNumber,
      partName: part.name,
      partDescription: part.description,
      stock: inventory.quantity,
    })
    .from(dealerListing)
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(
      and(eq(dealerListing.id, listingId), eq(dealerListing.status, "active")),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function loadActiveListingsByPartNumbers(partNumbers: string[]) {
  const unique = [...new Set(partNumbers.map((p) => p.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map<string, Awaited<ReturnType<typeof loadActiveListingById>>>();

  const db = getDb();
  const rows = await db
    .select({
      id: dealerListing.id,
      firmId: dealerListing.firmId,
      partId: dealerListing.partId,
      sku: dealerListing.sku,
      pricePaise: dealerListing.pricePaise,
      status: dealerListing.status,
      partNumber: part.partNumber,
      partName: part.name,
      partDescription: part.description,
      stock: inventory.quantity,
    })
    .from(dealerListing)
    .innerJoin(part, eq(dealerListing.partId, part.id))
    .leftJoin(inventory, eq(inventory.dealerListingId, dealerListing.id))
    .where(
      and(
        eq(dealerListing.status, "active"),
        inArray(part.partNumber, unique),
      ),
    );

  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    // Prefer allowed firm listings; first win otherwise.
    const existing = map.get(row.partNumber);
    if (!existing) {
      map.set(row.partNumber, row);
      continue;
    }
    if (
      row.firmId &&
      isAllowedFirmId(row.firmId) &&
      !(existing.firmId && isAllowedFirmId(existing.firmId))
    ) {
      map.set(row.partNumber, row);
    }
  }
  return map;
}

export function resolveSalesLineFromListing(
  listing: NonNullable<Awaited<ReturnType<typeof loadActiveListingById>>>,
  quantity: number,
  unitInclusiveOverridePaise?: number,
): ResolvedListingLine {
  const gstRate = extractGSTRate(listing.partDescription);
  const unit =
    typeof unitInclusiveOverridePaise === "number" &&
    Number.isFinite(unitInclusiveOverridePaise)
      ? Math.max(0, Math.round(unitInclusiveOverridePaise))
      : listing.pricePaise;
  const priced = computeInclusiveLine({
    unitInclusivePaise: unit,
    quantity,
    gstRate,
  });
  return {
    dealerListingId: listing.id,
    partId: listing.partId,
    partNumber: listing.partNumber,
    partName: listing.partName,
    sku: listing.sku,
    firmId: listing.firmId,
    unitPricePaise: priced.unitInclusivePaise,
    gstRate: priced.gstRate,
    quantity: priced.quantity,
    lineGstPaise: priced.lineGstPaise,
    lineTotalPaise: priced.lineTotalPaise,
    stock: listing.stock,
  };
}
