import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";

import { catalogueSourceItem, dealerListing, part } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { approveSourceItem } from "@/lib/ci-sync/db-store";
import { APPROVAL_STATUS, CI_SOURCE_KEY } from "@/lib/ci-sync/types";
import { requireAdminApi } from "@/lib/require-role";
import { typesense } from "@/lib/typesense";
import { partNumberSearchText } from "@/lib/search-intent";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const status = request.nextUrl.searchParams.get("status") || "pending";
  const db = getDb();

  try {
    const baseSelect = {
      id: catalogueSourceItem.id,
      sourceSku: catalogueSourceItem.sourceSku,
      name: catalogueSourceItem.name,
      brand: catalogueSourceItem.brand,
      manufacturer: catalogueSourceItem.manufacturer,
      sourcePricePaise: catalogueSourceItem.sourcePricePaise,
      sourceStatus: catalogueSourceItem.sourceStatus,
      approvalStatus: catalogueSourceItem.approvalStatus,
      sourceImageUrl: catalogueSourceItem.sourceImageUrl,
      partId: catalogueSourceItem.partId,
      sourcePriceChangedAt: catalogueSourceItem.sourcePriceChangedAt,
      updatedAt: catalogueSourceItem.updatedAt,
    };

    const rows =
      status === "updated"
        ? await db
            .select(baseSelect)
            .from(catalogueSourceItem)
            .where(eq(catalogueSourceItem.sourceStatus, "SOURCE_UPDATED"))
            .orderBy(desc(catalogueSourceItem.updatedAt))
            .limit(100)
        : status === "removed"
          ? await db
              .select(baseSelect)
              .from(catalogueSourceItem)
              .where(eq(catalogueSourceItem.sourceStatus, "SOURCE_REMOVED"))
              .orderBy(desc(catalogueSourceItem.updatedAt))
              .limit(100)
          : await db
              .select(baseSelect)
              .from(catalogueSourceItem)
              .where(
                eq(catalogueSourceItem.approvalStatus, APPROVAL_STATUS.PENDING_ADMIN_APPROVAL),
              )
              .orderBy(desc(catalogueSourceItem.updatedAt))
              .limit(100);

    const partIds = rows.map((r) => r.partId).filter((id): id is string => Boolean(id));
    const sellingByPart = new Map<string, number>();
    if (partIds.length) {
      const allListings = await db
        .select({
          partId: dealerListing.partId,
          pricePaise: dealerListing.pricePaise,
        })
        .from(dealerListing)
        .where(inArray(dealerListing.partId, partIds));
      for (const listing of allListings) {
        if (!sellingByPart.has(listing.partId)) {
          sellingByPart.set(listing.partId, listing.pricePaise);
        }
      }
    }

    return NextResponse.json({
      sourceKey: CI_SOURCE_KEY,
      status,
      items: rows.map((row) => ({
        ...row,
        sparelinkPricePaise: row.partId ? sellingByPart.get(row.partId) ?? null : null,
        sourcePriceChanged: Boolean(row.sourcePriceChangedAt),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list source items" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: {
    sourceItemId?: string;
    sellingPricePaise?: number;
    mrpPaise?: number | null;
    firmId?: string;
    dealerId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sourceItemId || !body.firmId || !body.dealerId) {
    return NextResponse.json(
      { error: "sourceItemId, firmId, and dealerId are required" },
      { status: 400 },
    );
  }
  if (
    body.sellingPricePaise == null ||
    !Number.isFinite(body.sellingPricePaise) ||
    body.sellingPricePaise <= 0
  ) {
    return NextResponse.json(
      { error: "SpareLink sellingPricePaise is required and must be > 0" },
      { status: 400 },
    );
  }

  try {
    const approved = await approveSourceItem({
      sourceItemId: body.sourceItemId,
      sellingPricePaise: Math.round(body.sellingPricePaise),
      mrpPaise: body.mrpPaise ?? null,
      firmId: body.firmId,
      dealerId: body.dealerId,
    });

    if (typesense && approved.partId) {
      try {
        const db = getDb();
        const [row] = await db
          .select({
            id: part.id,
            partNumber: part.partNumber,
            name: part.name,
            description: part.description,
            brand: part.brand,
          })
          .from(part)
          .where(eq(part.id, approved.partId))
          .limit(1);
        if (row) {
          await typesense.collections("parts").documents().upsert({
            id: row.id,
            part_number: row.partNumber,
            part_number_search: partNumberSearchText(row.partNumber),
            name: row.name,
            description: row.description || "",
            brand: row.brand || "",
            category: "",
            vehicle_ids: [],
          });
        }
      } catch {
        // Approval succeeded even if index lags.
      }
    }

    return NextResponse.json({
      ok: true,
      ...approved,
      note: "Customer sees SpareLink selling price only; source price remains admin-only.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approval failed" },
      { status: 400 },
    );
  }
}
