import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";

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
import { getBrandLogo } from "@/lib/brand-logo";
import { catalogueGalleryImageUrls } from "@/lib/catalogue-image-index";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { getDb } from "@/lib/db";
import { extractGSTRate } from "@/lib/gst";
import { applyPensolNet, isPensolProduct, resolvePensolDiscount } from "@/lib/pensol-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import { publicListingPrice } from "@/lib/party-pricing";
import {
  buildProductSpecCards,
  collectCompatibility,
  displayProductTitle,
  excludeKnownIds,
  extractSpecificationEntries,
  flattenReferenceValues,
  formatVehicleFitment,
  isGenuine360Sequence,
  shouldShowDescription,
  uniqueNonEmpty,
} from "@/lib/product-detail-fields";
import { isCustomerVisibleProduct } from "@/lib/ci-sync/types";

type PartSpec = Record<string, unknown>;

function parsePartSpec(raw: string | null | undefined): PartSpec {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as PartSpec)
      : {};
  } catch {
    return {};
  }
}

function specText(spec: PartSpec, key: string): string | null {
  const value = spec[key];
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    return text || null;
  }
  if (Array.isArray(value)) {
    const items = uniqueNonEmpty(value.map((item) => String(item)));
    return items.length ? items.join(" ") : null;
  }
  return null;
}

function specList(spec: PartSpec, key: string): string[] {
  const value = spec[key];
  if (Array.isArray(value)) return uniqueNonEmpty(value.map((item) => String(item)));
  if (typeof value === "string") return uniqueNonEmpty(value.split(/\s*(?:\||\n)\s*/));
  return [];
}

function resolveGallery(...candidates: Array<string | null | undefined>) {
  const urls: Array<{ imageUrl: string; thumbUrl: string | null; mediumUrl: string | null }> =
    [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (/^https?:/i.test(candidate)) continue;
    for (const item of catalogueGalleryImageUrls(candidate)) {
      if (seen.has(item.imageUrl)) continue;
      seen.add(item.imageUrl);
      urls.push(item);
    }
  }
  return urls;
}

export async function GET(request: NextRequest) {
  const partId = request.nextUrl.searchParams.get("partId")?.trim() || "";
  const sku = request.nextUrl.searchParams.get("sku")?.trim() || "";
  const partNumber =
    request.nextUrl.searchParams.get("partNumber")?.trim() || sku;

  if (!partId && !partNumber) {
    return NextResponse.json({ error: "partId or sku is required" }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        description: part.description,
        brand: part.brand,
        oemNumber: part.oemNumber,
        alternatePartNumbers: part.alternatePartNumbers,
        warrantyMonths: part.warrantyMonths,
        specifications: part.specifications,
        categoryName: partCategory.name,
        isPublished: part.isPublished,
        approvalStatus: part.approvalStatus,
      })
      .from(part)
      .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
      .where(
        partId
          ? eq(part.id, partId)
          : or(eq(part.partNumber, partNumber), eq(part.slug, partNumber)),
      )
      .limit(1);

    const dbPart = rows[0];
    const session = await getServerSession();
    const isAdmin = session?.user?.role === "admin";
    if (
      !dbPart ||
      (!isAdmin &&
        !isCustomerVisibleProduct({
          isPublished: dbPart.isPublished,
          approvalStatus: dbPart.approvalStatus,
        }))
    ) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const pricing = await resolveStorefrontPricing(session);
    const revealPensolRates = session?.user?.role === "buyer";
    const pensolConfigs = await resolvePensolConfigsForUser(
      revealPensolRates ? session.user.id : null,
    );

    const listingRows = await db
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
          ? eq(dealerListing.partId, dbPart.id)
          : and(eq(dealerListing.partId, dbPart.id), eq(dealerListing.status, "active")),
      );

    const vehicles = await db
      .select({
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant,
        yearFrom: vehicle.yearFrom,
        yearTo: vehicle.yearTo,
      })
      .from(partVehicleCompatibility)
      .innerJoin(vehicle, eq(partVehicleCompatibility.vehicleId, vehicle.id))
      .where(eq(partVehicleCompatibility.partId, dbPart.id));

    const spec = parsePartSpec(dbPart.specifications);
    const gstFromSpec =
      spec.gst === null || spec.gst === undefined || spec.gst === ""
        ? null
        : Number(spec.gst);
    const gstRate =
      gstFromSpec != null && !Number.isNaN(gstFromSpec)
        ? gstFromSpec
        : extractGSTRate(dbPart.description);

    const listings = listingRows.map((listing) => {
      const pensol = isPensolProduct({
        brand: dbPart.brand,
        name: dbPart.name,
      });
      const resolved = resolvePensolDiscount({
        isPensol: pensol,
        sku: listing.sku,
        categoryName: dbPart.categoryName,
        name: dbPart.name,
        uom: spec.uom != null ? String(spec.uom) : null,
        specifications: dbPart.specifications,
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
        dealerName: listing.dealerName,
        firmName: listing.firmName,
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
        pensolCashDiscountPaisePerUnit: revealPensolRates
          ? resolved.cashDiscountPaisePerUnit
          : null,
        pensolCreditDiscountPaisePerUnit: revealPensolRates
          ? resolved.creditDiscountPaisePerUnit
          : null,
        pensolCashNetInclusivePaise: revealPensolRates ? cashNet : null,
        pensolCreditNetInclusivePaise: revealPensolRates ? creditNet : null,
      };
    });

    const galleryKeys = specList(spec, "gallery_images").map((file) =>
      file.replace(/\.[a-z0-9]+$/i, ""),
    );
    const gallery = resolveGallery(
      listingRows[0]?.sku,
      dbPart.partNumber,
      ...galleryKeys,
    );
    const images = gallery.map((item) => item.imageUrl);
    const thumbUrls = gallery.map((item) => item.thumbUrl);
    const mediumUrls = gallery.map((item) => item.mediumUrl);
    const title = displayProductTitle(dbPart.name, dbPart.partNumber);
    const description = dbPart.description;
    const vehicleLabels = uniqueNonEmpty(
      vehicles.map((row) => formatVehicleFitment(row)),
    );
    const oemNumbers = excludeKnownIds(
      flattenReferenceValues([
        dbPart.oemNumber,
        specText(spec, "oem"),
        ...specList(spec, "oem"),
      ]),
      dbPart.partNumber,
    );
    const references = excludeKnownIds(
      flattenReferenceValues([
        dbPart.alternatePartNumbers,
        specText(spec, "reference_no"),
        ...specList(spec, "reference_nos"),
      ]),
      dbPart.partNumber,
      ...oemNumbers,
    );
    const compatibility = collectCompatibility({
      vehicles: vehicleLabels,
      vehicleBrands: specList(spec, "vehicle_brands"),
      vehicleTypes: specList(spec, "vehicle_types"),
      compatibleWith: specText(spec, "compatible_with") || specText(spec, "application"),
      title,
      partNumber: dbPart.partNumber,
    });
    const specifications = extractSpecificationEntries(spec);
    const brandLogo = getBrandLogo(dbPart.brand);
    const categoryName = dbPart.categoryName;
    const cards = buildProductSpecCards({
      partNumber: dbPart.partNumber,
      brand: dbPart.brand,
      category: categoryName,
      oemNumber: oemNumbers.join(" · "),
      references,
      vehicles: compatibility,
      warrantyMonths: dbPart.warrantyMonths,
      hsn: spec.hsn != null && spec.hsn !== "" ? String(spec.hsn) : null,
      moq: spec.moq == null ? null : String(spec.moq),
      uom: spec.uom == null ? null : String(spec.uom),
      hideBrand: Boolean(brandLogo),
      hideCategory: Boolean(categoryName),
      includeLongFields: false,
    });

    return NextResponse.json({
      part: {
        id: dbPart.id,
        title,
        name: dbPart.name,
        partNumber: dbPart.partNumber,
        brand: dbPart.brand,
        category: categoryName,
        subtitle:
          categoryName && categoryName.toLowerCase() !== String(dbPart.brand || "").toLowerCase()
            ? categoryName
            : null,
        description: shouldShowDescription(description, title, dbPart.partNumber)
          ? description
          : null,
      },
      brandLogo,
      images,
      thumbUrls,
      mediumUrls,
      has360: Boolean(spec.has_360) || isGenuine360Sequence(images),
      cards,
      oemNumbers,
      references,
      compatibility,
      specifications,
      listings,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load product" }, { status: 500 });
  }
}
