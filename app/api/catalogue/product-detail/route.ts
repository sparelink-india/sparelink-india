import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import {
  dealer,
  dealerListing,
  firm,
  inventory,
  part,
  partCategory,
  partVehicleCompatibility,
  vehicle,
} from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { catalogueGalleryPublicPaths } from "@/lib/catalogue-image-index";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { publicListingPrice } from "@/lib/party-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import {
  applyPensolNet,
  isPensolProduct,
  resolvePensolDiscount,
} from "@/lib/pensol-pricing";
import { getCustomerCatalogueImageUrl } from "@/lib/source-catalogue";

type Spec = Record<string, unknown>;

function parseSpec(raw: string | null | undefined): Spec {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Spec;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\s*(?:\||;|\n)\s*/)
      .map((item) => item.trim())
      .filter((item) => item && !/^(n\/?a\.?|na|not listed|nil|-)$/i.test(item));
  }
  return [];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function specText(spec: Spec, key: string): string {
  const value = spec[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const partId = request.nextUrl.searchParams.get("partId")?.trim() ?? "";
  const partNumber = request.nextUrl.searchParams.get("partNumber")?.trim() ?? "";
  if (!partId && !partNumber) {
    return NextResponse.json({ error: "partId or partNumber is required" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      description: part.description,
      brand: part.brand,
      oemNumber: part.oemNumber,
      alternatePartNumbers: part.alternatePartNumbers,
      specifications: part.specifications,
      categoryName: partCategory.name,
      isPublished: part.isPublished,
    })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .where(partId ? eq(part.id, partId) : eq(part.partNumber, partNumber))
    .limit(1);

  if (!row || row.isPublished === false) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const spec = parseSpec(row.specifications);
  const session = await getServerSession();
  const isAdmin = session?.user?.role === "admin";
  const pricing = await resolveStorefrontPricing(session);
  const revealPensolRates = session?.user?.role === "buyer";
  const pensolConfigs = await resolvePensolConfigsForUser(
    revealPensolRates ? session.user.id : null,
  );

  const listings = await db
    .select({
      id: dealerListing.id,
      partId: dealerListing.partId,
      dealerId: dealerListing.dealerId,
      dealerName: dealer.businessName,
      firmId: dealerListing.firmId,
      firmName: firm.name,
      firmCode: firm.code,
      sku: dealerListing.sku,
      pricePaise: dealerListing.pricePaise,
      mrpPaise: dealerListing.mrpPaise,
      status: dealerListing.status,
      stock: inventory.quantity,
    })
    .from(dealerListing)
    .innerJoin(dealer, eq(dealerListing.dealerId, dealer.id))
    .leftJoin(firm, eq(dealerListing.firmId, firm.id))
    .leftJoin(inventory, eq(dealerListing.id, inventory.dealerListingId))
    .where(
      isAdmin
        ? eq(dealerListing.partId, row.id)
        : and(eq(dealerListing.partId, row.id), eq(dealerListing.status, "active")),
    );

  const vehicles = await db
    .select({
      vehicleId: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
    })
    .from(partVehicleCompatibility)
    .innerJoin(vehicle, eq(partVehicleCompatibility.vehicleId, vehicle.id))
    .where(eq(partVehicleCompatibility.partId, row.id));

  const gstFromSpec =
    spec.gst === null || spec.gst === undefined || spec.gst === ""
      ? null
      : Number(spec.gst);
  const gstRate =
    gstFromSpec != null && !Number.isNaN(gstFromSpec)
      ? gstFromSpec
      : extractGSTRate(row.description);

  const skuCandidates = uniqueStrings(
    [listings[0]?.sku, row.partNumber].filter((item): item is string => Boolean(item)),
  );
  const imageUrls = uniqueStrings(
    skuCandidates.flatMap((sku) => catalogueGalleryPublicPaths(sku)),
  );
  const specGallery = asStringList(spec.gallery_images);
  for (const file of specGallery) {
    const url = getCustomerCatalogueImageUrl(file.replace(/\.[a-z0-9]+$/i, "")) ||
      (file.startsWith("/") ? file : `/catalogue-images/${encodeURIComponent(file)}`);
    if (url && !imageUrls.includes(url)) imageUrls.push(url);
  }
  const primary = getCustomerCatalogueImageUrl(listings[0]?.sku || "") ||
    getCustomerCatalogueImageUrl(row.partNumber);
  if (primary && !imageUrls.includes(primary)) imageUrls.unshift(primary);

  const oemNumbers = uniqueStrings([
    ...asStringList(row.oemNumber),
    ...asStringList(spec.oem),
    ...asStringList(spec.reference_no),
  ]);
  const referenceNumbers = uniqueStrings([
    ...asStringList(row.alternatePartNumbers),
    ...asStringList(spec.reference_nos),
    ...asStringList(spec.meko_part_numbers),
  ]);
  const application = specText(spec, "application") || specText(spec, "compatible_with") || row.description || "";
  const compatibilityLines = uniqueStrings([
    ...vehicles.map((item) => [item.make, item.model, item.variant].filter(Boolean).join(" ")),
    ...application
      .split(/\n+/)
      .map((line) => line.replace(/^[•\-*✓]\s*/, "").trim())
      .filter(Boolean),
  ]);

  const specificationRows: { label: string; value: string }[] = [];
  const specPairs: Array<[string, string]> = [
    ["Manufacturer", specText(spec, "manufacturer")],
    ["Subcategory", specText(spec, "subcategory")],
    ["Fulfilled by", specText(spec, "fulfilled_by")],
    ["Source", specText(spec, "source_url") || specText(spec, "source")],
    ["HSN", spec.hsn != null ? String(spec.hsn) : ""],
    ["UOM", spec.uom != null ? String(spec.uom) : ""],
    ["MOQ", spec.moq != null ? String(spec.moq) : ""],
  ];
  for (const [label, value] of specPairs) {
    if (value) specificationRows.push({ label, value });
  }

  const features = uniqueStrings([
    ...asStringList(spec.vehicle_types),
    ...asStringList(spec.vehicle_brands),
    specText(spec, "subcategory"),
  ]);

  const pricedListings = listings.map((listing) => {
    const pensol = isPensolProduct({ brand: row.brand, name: row.name });
    const resolved = resolvePensolDiscount({
      isPensol: pensol,
      sku: listing.sku,
      categoryName: row.categoryName,
      name: row.name,
      uom: spec.uom != null ? String(spec.uom) : null,
      specifications: row.specifications,
      customerConfig: revealPensolRates ? pensolConfigs.customerConfig : null,
      commonConfig: pensolConfigs.commonConfig,
    });
    const priced = publicListingPrice(
      listing.pricePaise,
      gstRate,
      pensol ? 0 : pricing.effectiveDiscountPercent,
    );
    const cashNet =
      pensol && revealPensolRates && resolved.packUnits
        ? applyPensolNet(
            listing.pricePaise,
            resolved.cashDiscountPaisePerUnit,
            resolved.packUnits,
            1,
          ).netInclusivePaise
        : priced.netInclusivePaise;
    const creditNet =
      pensol && revealPensolRates && resolved.packUnits
        ? applyPensolNet(
            listing.pricePaise,
            resolved.creditDiscountPaisePerUnit,
            resolved.packUnits,
            1,
          ).netInclusivePaise
        : priced.netInclusivePaise;
    return {
      id: listing.id,
      dealerId: listing.dealerId,
      dealerName: listing.dealerName,
      firmId: listing.firmId,
      firmName: listing.firmName,
      firmCode: listing.firmCode,
      sku: listing.sku,
      pricePaise: listing.pricePaise,
      mrpPaise: listing.mrpPaise,
      status: listing.status,
      stock: listing.stock,
      gstRate,
      listInclusivePaise: priced.listInclusivePaise,
      netInclusivePaise: priced.netInclusivePaise,
      discountPercent: priced.discountPercent,
      isPensol: pensol,
      pensolUnit: resolved.unit,
      pensolCashNetInclusivePaise: revealPensolRates ? cashNet : null,
      pensolCreditNetInclusivePaise: revealPensolRates ? creditNet : null,
      imageUrl: getCustomerCatalogueImageUrl(listing.sku || row.partNumber),
    };
  });

  return NextResponse.json({
    id: row.id,
    partNumber: row.partNumber,
    name: row.name,
    description: row.description || application,
    brand: row.brand,
    category: row.categoryName,
    subcategory: specText(spec, "subcategory"),
    oemNumbers,
    referenceNumbers,
    application,
    compatibilityLines,
    vehicles,
    features,
    specificationRows,
    moreInformation: {
      sourceUrl: specText(spec, "source_url"),
      source: specText(spec, "source"),
      fulfilledBy: specText(spec, "fulfilled_by"),
      subcategory: specText(spec, "subcategory"),
    },
    imageUrls,
    listings: pricedListings,
  });
}
