import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  filterAutocompleteHits,
  parseSearchIntent,
  rankSearchHits,
} from "@/lib/search-intent";
import { typesense } from "@/lib/typesense";
import { getDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth-server";
import { getCustomerCatalogueImageUrl, loadSourceCatalogue } from "@/lib/source-catalogue";
import { extractGSTRate } from "@/lib/gst";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { publicListingPrice } from "@/lib/party-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import {
  applyPensolNet,
  isPensolProduct,
  resolvePensolDiscount,
} from "@/lib/pensol-pricing";
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
import {
  filterModelVehicleIds,
  findFitmentBrand,
  findFitmentModel,
  groupVehiclesByBrand,
  matchVehiclesForQuery,
} from "@/lib/vehicle-fitment";
import {
  findStorefrontCategory,
  typesenseCategoryFilter,
} from "@/lib/storefront-categories";
import {
  classifyWaterPumpSegment,
  isWaterPumpProduct,
  productMatchesOtherType,
  CABLE_TYPE_DEFS,
  FILTER_TYPE_DEFS,
  type WaterPumpSegment,
} from "@/lib/category-navigation";

type PartDocument = {
  id?: string;
  part_number?: string;
  name?: string;
  description?: string;
  brand?: string;
  category?: string;
};

type PartSpec = {
  moq?: string | number | null;
  uom?: string | null;
  gst?: string | number | null;
  hsn?: string | null;
};

function parsePartSpec(raw: string | null | undefined): PartSpec {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PartSpec;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function resolveImageUrl(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const url = getCustomerCatalogueImageUrl(candidate);
    if (url) return url;
  }
  return null;
}

function sanitizeSearchId(value: string): string | null {
  const trimmed = value.trim();
  return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : null;
}

function typesenseIdFilter(ids: string[]): string {
  return `id:=[${ids.join(",")}]`;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const categoryNameParam = request.nextUrl.searchParams.get("categoryName")?.trim() ?? "";
  const nameContains = request.nextUrl.searchParams.get("nameContains")?.trim() ?? "";
  const otherType = request.nextUrl.searchParams.get("otherType")?.trim() ?? "";
  const segmentParam = (request.nextUrl.searchParams.get("segment")?.trim() ?? "") as
    | WaterPumpSegment
    | "";
  const vehicleId = sanitizeSearchId(request.nextUrl.searchParams.get("vehicleId") ?? "");
  const makeParam = request.nextUrl.searchParams.get("make")?.trim() ?? "";
  const modelParam = request.nextUrl.searchParams.get("model")?.trim() ?? "";
  const fuelParam = request.nextUrl.searchParams.get("fuel")?.trim() ?? "";
  const variantParam = request.nextUrl.searchParams.get("variant")?.trim() ?? "";
  const vehicleIdsParam = (request.nextUrl.searchParams.get("vehicleIds") ?? "")
    .split(",")
    .map((item) => sanitizeSearchId(item))
    .filter((item): item is string => Boolean(item));
  const suggest = request.nextUrl.searchParams.get("suggest") === "1";
  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const requestedPerPage = Number(request.nextUrl.searchParams.get("perPage") ?? (suggest ? "12" : "24"));
  const page =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.min(Math.floor(requestedPage), 500)
      : 1;
  const perPage = suggest
    ? Math.min(12, Math.max(1, Number.isFinite(requestedPerPage) ? Math.floor(requestedPerPage) : 12))
    : Math.min(50, Math.max(1, Number.isFinite(requestedPerPage) ? Math.floor(requestedPerPage) : 24));

  const categorySlug = (request.nextUrl.searchParams.get("category") ?? "").trim().toLowerCase();
  const storefrontCategory = categorySlug ? findStorefrontCategory(categorySlug) : null;
  const hasVehicleParams = Boolean(
    vehicleId || vehicleIdsParam.length || (makeParam && modelParam),
  );
  const hasCategoryScope = Boolean(
    storefrontCategory || categoryNameParam || nameContains || segmentParam,
  );

  if (!query && !hasVehicleParams && !hasCategoryScope) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  if (query.length > 200) {
    return NextResponse.json(
      { error: "Search query is too long" },
      { status: 400 },
    );
  }

  if (!typesense) {
    return NextResponse.json(
      { error: "Search service is not configured" },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    const intent = parseSearchIntent(query || nameContains || "*");
    let scopedVehicleIds: string[] = [];
    let matchedFromQuery = false;

    if (!suggest) {
      if (vehicleId) scopedVehicleIds = [vehicleId];
      if (vehicleIdsParam.length) {
        scopedVehicleIds = [...new Set([...scopedVehicleIds, ...vehicleIdsParam])];
      }
      if (makeParam && modelParam) {
        const catalog = groupVehiclesByBrand(
          await db
            .select({
              id: vehicle.id,
              make: vehicle.make,
              model: vehicle.model,
              variant: vehicle.variant,
            })
            .from(vehicle),
        );
        const brand = findFitmentBrand(catalog, makeParam) ?? catalog.find((item) => item.slug === makeParam || item.make.toLowerCase() === makeParam.toLowerCase());
        const model = brand
          ? findFitmentModel(brand, modelParam) ??
            brand.models.find((item) => item.modelSlug === modelParam || item.model.toLowerCase() === modelParam.toLowerCase())
          : null;
        if (model) {
          scopedVehicleIds = filterModelVehicleIds(model, {
            fuel: fuelParam || null,
            variant: variantParam || null,
          });
        }
      } else if (
        !storefrontCategory &&
        !categoryNameParam &&
        !nameContains &&
        !segmentParam &&
        !scopedVehicleIds.length &&
        query &&
        !intent.isPartNumberQuery &&
        !intent.hasProductIntent
      ) {
        const catalogVehicles = await db
          .select({
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            variant: vehicle.variant,
          })
          .from(vehicle);
        const matched = matchVehiclesForQuery(query, catalogVehicles);
        if (matched) {
          scopedVehicleIds = matched.vehicleIds;
          matchedFromQuery = true;
        }
      }
    }

    const scopedPartIds = scopedVehicleIds.length
      ? [
          ...new Set(
            (
              await db
                .select({ partId: partVehicleCompatibility.partId })
                .from(partVehicleCompatibility)
                .where(inArray(partVehicleCompatibility.vehicleId, scopedVehicleIds))
            ).map((row) => row.partId),
          ),
        ]
      : null;

    if (scopedPartIds && scopedPartIds.length === 0) {
      return NextResponse.json({
        results: [],
        found: 0,
        page,
        perPage,
      });
    }

    let categoryNames: string[] = [];
    if (storefrontCategory) {
      categoryNames = (
        await db
          .select({ name: partCategory.name })
          .from(partCategory)
          .where(inArray(partCategory.slug, storefrontCategory.sourceSlugs))
      )
        .map((row) => row.name.trim())
        .filter(Boolean);
      if (categoryNames.length === 0) {
        return NextResponse.json({
          results: [],
          found: 0,
          page,
          perPage,
        });
      }
    } else if (categoryNameParam) {
      categoryNames = [categoryNameParam];
    }

    const categoryFilter = typesenseCategoryFilter(categoryNames);
    const filterClauses = [
      scopedPartIds ? typesenseIdFilter(scopedPartIds) : null,
      categoryFilter,
    ].filter((item): item is string => Boolean(item));

    const usePostFilter = Boolean(segmentParam || otherType);
    const useVehicleFilter = Boolean(scopedPartIds) && !suggest;
    const browseQuery = nameContains || query;
    const typesenseQuery =
      useVehicleFilter && (matchedFromQuery || !browseQuery)
        ? "*"
        : browseQuery
          ? parseSearchIntent(browseQuery).typesenseQuery
          : "*";
    const suggestFetchSize = Math.min(50, Math.max(perPage, 24));
    const searchResults = await typesense
      .collections("parts")
      .documents()
      .search({
        q: typesenseQuery,
        query_by: "part_number,name,description,brand,category",
        query_by_weights: "6,5,1,3,2",
        filter_by: filterClauses.length ? filterClauses.join(" && ") : undefined,
        page: useVehicleFilter || usePostFilter ? 1 : page,
        per_page: useVehicleFilter || usePostFilter
          ? Math.min(250, Math.max(scopedPartIds?.length ?? 24, perPage))
          : suggest
            ? suggestFetchSize
            : perPage,
        prefix: true,
        num_typos: intent.isPartNumberQuery ? 0 : 1,
        prioritize_exact_match: true,
        prioritize_token_position: true,
      });

    const hits = searchResults.hits ?? [];
    const typesenseFound =
      typeof searchResults.found === "number" ? searchResults.found : hits.length;
    const documentFromHit = (hit: (typeof hits)[number]): PartDocument =>
      ((hit.document as PartDocument | undefined) ?? {}) as PartDocument;

    if (suggest) {
      const suggested = filterAutocompleteHits(intent, hits, documentFromHit, perPage);
      return NextResponse.json({
        results: suggested.map((hit, index) => {
          const doc = documentFromHit(hit);
          return {
            document: {
              id: String((hit.document as PartDocument | undefined)?.id || doc.part_number || index),
              part_number: doc.part_number,
              name: doc.name,
              brand: doc.brand,
              category: doc.category,
            },
          };
        }),
        found: suggested.length,
        page,
        perPage,
        mode: "suggest",
      });
    }

    const rankedHits = rankSearchHits(intent, hits, documentFromHit);
    const documents = rankedHits.map(documentFromHit);

    const session = await getServerSession();
    const isAdmin = session?.user?.role === "admin";
    const pricing = await resolveStorefrontPricing(session);
    const revealPensolRates = session?.user?.role === "buyer";
    const pensolConfigs = await resolvePensolConfigsForUser(
      revealPensolRates ? session.user.id : null,
    );
    const typesenseIds = [
      ...new Set(documents.map((doc) => doc.id).filter((id): id is string => Boolean(id))),
    ];
    const partNumbers = [
      ...new Set(
        documents
          .map((doc) => doc.part_number?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const partConditions = [];
    if (typesenseIds.length) partConditions.push(inArray(part.id, typesenseIds));
    if (partNumbers.length) partConditions.push(inArray(part.partNumber, partNumbers));

    const dbParts = partConditions.length
      ? await db
          .select({
            id: part.id,
            partNumber: part.partNumber,
            name: part.name,
            description: part.description,
            brand: part.brand,
            specifications: part.specifications,
            isPublished: part.isPublished,
          })
          .from(part)
          .where(or(...partConditions))
      : [];

    const dbPartById = new Map(dbParts.map((row) => [row.id, row]));
    const dbPartByNumber = new Map(dbParts.map((row) => [row.partNumber, row]));

    function resolveDbPart(doc: PartDocument) {
      return (
        (doc.id ? dbPartById.get(doc.id) : undefined) ||
        (doc.part_number ? dbPartByNumber.get(doc.part_number) : undefined)
      );
    }

    const resolvedPartIds = [
      ...new Set(
        documents
          .map((doc) => resolveDbPart(doc)?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const compatibleIdSet = scopedPartIds ? new Set(scopedPartIds) : null;
    const matchedPartIds = compatibleIdSet
      ? resolvedPartIds.filter((partId) => compatibleIdSet.has(partId))
      : resolvedPartIds;

    const listings =
      matchedPartIds.length > 0
        ? await db
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
            .leftJoin(
              inventory,
              eq(dealerListing.id, inventory.dealerListingId),
            )
            .where(
              isAdmin
                ? inArray(dealerListing.partId, matchedPartIds)
                : and(
                    inArray(dealerListing.partId, matchedPartIds),
                    eq(dealerListing.status, "active"),
                  ),
            )
        : [];

    const compatibility =
      matchedPartIds.length > 0
        ? await db
            .select({
              partId: partVehicleCompatibility.partId,
              vehicleId: vehicle.id,
              make: vehicle.make,
              model: vehicle.model,
              variant: vehicle.variant,
            })
            .from(partVehicleCompatibility)
            .innerJoin(
              vehicle,
              eq(partVehicleCompatibility.vehicleId, vehicle.id),
            )
            .where(inArray(partVehicleCompatibility.partId, matchedPartIds))
        : [];

    const listingsByPartId = new Map<string, typeof listings>();
    const compatibilityByPartId = new Map<string, typeof compatibility>();

    for (const listing of listings) {
      const existing = listingsByPartId.get(listing.partId) ?? [];
      existing.push(listing);
      listingsByPartId.set(listing.partId, existing);
    }

    for (const item of compatibility) {
      const existing = compatibilityByPartId.get(item.partId) ?? [];
      existing.push(item);
      compatibilityByPartId.set(item.partId, existing);
    }

    const results = rankedHits
      .filter((hit) => {
        const doc = (hit.document as PartDocument | undefined) ?? {};
        if (!compatibleIdSet) return true;
        const dbPart = resolveDbPart(doc);
        return dbPart ? compatibleIdSet.has(dbPart.id) : false;
      })
      .map((hit) => {
        const doc = (hit.document as PartDocument | undefined) ?? {};
        const dbPart = resolveDbPart(doc);
        const spec = parsePartSpec(dbPart?.specifications);
        const partListings = dbPart
          ? listingsByPartId.get(dbPart.id) ?? []
          : [];
        const gstFromSpec =
          spec.gst === null || spec.gst === undefined || spec.gst === ""
            ? null
            : Number(spec.gst);
        const gstRate =
          gstFromSpec != null && !Number.isNaN(gstFromSpec)
            ? gstFromSpec
            : extractGSTRate(dbPart?.description || doc.description);
        const imageUrl = resolveImageUrl(
          partListings[0]?.sku,
          dbPart?.partNumber,
          doc.part_number,
        );

        return {
          ...hit,
          document: {
            ...doc,
            id: dbPart?.id || doc.id,
            part_number: dbPart?.partNumber || doc.part_number,
            name: dbPart?.name || doc.name,
            description: dbPart?.description || doc.description,
            brand: dbPart?.brand || doc.brand,
          },
          imageUrl,
          listings: partListings.map((listing) => {
            const pensol = isPensolProduct({
              brand: dbPart?.brand || doc.brand,
              name: dbPart?.name || doc.name,
            });
            const resolved = resolvePensolDiscount({
              isPensol: pensol,
              sku: listing.sku,
              categoryName: doc.category,
              name: dbPart?.name || doc.name,
              uom: spec.uom != null ? String(spec.uom) : null,
              specifications: dbPart?.specifications,
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
            discountPaise: priced.discountPaise,
            basePaise: priced.basePaise,
            gstPaise: priced.gstPaise,
            isPensol: pensol,
            pensolCategory: resolved.category,
            pensolUnit: resolved.unit,
            pensolPackUnits: resolved.packUnits,
            pensolCashDiscountPaisePerUnit: revealPensolRates
              ? resolved.cashDiscountPaisePerUnit
              : null,
            pensolCreditDiscountPaisePerUnit: revealPensolRates
              ? resolved.creditDiscountPaisePerUnit
              : null,
            pensolCashNetInclusivePaise: revealPensolRates ? cashNet : null,
            pensolCreditNetInclusivePaise: revealPensolRates ? creditNet : null,
            moq: spec.moq ?? null,
            uom: spec.uom ?? null,
            hsn: spec.hsn ?? null,
            imageUrl: resolveImageUrl(
              listing.sku,
              dbPart?.partNumber,
              doc.part_number,
            ),
          };
          }),
          compatibleVehicles: dbPart
            ? compatibilityByPartId.get(dbPart.id) ?? []
            : [],
        };
      });

    let filteredResults = results;
    if (otherType === "cables" || otherType === "filters") {
      const defs = otherType === "cables" ? CABLE_TYPE_DEFS : FILTER_TYPE_DEFS;
      filteredResults = filteredResults.filter((hit) =>
        productMatchesOtherType(String(hit.document?.name || ""), defs),
      );
    }
    if (segmentParam) {
      const source = await loadSourceCatalogue().catch(() => []);
      const typesBySku = new Map(
        source.map((item) => [String(item.sku || ""), item.vehicleTypes || []]),
      );
      filteredResults = filteredResults.filter((hit) => {
        const doc = hit.document ?? {};
        if (!isWaterPumpProduct(doc.category, doc.name || "")) return false;
        const sku = String(hit.listings?.[0]?.sku || doc.part_number || "");
        const fromSource = typesBySku.get(sku) || [];
        const fromCompat = (hit.compatibleVehicles ?? []).map((item) => item.make);
        return (
          classifyWaterPumpSegment([...fromSource, ...fromCompat], doc.name || "") ===
          segmentParam
        );
      });
    }

    const shouldPage = useVehicleFilter || usePostFilter;
    const pagedResults = shouldPage
      ? filteredResults.slice((page - 1) * perPage, page * perPage)
      : filteredResults;
    const found = shouldPage ? filteredResults.length : typesenseFound;

    return NextResponse.json({
      results: pagedResults,
      found,
      page,
      perPage,
      pricing: {
        effectiveDiscountPercent: pricing.effectiveDiscountPercent,
        source: pricing.source,
      },
    });
  } catch {
    console.error("Parts search failed");

    return NextResponse.json(
      { error: "Unable to search parts right now. Please try again." },
      { status: 500 },
    );
  }
}
