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
  /** Present in the catalogue response and rendered by the other product
   *  surfaces; the local type simply had not declared it. */
  mrpPaise?: number | null;
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
  /** Server-backed result ordering (relevance default) and stock filter. */
  sort?: string;
  inStock?: boolean;
};

/**
 * Product-grid skeleton that mirrors the real card shape (image well, brand
 * line, two title lines, price, stock, button) so the layout does not jump
 * when results arrive. Uses `.sl-skel`, which is already disabled under
 * `prefers-reduced-motion`.
 */
function CategorySkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-3 border-b border-[var(--sl-rule)] pb-5">
        <div className="sl-skel h-8 w-56" />
        <div className="sl-skel ml-auto h-8 w-16" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="sl-panel overflow-hidden p-3"
            aria-hidden="true"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="sl-skel mx-auto aspect-square w-full max-w-[13rem] sm:mx-0 sm:w-[11rem] md:w-[12.5rem]" />
              <div className="min-w-0 flex-1">
                <div className="sl-skel h-3 w-16" />
                <div className="sl-skel mt-2.5 h-4 w-full" />
                <div className="sl-skel mt-1.5 h-4 w-3/4" />
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--sl-rule)] pt-2.5">
                  <div className="sl-skel h-5 w-24" />
                  <div className="sl-skel h-8 w-24" />
                </div>
              </div>
            </div>
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
  const { t } = useI18n();
  const hasActive = Boolean(activeBrand || activeCategory || activeMake || activeModel);
  const SHOWN = 8;

  return (
    <div className="sl-panel">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)] px-3 py-2.5">
        <h2 className="sl-label mb-0 flex items-center gap-2">
          <span className="inline-block h-3 w-[3px] bg-[var(--sl-brand)]" aria-hidden />
          {heading}
        </h2>
        {hasActive ? (
          <button
            type="button"
            onClick={onReset}
            className="sl-focus text-[0.75rem] font-bold text-[var(--sl-brand)] underline-offset-2 hover:underline"
          >
            {t("common.clearFilters")}
          </button>
        ) : null}
      </div>
      <div className="px-3 pb-3">

      {brands.length > 0 ? (
        <div className="mt-3 border-t border-[var(--sl-rule)] pt-3">
          <FilterGroup
            label={t("search.brandFilter")}
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
        <div className="border-t border-[var(--sl-rule)] pt-3">
          <FilterGroup label={t("search.categoryFilter")} open onToggle={() => undefined} count={categories.length}>
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
        <div className="border-t border-[var(--sl-rule)] pt-3">
          <FilterGroup
            label={t("search.tabVehicles")}
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
        <p className="sl-small mt-3 border-t border-[var(--sl-rule)] pt-3">
          {t("category.noFilters")}
        </p>
      ) : null}
      </div>
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
        className="sl-focus flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <span className="sl-label mb-0">{label}</span>
        <span className="flex items-center gap-2">
          <span className="sl-num text-[0.6875rem] font-semibold text-[var(--sl-ink-3)]">
            {count}
          </span>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-[var(--sl-ink-3)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
        </span>
      </button>
      {open ? <div className="mt-1 pb-1">{children}</div> : null}
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
      className={`sl-focus flex min-h-10 w-full items-center justify-between gap-2 border-l-2 px-2 text-left text-[0.8125rem] transition-colors ${
        active
          ? "border-[var(--sl-brand)] bg-[var(--sl-brand-soft)] font-semibold text-[var(--sl-brand)]"
          : "border-transparent text-[var(--sl-ink-2)] hover:bg-[var(--sl-sunken)] hover:text-[var(--sl-ink)]"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="sl-num shrink-0 text-[0.6875rem] text-[var(--sl-ink-3)]">
        {count}
      </span>
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
  // Server-backed ordering and stock filter. `sort` passes through only when
  // set (the API defaults to relevance); `inStock` is sent as 1/0 only when
  // the checkbox state is explicit, so unrelated flows keep prior behaviour.
  if (browse.sort) params.set("sort", browse.sort);
  if (browse.inStock !== undefined) params.set("inStock", browse.inStock ? "1" : "0");
  return `/api/search/parts?${params.toString()}`;
}

export type CategoryResultsProps = {
  path: string;
  title: string;
  titleKey?: MessageKey;
  description?: string;
  descriptionKey?: MessageKey;
  image?: string | null;
  browse: CategoryBrowseQuery;
  crumbs: CategoryCrumb[];
};

export function CategoryResults({
  path,
  title,
  titleKey,
  description,
  descriptionKey,
  image,
  browse,
  crumbs,
}: CategoryResultsProps) {
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
  // Keyboard users cannot reach the backdrop click, so Escape must close the
  // mobile filter sheet too. Scoped to the open state and cleaned up so the
  // page-level search shortcuts keep working everywhere else.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);
  // Local filter selections. Merged over the route-supplied `browse` so a
  // filter genuinely changes the request the API receives (and therefore the
  // results), using parameters the endpoint already supports.
  const [filterState, setFilterState] = useState<{
    brand?: string;
    categoryName?: string;
    make?: string;
    model?: string;
    sort?: string;
    inStock?: boolean;
  }>({});
  const activeBrand = filterState.brand ?? "";
  const activeCategory = filterState.categoryName ?? "";
  const activeMake = filterState.make ?? "";
  const activeModel = filterState.model ?? "";
  const activeSort = filterState.sort ?? "";
  const activeInStock = filterState.inStock ?? false;
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
      <nav
        className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-sunken)] px-3 py-2"
        aria-label={t("a11y.breadcrumb")}
      >
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.href}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden className="text-[var(--sl-rule-strong)]">
                /
              </span>
            ) : null}
            {index === crumbs.length - 1 ? (
              <span
                aria-current="page"
                className="text-[0.8125rem] font-bold text-[var(--sl-ink)]"
              >
                {crumb.key ? t(crumb.key) : crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="sl-focus text-[0.8125rem] text-[var(--sl-ink-3)] transition-colors hover:text-[var(--sl-brand)]"
              >
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
      <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-[var(--sl-rule)] pb-5 sm:gap-5">
        {image ? (
          <div className="sl-panel-sunk h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              width={128}
              height={128}
              className="h-full w-full object-contain p-2"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="sl-display flex items-center gap-2.5">
            <span
              className="hidden h-6 w-[3px] shrink-0 bg-[var(--sl-brand)] sm:block"
              aria-hidden
            />
            {heading}
          </h1>
          {summary ? <p className="sl-body mt-2 max-w-2xl">{summary}</p> : null}
        </div>
        {/* Live count as a figure rather than a pill, with a reserved box so
            the heading never reflows when the count resolves. */}
        <div className="shrink-0 border-l border-[var(--sl-rule)] pl-4 sm:pl-5">
          {loading ? (
            <div className="sl-skel h-8 w-16" role="status" aria-live="polite" />
          ) : (
            <>
              <p className="sl-num text-[1.75rem] font-extrabold leading-none tracking-tight text-[var(--sl-ink)]">
                {found}
              </p>
              <p className="sl-label mb-0 mt-1 !text-[0.625rem]">
                {found === 1 ? t("category.item") : t("category.items")}
              </p>
            </>
          )}
        </div>
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
      <div className="mt-4 flex items-center justify-between gap-3 border-y border-[var(--sl-rule)] py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
          className="sl-btn sl-btn-secondary !min-h-10 px-3.5 text-[0.8125rem]"
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
          {t("search.filters")}
        </button>
        {loading ? null : (
          <button
            type="button"
            onClick={() => setFilterState({})}
            className="sl-btn sl-btn-ghost !min-h-10 !text-[0.8125rem]"
          >
            {t("common.clearFilters")}
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[var(--v3-header-h)]">
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
              {/* Column count is capped at 3. The page is a two-column layout
                  from `lg` up - a 17rem filter rail plus this results column -
                  and the container itself is capped at 1280px, so at 2xl this
                  column is only ~940px wide. A 4th column therefore fitted
                  ~226px cards, and because the image well was a FIXED
                  `md:w-[12.5rem]` (200px) with `shrink-0`, it consumed the whole
                  card: 226 - 24 (p-3) - 200 - 16 (gap) = -14px, so the
                  information column collapsed to ZERO width. The image rendered
                  perfectly and the name, part number, price and CTA were clipped
                  away - exactly the "image present, details missing" report.
                  Three columns keeps cards around 305px. */}
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label
                  htmlFor="sl-sort"
                  className="text-[0.8125rem] font-medium text-[var(--sl-ink-soft)]"
                >
                  {t("search.sortBy")}
                </label>
                <select
                  id="sl-sort"
                  value={activeSort}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFilterState((prev) => ({
                      ...prev,
                      sort: value || undefined,
                    }));
                  }}
                  className="sl-input !h-10 !w-auto pr-8 text-[0.8125rem]"
                >
                  <option value="">{t("search.relevance")}</option>
                  <option value="name_asc">{t("search.sortNameAsc")}</option>
                  <option value="name_desc">{t("search.sortNameDesc")}</option>
                </select>
                <label
                  htmlFor="sl-instock"
                  className="inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] font-medium text-[var(--sl-ink-soft)]"
                >
                  <input
                    id="sl-instock"
                    type="checkbox"
                    checked={activeInStock}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setFilterState((prev) => ({
                        ...prev,
                        inStock: checked || undefined,
                      }));
                    }}
                    className="h-4 w-4 accent-[#7a1233]"
                  />
                  {t("search.inStock")}
                </label>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              return (
                <article
                  key={partData.id || partData.part_number || index}
                  className="sl-panel overflow-hidden p-3 transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    {/* The well is a share of the card, not a fixed width, and
                        `shrink-0` is dropped from `sm` up so a narrow card can
                        never let the image starve the information column again.
                        The square ratio is preserved by `aspect-square`. */}
                    <button
                      type="button"
                      className="sl-panel-sunk mx-auto aspect-square w-full max-w-[13rem] shrink sm:mx-0 sm:w-[42%] sm:max-w-[12.5rem] md:w-[45%]"
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
                        className="h-full w-full object-contain p-3"
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
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                      <h3 className="sl-h3 sl-clamp-2 break-words">
                        {partData.name || t("product.partFallback")}
                      </h3>
                      {partData.brand ? (
                        <p className="sl-label mb-0 mt-1.5 !text-[0.5625rem]">
                          {partData.brand}
                        </p>
                      ) : null}
                      {partData.part_number ? (
                        <p className="sl-partno mt-1">{partData.part_number}</p>
                      ) : null}
                      {listing ? (
                        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[var(--sl-rule)] pt-2.5">
                          <InclusivePrice
                            pricePaise={listing.pricePaise}
                            listInclusivePaise={listing.listInclusivePaise}
                            netInclusivePaise={listing.netInclusivePaise}
                            discountPercent={listing.discountPercent}
                            gstRate={listing.gstRate}
                            align="left"
                          />
                          {listing.mrpPaise && listing.mrpPaise > listing.pricePaise ? (
                            <p className="sl-price-strike">
                              {t("price.mrp")} ₹
                              {(listing.mrpPaise / 100).toLocaleString("en-IN")}
                            </p>
                          ) : null}
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
                            className="sl-btn sl-btn-primary sl-btn-sm ml-auto !min-h-9"
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
                        <p className="sl-small mt-2 border-t border-[var(--sl-rule)] pt-2.5">
                          {t("product.noListing")}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {totalPages > 1 ? (
            <nav
              className="mt-8 flex items-center justify-center gap-3 border-t border-[var(--sl-rule)] pt-5"
              aria-label={t("search.page", { page: activePage, pages: totalPages })}
            >
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => goToPage(activePage - 1)}
                className="sl-btn sl-btn-secondary sl-btn-sm"
              >
                {t("search.prev")}
              </button>
              <p className="sl-num px-2 text-[0.8125rem] font-semibold text-[var(--sl-ink-2)]">
                {t("search.page", { page: activePage, pages: totalPages })}
              </p>
              <button
                type="button"
                disabled={activePage >= totalPages}
                onClick={() => goToPage(activePage + 1)}
                className="sl-btn sl-btn-secondary sl-btn-sm"
              >
                {t("search.next")}
              </button>
            </nav>
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
            className="absolute inset-0 bg-[var(--sl-overlay)] backdrop-blur-[2px]"
          />
          <div className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[var(--sl-r-lg)] bg-[var(--sl-page)] shadow-[var(--sl-e-3)]">
            {/* Sheet header is a sticky ruled bar, so the close control and the
                result count stay reachable while a long facet list scrolls. */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--sl-rule)] bg-[var(--sl-surface)] px-4 py-3">
              <h2 className="sl-h2">{t("category.categories")}</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="sl-focus flex h-9 w-9 items-center justify-center rounded-[var(--sl-r)] border border-[var(--sl-rule-strong)] bg-[var(--sl-surface)] text-[var(--sl-brand)]"
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
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
            {/* Apply bar pinned to the bottom of the sheet, on a hairline, so
                it never scrolls away from the thumb. */}
            <div className="border-t border-[var(--sl-rule)] bg-[var(--sl-surface)] p-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="sl-btn sl-btn-primary w-full"
              >
                {loading
                  ? t("common.loading")
                  : `${found} ${found === 1 ? t("category.item") : t("category.items")}`}
              </button>
            </div>
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
