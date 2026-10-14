import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  filterAutocompleteHits,
  parseSearchIntent,
  partNumberDigits,
  parseExactHsnQuery,
  rankSearchHits,
} from "@/lib/search-intent";
import { isCustomerVisibleProduct } from "@/lib/ci-sync/types";
import { getDb } from "@/lib/db";
import { getServerSession } from "@/lib/auth-server";
import { catalogueImageUrls } from "@/lib/catalogue-image-index";
import { loadSourceCatalogue } from "@/lib/source-catalogue";
import { extractGSTRate } from "@/lib/gst";
import { resolveStorefrontPricing } from "@/lib/customer-discount";
import { publicListingPrice } from "@/lib/party-pricing";
import { resolvePensolConfigsForUser } from "@/lib/pensol-discount";
import {
  parseSearchSort,
  searchPartNumbersPostgres,
  searchPartsFetch,
  searchPartsPage,
} from "@/lib/search-postgres";
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
import { isCustomerVisibleCatalogueBrand } from "@/lib/public-brands";
import {
  findStorefrontCategory,
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

/**
 * Fields the failure log is allowed to carry.
 *
 * An Axios error carries its own request: `config.url` holds the full query
 * string, `config.headers` holds `X-TYPESENSE-API-KEY`, and `request` holds the
 * serialised HTTP frame with the key again. `message` and `stack` can echo the
 * node hostname and the connection target. Logging the thrown object therefore
 * published the Typesense API key to the platform log in cleartext, which is
 * why only this fixed, enumerable shape is ever emitted.
 */
export type SearchFailureDiagnostic = {
  name: string;
  code: string | null;
  httpStatus: number | null;
  category: string;
};

type ErrorShape = {
  name?: unknown;
  code?: unknown;
  httpStatus?: unknown;
  cause?: unknown;
};

/** Error names and codes are identifiers, never free text. */
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,31}$/;

/**
 * Coarse, non-reversible classification.
 *
 * A category answers "which subsystem broke" without republishing anything the
 * caller typed or anything the server holds as a credential. The host and the
 * key are deliberately absent: they are recoverable from the Vercel environment
 * configuration, and repeating them in a log is what turned a search outage
 * into a credential disclosure.
 */
function classifySearchFailure(
  code: string | null,
  httpStatus: number | null,
): string {
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "unreachable_host";
  if (code === "ECONNREFUSED") return "connection_refused";
  if (code === "ECONNRESET") return "connection_reset";
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") return "timeout";
  if (httpStatus !== null) {
    if (httpStatus === 401 || httpStatus === 403) return "credentials_rejected";
    if (httpStatus === 404) return "collection_missing";
    if (httpStatus === 429) return "rate_limited";
    if (httpStatus >= 500) return "upstream_error";
    if (httpStatus >= 400) return "query_rejected";
  }
  return "unknown";
}

/**
 * Reduce an arbitrary thrown value to the four fields above. Never returns a
 * reference to the original error, so no nested `config`, `request`, `headers`,
 * `message` or `stack` can reach the log through this object.
 */
export function describeSearchFailure(error: unknown): SearchFailureDiagnostic {
  const shape = (
    typeof error === "object" && error !== null ? error : {}
  ) as ErrorShape;

  const rawName = typeof shape.name === "string" ? shape.name : "";
  const name = SAFE_NAME.test(rawName) ? rawName : "UnknownError";

  // Axios nests the socket-level failure one level down.
  const cause =
    typeof shape.cause === "object" && shape.cause !== null
      ? (shape.cause as ErrorShape)
      : ({} as ErrorShape);
  const rawCode =
    typeof shape.code === "string"
      ? shape.code
      : typeof cause.code === "string"
        ? cause.code
        : "";
  const code = SAFE_CODE.test(rawCode) ? rawCode : null;

  const rawStatus =
    typeof shape.httpStatus === "number"
      ? shape.httpStatus
      : typeof cause.httpStatus === "number"
        ? cause.httpStatus
        : null;
  const httpStatus =
    rawStatus !== null && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599
      ? rawStatus
      : null;

  return { name, code, httpStatus, category: classifySearchFailure(code, httpStatus) };
}

/**
 * The route's failure contract, extracted so tests can invoke it directly.
 * The failure must reach the server log — a bare `catch {}` with a literal
 * message once made every failure indistinguishable — but only as a sanitised
 * diagnostic. Nothing derived from the request, the query, the credentials or
 * the host is ever emitted. The client always sees the same generic 500.
 */
export function searchFailureResponse(error: unknown) {
  console.error("Parts search failed:", describeSearchFailure(error));

  return NextResponse.json(
    { error: "Unable to search parts right now. Please try again." },
    { status: 500 },
  );
}

function parsePartSpec(raw: string | null | undefined): PartSpec {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as PartSpec;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function resolveImageUrls(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const urls = catalogueImageUrls(candidate);
    if (urls) return urls;
  }
  return null;
}

function sanitizeSearchId(value: string): string | null {
  const trimmed = value.trim();
  return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const brandParam = request.nextUrl.searchParams.get("brand")?.trim() ?? "";
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

  // Server-backed result ordering. Unknown keys fall back to relevance so
  // no client value can reach SQL text; the paged path below applies this,
  // while part-number/suggest flows keep their exact-first semantics.
  const sort = parseSearchSort(request.nextUrl.searchParams.get("sort") ?? undefined);
  // Stock filter over authoritative physical state (active listings with
  // sellable units). "1" keeps in-stock parts only, "0" out-of-stock only;
  // anything else leaves stock unfiltered. Firm allow-listing stays
  // enforced downstream at cart/order time.
  const inStockParam = (request.nextUrl.searchParams.get("inStock") ?? "").trim();
  const inStock = inStockParam === "1" ? true : inStockParam === "0" ? false : undefined;

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

  // PostgreSQL is the search backend: there is no separate search service
  // to be "unconfigured". A missing database surfaces from getDb() below
  // and is answered by the outer handler as an honest 500.
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

    const usePostFilter = Boolean(segmentParam || otherType);
    const useVehicleFilter = Boolean(scopedPartIds) && !suggest;
    const browseQuery = nameContains || query;
    // Intent-normalised text for PostgreSQL retrieval. "*" marks a pure
    // browse scope (vehicle/category only), which matches everything the
    // filters below allow.
    const searchText =
      useVehicleFilter && (matchedFromQuery || !browseQuery)
        ? "*"
        : browseQuery
          ? parseSearchIntent(browseQuery).typesenseQuery
          : "*";
    const suggestFetchSize = Math.min(50, Math.max(perPage, 24));
    const partNumberFetchSize = suggest
      ? suggestFetchSize
      : Math.min(250, Math.max(perPage, 100));
    const searchPerPage = useVehicleFilter || usePostFilter
      ? Math.min(250, Math.max(scopedPartIds?.length ?? 24, perPage))
      : intent.isPartNumberQuery
        ? partNumberFetchSize
        : suggest
          ? suggestFetchSize
          : perPage;

    const sessionPromise = getServerSession();
    // Resolved before retrieval so the PostgreSQL WHERE clause can apply
    // customer-visibility rules server-side. Awaiting the same promise later
    // (pricing, suggest admin check) is unaffected. Downstream visibility
    // filtering stays in place as defense in depth.
    const searchIsAdmin = (await sessionPromise)?.user?.role === "admin";

    // Shared PostgreSQL retrieval filter. Visibility, brand, category and
    // vehicle scope all live in the query; text matching is added per path.
    const pgFilterBase = {
      brand: brandParam || null,
      categoryNames,
      scopedPartIds,
      isAdmin: searchIsAdmin,
      sort,
      inStock,
    };
    const hsnQuery = parseExactHsnQuery(query);

    let searchResults;
    if (hsnQuery) {
      const hsnSession = await sessionPromise;
      const hsnIsAdmin = hsnSession?.user?.role === "admin";
      const hsnParts = await db
        .select({
          id: part.id,
          partNumber: part.partNumber,
          name: part.name,
          description: part.description,
          brand: part.brand,
          category: partCategory.name,
          isPublished: part.isPublished,
          approvalStatus: part.approvalStatus,
        })
        .from(part)
        .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
        .where(sql`${part.specifications}::jsonb ->> 'hsn' = ${hsnQuery}`);

      const visibleHsnParts = hsnIsAdmin
        ? hsnParts
        : hsnParts.filter((row) =>
            isCustomerVisibleProduct({
              isPublished: row.isPublished,
              approvalStatus: row.approvalStatus,
            }),
          );

      searchResults = visibleHsnParts.length
        ? {
            hits: visibleHsnParts.map((row) => ({
              document: {
                id: row.id,
                part_number: row.partNumber,
                name: row.name,
                description: row.description ?? undefined,
                brand: row.brand ?? undefined,
                category: row.category ?? undefined,
              },
            })),
            found: visibleHsnParts.length,
            facet_counts: [],
          }
        : intent.isPartNumberQuery && searchText !== "*"
          ? await searchPartNumbersPostgres(db, [intent.originalQuery], pgFilterBase, partNumberFetchSize)
          : await searchPartsFetch(db, { ...pgFilterBase, text: searchText }, searchPerPage);
    } else if (intent.isPartNumberQuery && searchText !== "*") {
      const digitQuery = partNumberDigits(intent.originalQuery);
      const pnQueries = [intent.originalQuery];
      if (digitQuery && digitQuery.toLowerCase() !== intent.originalQuery.toLowerCase()) {
        pnQueries.push(digitQuery);
      }
      searchResults = await searchPartNumbersPostgres(db, pnQueries, pgFilterBase, partNumberFetchSize);
    } else {
      // Paged PostgreSQL retrieval: one page of ts_rank-ordered rows plus
      // totals and facets over the full filtered set. Unpaged flows above
      // fetch a superset the route ranks and slices in memory, as before.
      searchResults =
        useVehicleFilter || usePostFilter
          ? await searchPartsFetch(db, { ...pgFilterBase, text: searchText }, searchPerPage)
          : await searchPartsPage(db, { ...pgFilterBase, text: searchText }, page, perPage);
    }

    const hits = searchResults.hits ?? [];
    const searchFound =
      typeof searchResults.found === "number" ? searchResults.found : hits.length;
    const documentFromHit = (hit: (typeof hits)[number]): PartDocument =>
      ((hit.document as PartDocument | undefined) ?? {}) as PartDocument;

    if (suggest) {
      const suggested = filterAutocompleteHits(intent, hits, documentFromHit, perPage);
      const suggestSession = await getServerSession();
      const suggestIsAdmin = suggestSession?.user?.role === "admin";

      if (suggestIsAdmin) {
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
          intent: intent.naturalLanguage
            ? {
                normalizedQuery: intent.typesenseQuery,
                side: intent.naturalLanguage.side,
                position: intent.naturalLanguage.position,
                brandHints: intent.naturalLanguage.brandHints,
                vehicleHints: intent.naturalLanguage.vehicleHints,
                productHints: intent.naturalLanguage.productHints,
              }
            : null,
        });
      }

      const suggestDocs = suggested.map(documentFromHit);
      const suggestIds = [
        ...new Set(
          suggestDocs.map((doc) => doc.id).filter((id): id is string => Boolean(id)),
        ),
      ];
      const suggestPartNumbers = [
        ...new Set(
          suggestDocs
            .map((doc) => doc.part_number?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      const suggestConditions = [];
      if (suggestIds.length) suggestConditions.push(inArray(part.id, suggestIds));
      if (suggestPartNumbers.length) {
        suggestConditions.push(inArray(part.partNumber, suggestPartNumbers));
      }
      const suggestDbParts = suggestConditions.length
        ? await db
            .select({
              id: part.id,
              partNumber: part.partNumber,
              isPublished: part.isPublished,
              approvalStatus: part.approvalStatus,
            })
            .from(part)
            .where(or(...suggestConditions))
        : [];
      const suggestById = new Map(suggestDbParts.map((row) => [row.id, row]));
      const suggestByNumber = new Map(
        suggestDbParts.map((row) => [row.partNumber, row]),
      );

      const visibleSuggested = suggested.filter((hit) => {
        const doc = documentFromHit(hit);
        const row =
          (doc.id ? suggestById.get(doc.id) : undefined) ||
          (doc.part_number ? suggestByNumber.get(doc.part_number) : undefined);
        if (!row) return false;
        return isCustomerVisibleProduct({
          isPublished: row.isPublished,
          approvalStatus: row.approvalStatus,
        });
      });

      return NextResponse.json({
        results: visibleSuggested.map((hit, index) => {
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
        found: visibleSuggested.length,
        page,
        perPage,
        mode: "suggest",
        intent: intent.naturalLanguage
          ? {
              normalizedQuery: intent.typesenseQuery,
              side: intent.naturalLanguage.side,
              position: intent.naturalLanguage.position,
              brandHints: intent.naturalLanguage.brandHints,
              vehicleHints: intent.naturalLanguage.vehicleHints,
              productHints: intent.naturalLanguage.productHints,
            }
          : null,
      });
    }

    const rankedHits = hsnQuery
      ? hits
      : rankSearchHits(intent, hits, documentFromHit);
    const documents = rankedHits.map(documentFromHit);

    const session = await sessionPromise;
    const isAdmin = session?.user?.role === "admin";
    const revealPensolRates = session?.user?.role === "buyer";
    const [pricing, pensolConfigs] = await Promise.all([
      resolveStorefrontPricing(session),
      resolvePensolConfigsForUser(revealPensolRates ? session.user.id : null),
    ]);
    const searchIds = [
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
    if (searchIds.length) partConditions.push(inArray(part.id, searchIds));
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
            approvalStatus: part.approvalStatus,
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
          .filter((id): id is string => Boolean(id))
          .filter((id) => {
            if (isAdmin) return true;
            const row = dbPartById.get(id);
            if (!row) return false;
            return isCustomerVisibleProduct({
              isPublished: row.isPublished,
              approvalStatus: row.approvalStatus,
            });
          }),
      ),
    ];

    const compatibleIdSet = scopedPartIds ? new Set(scopedPartIds) : null;
    const matchedPartIds = compatibleIdSet
      ? resolvedPartIds.filter((partId) => compatibleIdSet.has(partId))
      : resolvedPartIds;

    const [listings, compatibility] =
      matchedPartIds.length > 0
        ? await Promise.all([
            db
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
              ),
            db
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
              .where(inArray(partVehicleCompatibility.partId, matchedPartIds)),
          ])
        : [[], []];

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
        const dbPart = resolveDbPart(doc);
        if (!isAdmin) {
          if (!dbPart) return false;
          if (
            !isCustomerVisibleProduct({
              isPublished: dbPart.isPublished,
              approvalStatus: dbPart.approvalStatus,
            })
          ) {
            return false;
          }
        }
        if (!compatibleIdSet) return true;
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
        const imageUrls = resolveImageUrls(
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
          imageUrl: imageUrls?.imageUrl ?? null,
          thumbUrl: imageUrls?.thumbUrl ?? null,
          mediumUrl: imageUrls?.mediumUrl ?? null,
          listings: partListings.map((listing) => {
            const listingImages = resolveImageUrls(
              listing.sku,
              dbPart?.partNumber,
              doc.part_number,
            );
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
            imageUrl: listingImages?.imageUrl ?? null,
            thumbUrl: listingImages?.thumbUrl ?? null,
            mediumUrl: listingImages?.mediumUrl ?? null,
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

    const shouldPage =
      Boolean(hsnQuery) || useVehicleFilter || usePostFilter || intent.isPartNumberQuery;
    const pagedResults = shouldPage
      ? filteredResults.slice((page - 1) * perPage, page * perPage)
      : filteredResults;
    const found = shouldPage ? filteredResults.length : searchFound;

    type FacetCount = { field_name?: string; counts?: Array<{ value?: string; count?: number }> };
    const facetPayload = (searchResults as { facet_counts?: FacetCount[] }).facet_counts ?? [];
    const brands: Array<{ value: string; count: number }> = [];
    const categories: Array<{ value: string; count: number }> = [];
    for (const facet of facetPayload) {
      const rows = (facet.counts ?? [])
        .map((row) => ({
          value: String(row.value || "").trim(),
          count: Number(row.count || 0),
        }))
        .filter((row) => row.value && row.count > 0);
      if (facet.field_name === "brand") {
        brands.push(...rows.filter((row) => isCustomerVisibleCatalogueBrand(row.value)));
      }
      if (facet.field_name === "category") categories.push(...rows);
    }

    let vehicles: Array<{ make: string; model: string; count: number }> = [];
    if (!suggest && query && !intent.isPartNumberQuery) {
      const catalogVehicles = await db
        .select({
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          variant: vehicle.variant,
        })
        .from(vehicle);
      const matchedVehicles = matchVehiclesForQuery(query, catalogVehicles);
      if (matchedVehicles?.vehicleIds.length) {
        const idSet = new Set(matchedVehicles.vehicleIds);
        const grouped = new Map<string, { make: string; model: string; count: number }>();
        for (const row of catalogVehicles) {
          if (!idSet.has(row.id)) continue;
          const key = `${row.make}\0${row.model}`;
          const existing = grouped.get(key);
          if (existing) existing.count += 1;
          else grouped.set(key, { make: row.make, model: row.model, count: 1 });
        }
        vehicles = [...grouped.values()];
      }
    }

    return NextResponse.json({
      results: pagedResults,
      found,
      page,
      perPage,
      sort,
      inStock: inStock ?? null,
      facets: { brands, categories },
      vehicles,
      pricing: {
        effectiveDiscountPercent: pricing.effectiveDiscountPercent,
        source: pricing.source,
      },
    });
  } catch (error) {
    return searchFailureResponse(error);
  }
}
