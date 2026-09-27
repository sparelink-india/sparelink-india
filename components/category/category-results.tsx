"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import {
  EmptyState,
  ErrorState,
  StateIcons,
} from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

type Listing = {
  id: string;
  dealerName: string;
  pricePaise: number;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  gstRate?: number | null;
  stock: number | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  sku?: string | null;
};

type SearchHit = {
  document?: {
    id?: string;
    part_number?: string;
    name?: string;
    brand?: string;
    category?: string;
  };
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  listings?: Listing[];
};

export type CategoryBrowseQuery = {
  storefrontSlug?: string;
  categoryName?: string | null;
  nameContains?: string | null;
  otherType?: "cables" | "filters" | null;
  segment?: string | null;
  /** Sidebar filters — all already supported by /api/search/parts. */
  brand?: string;
  make?: string;
  model?: string;
};

/**
 * Product-grid skeleton that mirrors the real card shape (image well, brand
 * line, two title lines, price, stock, button) so the layout does not jump
 * when results arrive. Uses `.sl-skeleton`, which is already disabled under
 * `prefers-reduced-motion`.
 */
function CategorySkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="mt-8 flex items-center gap-3">
        <div className="sl-skeleton h-5 w-32" />
        <div className="sl-skeleton h-4 w-20" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="sl-v2-card overflow-hidden p-3"
            aria-hidden="true"
          >
            <div className="sl-skeleton aspect-square w-full" />
            <div className="sl-skeleton mt-3 h-3 w-20" />
            <div className="sl-skeleton mt-2 h-4 w-full" />
            <div className="sl-skeleton mt-1.5 h-4 w-3/4" />
            <div className="sl-skeleton mt-3 h-5 w-28" />
            <div className="sl-skeleton mt-2 h-3 w-16" />
            <div className="sl-skeleton mt-3 h-11 w-full rounded-[var(--sl-radius)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export type CategoryCrumb = { label: string; href: string; key?: MessageKey };

/**
 * Upper bound for the category browse request. Generous enough for a cold
 * Typesense/Neon query, short enough that a stalled socket becomes a visible
 * error instead of an infinite "Searching...".
 */
const SEARCH_TIMEOUT_MS = 15000;

type FacetOption = { value: string; count: number };
type VehicleFacet = { make: string; model: string; count: number };

/**
 * Filter sidebar built ONLY from facets the existing search endpoint already
 * returns, and wired ONLY to parameters it already supports:
 *   brand | categoryName | make | model
 *
 * Deliberately absent: price range, stock availability and sorting. None of
 * those are supported server-side, and a control that changes the URL without
 * changing the results is worse than no control at all.
 */
function FilterSidebar({
  brands,
  categories,
  vehicles,
  activeBrand,
  activeCategory,
  activeMake,
  activeModel,
  onChange,
  onReset,
  heading,
}: {
  brands: FacetOption[];
  categories: FacetOption[];
  vehicles: VehicleFacet[];
  activeBrand: string;
  activeCategory: string;
  activeMake: string;
  activeModel: string;
  onChange: (patch: { brand?: string; categoryName?: string; make?: string; model?: string }) => void;
  onReset: () => void;
  heading: string;
}) {
  const [brandOpen, setBrandOpen] = useState(true);
  const [vehicleOpen, setVehicleOpen] = useState(true);
  const hasActive = Boolean(activeBrand || activeCategory || activeMake || activeModel);
  const SHOWN = 8;

  return (
    <div className="sl-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="sl-h3">{heading}</h2>
        {hasActive ? (
          <button
            type="button"
            onClick={onReset}
            className="min-h-9 rounded-[var(--sl-radius-sm)] px-2 text-xs font-semibold text-[var(--sl-primary)] underline-offset-2 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {brands.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <FilterGroup
            label="Brand"
            open={brandOpen}
            onToggle={() => setBrandOpen((v) => !v)}
            count={brands.length}
          >
            {brands.slice(0, SHOWN).map((option) => (
              <FilterRow
                key={`brand-${option.value}`}
                label={option.value}
                count={option.count}
                active={activeBrand === option.value}
                onClick={() =>
                  onChange({ brand: activeBrand === option.value ? "" : option.value })
                }
              />
            ))}
          </FilterGroup>
        </div>
      ) : null}

      {categories.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <FilterGroup label="Category" open onToggle={() => undefined} count={categories.length}>
            {categories.slice(0, SHOWN).map((option) => (
              <FilterRow
                key={`cat-${option.value}`}
                label={option.value}
                count={option.count}
                active={activeCategory === option.value}
                onClick={() =>
                  onChange({
                    categoryName:
                      activeCategory === option.value ? "" : option.value,
                  })
                }
              />
            ))}
          </FilterGroup>
        </div>
      ) : null}

      {vehicles.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <FilterGroup
            label="Vehicle / Fitment"
            open={vehicleOpen}
            onToggle={() => setVehicleOpen((v) => !v)}
            count={vehicles.length}
          >
            {vehicles.slice(0, SHOWN).map((option) => (
              <FilterRow
                key={`veh-${option.make}-${option.model}`}
                label={`${option.make} ${option.model}`.trim()}
                count={option.count}
                active={activeMake === option.make && activeModel === option.model}
                onClick={() =>
                  onChange(
                    activeMake === option.make && activeModel === option.model
                      ? { make: "", model: "" }
                      : { make: option.make, model: option.model },
                  )
                }
              />
            ))}
          </FilterGroup>
        </div>
      ) : null}

      {brands.length === 0 && categories.length === 0 && vehicles.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--sl-muted)]">No filters available.</p>
      ) : null}
    </div>
  );
}

function FilterGroup({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-semibold text-[var(--sl-text)]"
      >
        <span>
          {label}
          <span className="ml-1.5 text-xs font-normal text-[var(--sl-muted)]">({count})</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-[var(--sl-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? <div className="mt-1 space-y-0.5">{children}</div> : null}
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-[var(--sl-radius-sm)] px-2 text-left text-[13px] transition-colors duration-200 ${
        active
          ? "bg-[var(--sl-primary-soft)] font-semibold text-[var(--sl-primary)]"
          : "text-[var(--sl-text-soft)] hover:bg-[var(--sl-surface-sunk)]"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-[11px] text-[var(--sl-muted)]">{count}</span>
    </button>
  );
}

function buildSearchUrl(browse: CategoryBrowseQuery, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    perPage: "24",
  });
  if (browse.storefrontSlug) params.set("category", browse.storefrontSlug);
  if (browse.categoryName) params.set("categoryName", browse.categoryName);
  if (browse.nameContains) params.set("nameContains", browse.nameContains);
  if (browse.otherType) params.set("otherType", browse.otherType);
  if (browse.segment) params.set("segment", browse.segment);
  // Sidebar filters. These three parameters are already read by
  // /api/search/parts (verified: it reads `brand`, `make` and `model`), so the
  // controls genuinely change the request and therefore the results. No new
  // endpoint and no new parameter.
  if (browse.brand) params.set("brand", browse.brand);
  if (browse.make) params.set("make", browse.make);
  if (browse.model) params.set("model", browse.model);
  return `/api/search/parts?${params.toString()}`;
}

export function CategoryResults({
  path,
  title,
  titleKey,
  description,
  descriptionKey,
  image,
  browse,
  crumbs,
}: {
  path: string;
  title: string;
  titleKey?: MessageKey;
  description?: string;
  descriptionKey?: MessageKey;
  image?: string | null;
  browse: CategoryBrowseQuery;
  crumbs: CategoryCrumb[];
}) {
  const { t } = useI18n();
  const heading = titleKey ? t(titleKey) : title;
  const summary = descriptionKey ? t(descriptionKey) : description;
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedPage = Number(searchParams.get("page") || "1");
  const activePage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const [payload, setPayload] = useState<{
    url: string;
    results: SearchHit[];
    found: number;
    error: string;
    facets: { brands: FacetOption[]; categories: FacetOption[] };
    vehicles: { make: string; model: string; count: number }[];
  } | null>(null);
  const [addingId, setAddingId] = useState("");
  const [detailTarget, setDetailTarget] = useState<{ partId?: string; sku?: string } | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Local filter selections. Merged over the route-supplied `browse` so a
  // filter genuinely changes the request the API receives (and therefore the
  // results), using parameters the endpoint already supports.
  const [filterState, setFilterState] = useState<{
    brand?: string;
    categoryName?: string;
    make?: string;
    model?: string;
  }>({});
  const activeBrand = filterState.brand ?? "";
  const activeCategory = filterState.categoryName ?? "";
  const activeMake = filterState.make ?? "";
  const activeModel = filterState.model ?? "";
  const pagedUrl = buildSearchUrl(
    { ...browse, ...filterState },
    activePage,
  );
  const loading = payload?.url !== pagedUrl;
  const results = payload?.url === pagedUrl ? payload.results : [];
  const found = payload?.url === pagedUrl ? payload.found : 0;
  const error = payload?.url === pagedUrl ? payload.error : "";
  const brands = payload?.url === pagedUrl ? payload.facets.brands : [];
  const categoryFacets =
    payload?.url === pagedUrl ? payload.facets.categories : [];
  const vehicleFacets = payload?.url === pagedUrl ? payload.vehicles : [];
  const totalPages = Math.max(1, Math.ceil(found / 24));

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [path, activePage]);

  useEffect(() => {
    const controller = new AbortController();
    // A stalled request previously left this promise unsettled forever, so the
    // derived `loading` flag stayed true and the page sat on "Searching..."
    // indefinitely with no feedback. The timeout guarantees every path settles
    // into success, empty, or a real error.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SEARCH_TIMEOUT_MS);

    void fetch(pagedUrl, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        // A non-OK response used to resolve to `null` and render as "no
        // results", silently swallowing the failure. It is an error.
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setPayload({
          url: pagedUrl,
          results: Array.isArray(data?.results) ? data.results : [],
          found: typeof data?.found === "number" ? data.found : 0,
          error: "",
          // Real facet counts computed by the existing search endpoint. These
          // drive the filter sidebar, so no new endpoint or param is needed.
          facets: {
            brands: Array.isArray(data?.facets?.brands) ? data.facets.brands : [],
            categories: Array.isArray(data?.facets?.categories)
              ? data.facets.categories
              : [],
          },
          vehicles: Array.isArray(data?.vehicles) ? data.vehicles : [],
        });
      })
      .catch((caught: unknown) => {
        // A real unmount/re-page abort is not an error worth showing.
        if (!timedOut && caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setPayload({
          url: pagedUrl,
          results: [],
          found: 0,
          error: t("search.failed"),
          facets: { brands: [], categories: [] },
          vehicles: [],
        });
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pagedUrl, t, retryToken]);

  async function addToCart(listingId: string) {
    setAddingId(listingId);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerListingId: listingId, quantity: 1 }),
      });
      if (response.status === 401) {
        router.push("/login");
      }
    } finally {
      setAddingId("");
    }
  }

  function goToPage(nextPage: number) {
    router.replace(nextPage > 1 ? `${path}?page=${nextPage}` : path);
  }

  return (
    <div>
      <nav className="text-sm text-[var(--sl-muted)]" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.href}-${index}`}>
            {index > 0 ? " / " : null}
            {index === crumbs.length - 1 ? (
              <span className="text-slate-800">{crumb.key ? t(crumb.key) : crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:underline">
                {crumb.key ? t(crumb.key) : crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/*
        Category identity + live result count. The count lives in the header so
        it is stated once, above the filters and the grid, rather than repeated
        above the grid itself.
      */}
      <div className="sl-v2-card mt-6 flex flex-wrap items-center gap-4 p-4 sm:p-5">
        {image ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sl-radius-sm)] bg-[var(--sl-surface-sunk)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              width={128}
              height={128}
              className="h-full w-full object-contain p-1.5"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="sl-h1">{heading}</h1>
          {summary ? <p className="sl-body mt-1.5">{summary}</p> : null}
        </div>
        {loading ? (
          <div
            className="sl-skeleton h-6 w-20 shrink-0"
            role="status"
            aria-live="polite"
          />
        ) : (
          <span className="sl-v2-badge sl-v2-badge-brand shrink-0">
            {found} {found === 1 ? t("category.item") : t("category.items")}
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorState
            title={t("common.error")}
            body={error}
            onRetry={() => setRetryToken((value) => value + 1)}
          />
        </div>
      ) : null}

      {/*
        Mobile: a single "Filters" button that opens a full-width sheet.
        Desktop: a sticky sidebar beside the product grid. Both render the
        same FilterSidebar so behaviour cannot drift between breakpoints.
      */}
      <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
          className="sl-v2-btn sl-v2-btn-secondary min-h-11 px-4 text-sm"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.9"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
        </button>
        {loading ? null : (
          <button
            type="button"
            onClick={() => setFilterState({})}
            className="sl-v2-btn sl-v2-btn-ghost !min-h-11 !text-[0.8125rem]"
          >
            {t("common.clearFilters")}
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FilterSidebar
              heading={t("category.categories")}
              brands={brands}
              categories={categoryFacets}
              vehicles={vehicleFacets}
              activeBrand={activeBrand}
              activeCategory={activeCategory}
              activeMake={activeMake}
              activeModel={activeModel}
              onChange={(patch) => setFilterState((prev) => ({ ...prev, ...patch }))}
              onReset={() => setFilterState({})}
            />
          </div>
        </aside>
        <div className="min-w-0">
          {loading ? (
            <CategorySkeleton label={t("common.loading")} />
          ) : found === 0 ? (
            <EmptyState
              icon={StateIcons.search}
              title={t("category.empty")}
              body={t("category.emptyBody")}
              action={{ href: "/", label: t("category.searchAll") }}
              secondaryAction={
                activeBrand || activeCategory || activeMake || activeModel
                  ? { href: path, label: t("common.clearFilters") }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
                {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              return (
                <article
                  key={partData.id || partData.part_number || index}
                  className="sl-v2-card sl-v2-card-hover overflow-hidden p-3 sm:p-4"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <button
                      type="button"
                      className="h-[160px] w-[160px] shrink-0 overflow-hidden rounded-[var(--sl-radius)] bg-gradient-to-b from-white to-brand-50/50 min-[430px]:h-[168px] min-[430px]:w-[168px] md:h-[240px] md:w-[250px]"
                      onClick={() =>
                        setDetailTarget({
                          partId: partData.id,
                          sku: listing?.sku || partData.part_number,
                        })
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          hit.thumbUrl ||
                          listing?.thumbUrl ||
                          hit.imageUrl ||
                          listing?.imageUrl ||
                          "/images/products/placeholder.svg"
                        }
                        alt={partData.name || t("product.partFallback")}
                        width={250}
                        height={240}
                        loading={index < 4 ? "eager" : "lazy"}
                        decoding="async"
                        className="h-full w-full object-contain p-2"
                        onError={(event) => {
                          const el = event.currentTarget as HTMLImageElement;
                          const original = hit.imageUrl || listing?.imageUrl;
                          if (original && el.src !== original) {
                            el.src = original;
                            return;
                          }
                          el.src = "/images/products/placeholder.svg";
                        }}
                      />
                    </button>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="line-clamp-3 break-words sl-h3">
                        {partData.name || t("product.partFallback")}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--sl-muted)]">
                        {[partData.brand, partData.part_number].filter(Boolean).join(" · ")}
                      </p>
                      {listing ? (
                        <div className="mt-2">
                          <InclusivePrice
                            pricePaise={listing.pricePaise}
                            listInclusivePaise={listing.listInclusivePaise}
                            netInclusivePaise={listing.netInclusivePaise}
                            discountPercent={listing.discountPercent}
                            gstRate={listing.gstRate}
                            align="left"
                          />
                          <button
                            type="button"
                            disabled={
                              addingId === listing.id ||
                              (listing.stock ?? 0) <= 0 ||
                              !isAuthoritativeSellingPricePaise(
                                listing.listInclusivePaise,
                                listing.netInclusivePaise,
                                listing.pricePaise,
                              )
                            }
                            onClick={() => void addToCart(listing.id)}
                            className="sl-v2-btn sl-v2-btn-primary mt-2 min-h-10 px-3 text-xs disabled:opacity-50"
                          >
                            {!isAuthoritativeSellingPricePaise(
                              listing.listInclusivePaise,
                              listing.netInclusivePaise,
                              listing.pricePaise,
                            )
                              ? t("price.onRequest")
                              : (listing.stock ?? 0) <= 0
                                ? t("product.outOfStock")
                                : t("product.addToCart")}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--sl-muted)]">{t("product.noListing")}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {totalPages > 1 ? (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => goToPage(activePage - 1)}
                className="min-h-10 rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white px-4 text-sm font-semibold disabled:opacity-40"
              >
                {t("search.prev")}
              </button>
              <p className="text-sm text-[var(--sl-text-soft)]">
                {t("search.page", { page: activePage, pages: totalPages })}
              </p>
              <button
                type="button"
                disabled={activePage >= totalPages}
                onClick={() => goToPage(activePage + 1)}
                className="min-h-10 rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white px-4 text-sm font-semibold disabled:opacity-40"
              >
                {t("search.next")}
              </button>
            </div>
          ) : null}
        </>
      )}
        </div>
      </div>

      {/* Mobile filter sheet. Full-width, scrollable, never wider than the
          viewport, so it cannot introduce horizontal overflow. */}
      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("category.categories")}
        >
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-brand-950/60 backdrop-blur-[2px]"
          />
          <div className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-[var(--sl-cream)] p-4 shadow-[0_-20px_50px_-20px_rgba(42,8,18,0.6)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="sl-h2 text-base">{t("category.categories")}</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="sl-v2-focus-invert flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sl-border)] bg-white text-[var(--sl-primary)]"
                aria-label={t("common.close")}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <FilterSidebar
              heading={t("category.categories")}
              brands={brands}
              categories={categoryFacets}
              vehicles={vehicleFacets}
              activeBrand={activeBrand}
              activeCategory={activeCategory}
              activeMake={activeMake}
              activeModel={activeModel}
              onChange={(patch) => setFilterState((prev) => ({ ...prev, ...patch }))}
              onReset={() => setFilterState({})}
            />
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="sl-v2-btn sl-v2-btn-primary mt-3 min-h-11 w-full"
            >
              {loading ? t("common.loading") : `${found} ${found === 1 ? "item" : "items"}`}
            </button>
          </div>
        </div>
      ) : null}

      <ProductDetailModal
        open={Boolean(detailTarget)}
        partId={detailTarget?.partId}
        sku={detailTarget?.sku}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
}
