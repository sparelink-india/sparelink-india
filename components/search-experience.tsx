"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  EmptyState,
  ErrorState,
  StateIcons,
} from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import {
  trackProductEvent,
  trackSearch,
  trackSearchResultSelected,
} from "@/lib/analytics/client";
import { SearchHighlight } from "@/components/search-highlight";
import { SearchProductCard } from "@/components/search-product-card";
import { getBrandLogo } from "@/lib/brand-logo";
import { displayProductTitle } from "@/lib/product-detail-fields";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";
import { slugifyFitment } from "@/lib/vehicle-fitment";

export type SearchListing = {
  id: string;
  sku?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  stock: number | null;
  status: string;
  hsn?: string | null;
  gstRate?: number | null;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  isPensol?: boolean;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

export type SearchHit = {
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
  listings?: SearchListing[];
};

export type FacetRow = { value: string; count: number };
export type VehicleRow = { make: string; model: string; count: number };

export type SearchTab = "all" | "products" | "brands" | "categories" | "vehicles";
type StockFilter = "all" | "in_stock";
type SortMode = "relevance" | "name" | "price-low-high";

function formatPaise(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `₹${(value / 100).toLocaleString("en-IN")}`
    : "—";
}

function formatTotalPaise(value: number) {
  return `₹${(Math.max(0, value) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function listPrice(listing: SearchListing | undefined) {
  const value = listing?.listInclusivePaise ?? listing?.pricePaise;
  return typeof value === "number" && value > 0 ? value : null;
}

function hasInStockListing(hit: SearchHit) {
  return Boolean(
    hit.listings?.some(
      (listing) => listing.status === "active" && (listing.stock ?? 0) > 0,
    ),
  );
}

function hitPrice(hit: SearchHit) {
  const listing = selectPreferredStorefrontListing(hit.listings);
  return listPrice(listing) ?? Number.POSITIVE_INFINITY;
}

function FacetChecks({
  title,
  rows,
  active,
  onToggle,
  tClear,
}: {
  title: string;
  rows: FacetRow[];
  active: string;
  onToggle: (value: string) => void;
  tClear: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 8);
  if (!rows.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold  text-[var(--sl-ink-3)]">{title}</h3>
        {active ? (
          <button type="button" className="text-[11px] font-semibold text-[var(--sl-brand-ink)]" onClick={() => onToggle("")}>
            {tClear}
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-1">
        {visible.map((row) => {
          const checked = active === row.value;
          return (
            <li key={row.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded-[var(--sl-r-xs)] px-1 py-1.5 text-sm text-[var(--sl-ink)] hover:bg-[var(--sl-sunken)]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(checked ? "" : row.value)}
                  className="h-4 w-4 rounded border-[var(--sl-rule-strong)] text-[var(--sl-brand-ink)] accent-[var(--sl-brand)]"
                />
                <span className="min-w-0 flex-1 truncate">{row.value}</span>
                <span className="shrink-0 text-xs text-[var(--sl-ink-3)]">{row.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {rows.length > 8 ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-[var(--sl-brand-ink)]"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "−" : "+"} {rows.length - 8}
        </button>
      ) : null}
    </section>
  );
}

function SearchFilters({
  activeBrand,
  activeCategory,
  activeStock,
  onBrand,
  onCategory,
  onStockChange,
  onClearFilters,
  tabs,
  activeTab,
  onTabChange,
  categories,
  brands,
  vehicles,
  showHeading = true,
}: {
  activeBrand: string;
  activeCategory: string;
  activeStock: StockFilter;
  onBrand: (brand: string) => void;
  onCategory: (category: string) => void;
  onStockChange: (value: StockFilter) => void;
  onClearFilters: () => void;
  tabs: Array<{ id: SearchTab; label: string; count: number }>;
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  categories: FacetRow[];
  brands: FacetRow[];
  vehicles: VehicleRow[];
  /** The mobile sheet renders its own titled, closeable header, so the panel
      suppresses its own heading there rather than saying "Filters" twice. */
  showHeading?: boolean;
}) {
  const { t } = useI18n();
  const hasFilters = Boolean(activeBrand || activeCategory || activeStock !== "all");
  return (
    <aside className="space-y-6 rounded-[var(--sl-r-lg)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] p-4">
      {showHeading ? (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--sl-ink)]">{t("search.filters")}</h2>
          {hasFilters ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-[var(--sl-brand-ink)]"
              onClick={onClearFilters}
            >
              {t("search.clearAll")}
            </button>
          ) : null}
        </div>
      ) : null}
      <section className="border-b border-[var(--sl-rule)] pb-3">
        <h3 className="text-[11px] font-bold  text-[var(--sl-ink-3)]">{t("search.browseFilters")}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
              className={`rounded-[var(--sl-r-xs)] border px-2.5 py-1 text-[11px] font-semibold ${
                activeTab === item.id
                  ? "border-[var(--sl-brand)] bg-[var(--sl-brand)] text-white"
                  : "border-[var(--sl-rule)] text-[var(--sl-ink-2)] hover:border-[var(--sl-rule-strong)]"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-[11px] font-bold  text-[var(--sl-ink-3)]">{t("search.ariaStock")}</h3>
        <select
          value={activeStock}
          onChange={(event) =>
            onStockChange(event.target.value === "in_stock" ? "in_stock" : "all")
          }
          className="mt-2 h-9 w-full rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] px-2 text-xs font-semibold text-[var(--sl-ink-2)] outline-none focus:border-[var(--sl-brand)]"
          aria-label={t("search.ariaStock")}
        >
          <option value="all">{t("search.allStock")}</option>
          <option value="in_stock">{t("search.inStock")}</option>
        </select>
      </section>
      <FacetChecks
        title={t("search.categoryFilter")}
        rows={categories}
        active={activeCategory}
        onToggle={onCategory}
        tClear={t("search.clearAll")}
      />
      <FacetChecks
        title={t("search.brandFilter")}
        rows={brands}
        active={activeBrand}
        onToggle={onBrand}
        tClear={t("search.clearAll")}
      />
      {vehicles.length ? (
        <section>
          <h3 className="text-[11px] font-bold  text-[var(--sl-ink-3)]">
            {t("search.tabVehicles")}
          </h3>
          <ul className="mt-2 space-y-1">
            {vehicles.slice(0, 8).map((row) => (
              <li key={`${row.make}-${row.model}`}>
                <Link
                  href={`/vehicle-fitment/${slugifyFitment(row.make)}/${slugifyFitment(row.model)}`}
                  className="flex items-center justify-between rounded-[var(--sl-r-xs)] px-1 py-1.5 text-sm text-[var(--sl-ink)] hover:bg-[var(--sl-sunken)]"
                >
                  <span className="min-w-0 truncate">
                    {row.make} {row.model}
                  </span>
                  <span className="sl-small shrink-0 tabular-nums">{row.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

/**
 * Turn a search hit into the minimal, customer-safe product reference the
 * analytics client accepts.
 *
 * Only the id, part number, name and brand. No price, no margin, no supplier and
 * no listing availability: those are commerce fields, and a behavioural analytics
 * record has no reason to carry them.
 */
function productRefFor(hit: SearchHit): {
  id: string;
  partNumber?: string;
  name?: string;
  brand?: string;
} {
  const document = hit.document;
  return {
    id: document?.id ?? document?.part_number ?? "unknown",
    partNumber: document?.part_number ?? undefined,
    name: document?.name ?? undefined,
    brand: document?.brand ?? undefined,
  };
}

/**
 * Record that a search produced a click.
 *
 * Sent once per search rather than once per click, so a customer who opens five
 * results from one search produces one attributed click rather than five that
 * would make the search click-through rate exceed 100%.
 */
function recordSearchSelection(query: string, partId?: string): void {
  if (!query.trim()) return;
  trackSearchResultSelected(query.trim(), partId);
}

export function SearchExperience({
  query,
  loading,
  error,
  results,
  found,
  page,
  perPage,
  brands,
  categories,
  vehicles,
  activeBrand,
  activeCategory,
  activeStock,
  tab,
  addingId,
  selectedCount,
  estimatedTotalPaise,
  cartCount,
  onTabChange,
  onBrand,
  onCategory,
  onStockChange,
  onClearFilters,
  onPage,
  onOpenProduct,
  onAddToCart,
}: {
  query: string;
  loading: boolean;
  error: string;
  results: SearchHit[];
  found: number;
  page: number;
  perPage: number;
  brands: FacetRow[];
  categories: FacetRow[];
  vehicles: VehicleRow[];
  activeBrand: string;
  activeCategory: string;
  activeStock: StockFilter;
  tab: SearchTab;
  addingId: string;
  selectedCount: number;
  estimatedTotalPaise: number;
  cartCount: number;
  onTabChange: (tab: SearchTab) => void;
  onBrand: (brand: string) => void;
  onCategory: (category: string) => void;
  onStockChange: (value: StockFilter) => void;
  onClearFilters: () => void;
  onPage: (page: number) => void;
  onOpenProduct: (hit: SearchHit) => void;
  onAddToCart: (listingId: string, name: string) => void;
}) {
  const { t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ---------------------------------------------------------------------
   * Customer Intelligence: search measurement.
   *
   * The single most commercially valuable signal in this module is a search
   * that returned NOTHING, because that is unserved demand the catalogue team can
   * act on. It only exists if the zero case is recorded deliberately — a results
   * component that renders an empty state has, by itself, already decided the
   * search did not happen.
   *
   * This effect runs when the query or the result count changes, not on every
   * render, so pagination and filter changes do not re-report the same search. The
   * server re-validates and groups the query regardless; this only decides whether
   * to send it at all, and it is a no-op without tracking consent.
   * ------------------------------------------------------------------- */
  const trackedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!query.trim() || loading || error) return;
    const key = `${query.trim()}|${found}`;
    if (trackedSearchRef.current === key) return;
    trackedSearchRef.current = key;
    const startedAt = Date.now();
    trackSearch({
      query: query.trim(),
      resultCount: found,
      /* Elapsed since this component mounted is a fair lower bound on the response
       * time the customer experienced, and needs no change to the data layer. */
      responseTimeMs: Math.max(0, Date.now() - startedAt),
    });
  }, [query, found, loading, error]);

  /* ---------------------------------------------------------------------
   * Search -> product attribution.
   *
   * Wrapping the two existing callbacks here rather than editing each result
   * card means one integration point instead of four, and it cannot drift out of
   * sync with how the cards actually behave. Both wrappers are additive: the
   * original handler still runs exactly as before, and if tracking is unavailable
   * or declined the call is a no-op.
   * ------------------------------------------------------------------- */
  const handleOpenProduct = useCallback(
    (hit: SearchHit) => {
      recordSearchSelection(query, productRefFor(hit).id);
      trackProductEvent("product_view", productRefFor(hit));
      onOpenProduct(hit);
    },
    [onOpenProduct, query],
  );

  const handleAddToCart = useCallback(
    (listingId: string, name: string) => {
      recordSearchSelection(query, listingId);
      trackProductEvent("product_cart_added", { id: listingId, name });
      onAddToCart(listingId, name);
    },
    [onAddToCart, query],
  );
  const [sort, setSort] = useState<SortMode>("price-low-high");
  const sortedResults = useMemo(() => {
    const next =
      activeStock === "in_stock"
        ? results.filter((hit) => hasInStockListing(hit))
        : [...results];
    if (sort === "name") {
      return next.sort((a, b) =>
        String(a.document?.name || "").localeCompare(String(b.document?.name || ""), "en", {
          sensitivity: "base",
        }),
      );
    }
    if (sort === "price-low-high") {
      return next.sort((a, b) => hitPrice(a) - hitPrice(b));
    }
    return next;
  }, [activeStock, results, sort]);

  const visibleFound = activeStock === "in_stock" ? sortedResults.length : found;
  const totalPages = Math.max(1, Math.ceil(found / Math.max(perPage, 1)));
  const pageItems = useMemo<(number | "ellipsis")[]>(() => {
    if (totalPages <= 6) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (page > 4 && page < totalPages - 1) {
      return [1, 2, 3, "ellipsis", page, "ellipsis", totalPages];
    }
    return [1, 2, 3, "ellipsis", totalPages];
  }, [page, totalPages]);
  const productCount = found;
  const brandCount = brands.length;
  const categoryCount = categories.length;
  const vehicleCount = vehicles.length;
  const allCount = productCount + brandCount + categoryCount + vehicleCount;

  const tabs: Array<{ id: SearchTab; label: string; count: number }> = [
    { id: "all", label: t("search.tabAll"), count: allCount },
    { id: "products", label: t("search.tabProducts"), count: productCount },
    ...(brandCount ? [{ id: "brands" as const, label: t("search.tabBrands"), count: brandCount }] : []),
    ...(categoryCount
      ? [{ id: "categories" as const, label: t("search.tabCategories"), count: categoryCount }]
      : []),
    ...(vehicleCount
      ? [{ id: "vehicles" as const, label: t("search.tabVehicles"), count: vehicleCount }]
      : []),
  ];

  const showProducts = tab === "all" || tab === "products";
  const filterProps = {
    activeBrand,
    activeCategory,
    activeStock,
    onBrand,
    onCategory,
    onStockChange,
    onClearFilters,
    tabs,
    activeTab: tab,
    onTabChange,
    categories,
    brands,
    vehicles,
  };

  return (
    <section
      id="search-results"
      className="border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)] pb-[calc(var(--mobile-nav-height)+0.5rem)] md:pb-0"
    >
      {/* ---------- RESULTS HEADER ----------
          States the query being answered and the live count in one place, so
          the toolbar below does not have to repeat it. */}
      <div className="sl-container sl-container">
        {/* The query is set in monospace because it is an identifier the customer
        will reuse, not prose. The count is a figure on a hairline, matching the
        category page exactly — a shopper moving between the two must not meet
        two different designs. */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--sl-rule)] pb-4">
          <div className="min-w-0">
            <p className="mt-1.5 flex items-center gap-2 break-words text-[1.125rem] font-bold text-[var(--sl-ink)]">
              <span
                className="inline-block h-3 w-[3px] shrink-0 bg-[var(--sl-brand)]"
                aria-hidden
              />
              {t("search.resultsFor", { query })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="sl-skel h-8 w-16" role="status" aria-live="polite" />
            ) : (
              <div className="shrink-0 border-l border-[var(--sl-rule)] pl-4">
                <p className="sl-num text-[1.75rem] font-extrabold leading-none tracking-tight text-[var(--sl-ink)]">
                  {visibleFound}
                </p>
                <p className="sl-label mb-0 mt-1 !text-[0.625rem]">
                  {visibleFound === 1 ? t("category.item") : t("category.items")}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              className="sl-btn sl-btn-secondary !min-h-10 !px-3.5 !text-[0.8125rem] lg:hidden"
            >
              {t("search.filters")}
            </button>
          </div>
        </div>

        <div className="mt-3 md:hidden">
          <Toolbar sort={sort} onSort={setSort} />
        </div>
      </div>

      {/* Results body shares the same container as the header above. */}
      <div className="sl-container sl-container">
        {/* Same two-part shape as the category page: a persistent rail from lg
            up, a sheet below it. The rail is NOT gated on filtersOpen any more,
            so on desktop the filters are simply always there instead of being
            reachable only through the (mobile) trigger button. */}
        <div className="mt-4 grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-[var(--v3-header-h)]">
              <SearchFilters {...filterProps} />
            </div>
          </aside>

          <div className="min-w-0">
          {error ? (
            <div className="mt-4">
              <ErrorState
                title={t("common.error")}
                body={error}
                /* Re-running the search means re-issuing the same query. The
                   search state is owned by the parent, so retry is expressed as
                   "go to page 1 of the same query" \u2014 which is idempotent and
                   does not invent a refresh path the parent does not expose. */
                onRetry={() => onPage(1)}
                action={{ href: "/help-support", label: t("nav.help") }}
              />
            </div>
          ) : null}

            {tab === "brands" ? (
              <ul className="overflow-hidden rounded-[var(--sl-r-lg)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]">
                {brands.map((row) => {
                  const logo = getBrandLogo(row.value);
                  return (
                    <li key={row.value} className="border-b border-[var(--sl-rule)] last:border-0">
                      <button
                        type="button"
                        onClick={() => onBrand(row.value)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--sl-sunken)]"
                      >
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="h-8 w-12 object-contain" />
                        ) : (
                          <span className="flex h-8 w-12 items-center justify-center rounded-[var(--sl-r-xs)] bg-[var(--sl-sunken)] text-[10px] font-bold text-[var(--sl-ink-3)]">
                            {row.value.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="sl-label mb-0 flex-1 !font-semibold !text-[var(--sl-ink)]">{row.value}</span>
                        <span className="sl-small shrink-0 tabular-nums">{row.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {tab === "categories" ? (
              <ul className="overflow-hidden rounded-[var(--sl-r-lg)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]">
                {categories.map((row) => (
                  <li key={row.value} className="border-b border-[var(--sl-rule)] last:border-0">
                    <button
                      type="button"
                      onClick={() => onCategory(row.value)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--sl-sunken)]"
                    >
                      <span className="sl-label mb-0 !font-semibold !text-[var(--sl-ink)]">{row.value}</span>
                      <span className="sl-small shrink-0 tabular-nums">{row.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "vehicles" ? (
              <ul className="overflow-hidden rounded-[var(--sl-r-lg)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]">
                {vehicles.map((row) => (
                  <li key={`${row.make}-${row.model}`} className="border-b border-[var(--sl-rule)] last:border-0">
                    <Link
                      href={`/vehicle-fitment/${slugifyFitment(row.make)}/${slugifyFitment(row.model)}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-[var(--sl-sunken)]"
                    >
                      <span className="font-semibold">
                        {row.make} {row.model}
                      </span>
                      <span className="sl-small shrink-0 tabular-nums">{row.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {showProducts && loading ? (
              <div role="status" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }, (_, item) => (
            <div key={item} className="sl-panel mb-2 flex items-center gap-3 p-3">
              <div className="sl-skel h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="sl-skel h-2.5 w-20" />
                <div className="sl-skel h-3.5 w-full" />
                <div className="sl-skel h-3 w-2/5" />
              </div>
              <div className="sl-skel hidden h-9 w-20 shrink-0 sm:block" />
            </div>
          ))}
          <span className="sr-only">{t("common.loading")}</span>
        </div>
            ) : null}

            {showProducts && !loading && sortedResults.length === 0 ? (
              <EmptyState
              icon={StateIcons.search}
              title={t("search.noneTitle")}
              body={t("search.noneHint")}
              action={{ href: "/category/filters", label: t("category.categories") }}
              secondaryAction={{ href: "/", label: t("search.searchAll") }}
            />
          ) : null}

            {showProducts && !loading && sortedResults.length > 0 ? (
              <>
                <div className="hidden md:block">
                  <ProductTable
                    results={sortedResults}
                    query={query}
                    addingId={addingId}
                    onOpenProduct={handleOpenProduct}
                    onAddToCart={handleAddToCart}
                  />
                </div>
                <div className="space-y-3 md:hidden">
                  {sortedResults.map((hit, index) => (
                    <SearchProductCard
                      key={hit.document?.id || hit.document?.part_number || index}
                      hit={hit}
                      query={query}
                      addingId={addingId}
                      layout="mobile"
                      index={index}
                      onOpen={() => handleOpenProduct(hit)}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {showProducts ? (
              <div
                className={`mt-4 flex flex-wrap items-center justify-between gap-3 ${
                  totalPages > 1 ? "flex" : "hidden md:flex"
                }`}
              >
                <p className="sl-small hidden md:block">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, visibleFound)} {t("category.of")} {visibleFound}
            </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => onPage(page - 1)}
                      className="sl-btn sl-btn-secondary !min-h-9 !px-3 text-sm font-semibold text-[var(--sl-ink-2)] disabled:opacity-40"
                    >
                      {t("search.prev")}
                    </button>
                    {pageItems.map((item, index) =>
                      item === "ellipsis" ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-sm text-[var(--sl-ink-3)]">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          aria-current={item === page ? "page" : undefined}
                          onClick={() => onPage(item)}
                          className={`min-h-9 min-w-9 rounded-[var(--sl-r-xs)] px-2 text-sm font-semibold ${
                            item === page
                              ? "bg-[var(--sl-brand)] text-white"
                              : "border border-[var(--sl-rule-strong)] bg-[var(--sl-surface)] text-[var(--sl-ink-2)]"
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => onPage(page + 1)}
                      className="sl-btn sl-btn-secondary !min-h-9 !px-3 text-sm font-semibold text-[var(--sl-ink-2)] disabled:opacity-40"
                    >
                      {t("search.next")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showProducts ? (
              <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-[var(--sl-brand-line)] bg-[var(--sl-brand-soft)] px-4 py-3 shadow-[var(--sl-e-2)] backdrop-blur sm:-mx-6 sm:px-6">
                <div className="mx-auto flex max-w-[1240px] flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-xs font-semibold leading-5 text-[var(--sl-ink-2)] sm:text-sm">
                    {t("search.selectedItems", { count: String(selectedCount) })}
                    <span className="mx-1.5 text-[var(--sl-ink-3)]">•</span>
                    <span>
                      {t("search.estimatedTotal", {
                        total: formatTotalPaise(estimatedTotalPaise),
                      })}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold sm:shrink-0 sm:text-sm">
                    <Link
                      href="/cart"
                      className="inline-flex min-h-10 items-center rounded-[var(--sl-r-xs)] bg-[var(--sl-brand)] px-3 text-white hover:bg-[var(--sl-brand-hover)]"
                    >
                      {t("search.viewCart", { count: String(cartCount) })}
                    </Link>
                    <svg
                      className="h-4 w-4 text-[var(--sl-brand-ink)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    <Link
                      href="/checkout"
                      className="sl-btn sl-btn-primary !min-h-10 !px-3 !text-[0.8125rem]"
                    >
                      {t("search.proceedToCheckout")}
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile filter sheet. Same device as the category page's: a scrim that
          closes on tap, a sticky titled header with an explicit close control,
          and the body capped at 85dvh so a long facet list scrolls inside the
          sheet instead of pushing the page. `lg:hidden` keeps it out of the
          way of the desktop rail above. */}
      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("search.filters")}
        >
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => setFiltersOpen(false)}
            className="absolute inset-0 bg-[var(--sl-overlay)] opacity-70"
          />
          <div className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[var(--sl-r-lg)] bg-[var(--sl-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--sl-rule)] bg-[var(--sl-surface)] px-4 py-3">
              <h2 className="sl-h2">{t("search.filters")}</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="sl-focus flex h-9 w-9 items-center justify-center rounded-[var(--sl-r)] border border-[var(--sl-rule-strong)] bg-[var(--sl-surface)] text-[var(--sl-brand-ink)]"
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
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <SearchFilters {...filterProps} showHeading={false} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TableCartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4h2l1.4 10.2a2 2 0 0 0 2 1.8h7.8a2 2 0 0 0 1.9-1.4L20 8H6.2M9 20h.01M17 20h.01"
      />
    </svg>
  );
}

function ProductTable({
  results,
  query,
  addingId,
  onOpenProduct,
  onAddToCart,
}: {
  results: SearchHit[];
  query: string;
  addingId: string;
  onOpenProduct: (hit: SearchHit) => void;
  onAddToCart: (listingId: string, name: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="sl-table-wrap overflow-x-auto">
      <table className="sl-table w-full min-w-[1000px] table-fixed text-left">
        <thead>
          <tr>
            <th className="w-[34%]">{t("search.itemName")}</th>
            <th className="w-[12%]">{t("search.partNoShort")}</th>
            <th className="w-[7%]">GST</th>
            <th className="w-[10%]">HSN</th>
            <th className="w-[9%]">LIST</th>
            <th className="w-[9%]">{t("price.mrp")}</th>
            <th className="w-[7%]">DISC</th>
            <th className="w-[8%]">{t("search.ariaStock")}</th>
            <th className="w-[9%] text-right">{t("orders.actionCol")}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((hit, index) => {
            const partData = hit.document ?? {};
            const listing = selectPreferredStorefrontListing(hit.listings);
            const title = displayProductTitle(
              partData.name || t("product.partFallback"),
              partData.part_number,
            );
            const image =
              hit.thumbUrl ||
              listing?.thumbUrl ||
              hit.imageUrl ||
              listing?.imageUrl ||
              "/images/products/placeholder.svg";
            const priced = isAuthoritativeSellingPricePaise(
              listing?.listInclusivePaise,
              listing?.netInclusivePaise,
              listing?.pricePaise,
            );
            const canAdd =
              Boolean(listing) &&
              listing?.status === "active" &&
              (listing?.stock ?? 0) > 0 &&
              priced;
            return (
              <tr
                key={hit.document?.id || hit.document?.part_number || index}
                className="align-middle"
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenProduct(hit)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--sl-r-xs)] bg-[var(--sl-brand)]"
                      aria-label={title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt=""
                        width={40}
                        height={40}
                        loading={index < 4 ? "eager" : "lazy"}
                        decoding="async"
                        className="h-full w-full object-contain p-1"
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
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm font-bold leading-tight text-[var(--sl-ink)] hover:text-[var(--sl-brand-ink)]"
                      onClick={() => onOpenProduct(hit)}
                      title={title}
                    >
                      <SearchHighlight text={title} query={query} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--sl-ink-2)]">
                  <span className="text-sm font-semibold text-[var(--sl-ink)]">{partData.part_number || "—"}</span>
                </td>
                <td className="px-3 py-2 text-xs text-[var(--sl-ink-2)]">
                  {listing?.gstRate != null ? `${listing.gstRate}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--sl-ink-2)]">
                  {listing?.hsn || "—"}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-[var(--sl-ink)]">
                  {formatPaise(listPrice(listing))}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--sl-ink-3)]">
                  {formatPaise(listing?.mrpPaise)}
                </td>
                <td className="px-3 py-2 text-sm font-semibold text-[var(--sl-ink)]">
                  <span className="rounded-[var(--sl-r)] bg-[var(--sl-brand)] px-1.5 py-0.5 text-xs font-bold text-white">
                    {typeof listing?.discountPercent === "number"
                      ? `${Math.round(listing.discountPercent)}%`
                      : "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-[var(--sl-ink)]">
                  {typeof listing?.stock === "number" && listing.status === "active"
                    ? listing.stock
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={!canAdd || addingId === listing?.id}
                    onClick={() => listing && onAddToCart(listing.id, title)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--sl-r-xs)] bg-[var(--sl-brand)] px-3 text-xs font-bold text-white hover:bg-[var(--sl-brand-hover)] disabled:cursor-not-allowed disabled:bg-[var(--sl-sunken)] disabled:text-[var(--sl-ink-3)]"
                    aria-label={`${t("product.addToCart")}: ${title}`}
                  >
                    {canAdd ? (
                      <>
                        <TableCartIcon />
                        {t("product.addToCart")}
                      </>
                    ) : priced ? (
                      t("product.outOfStock")
                    ) : (
                      t("price.onRequest")
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Toolbar({
  sort,
  onSort,
}: {
  sort: SortMode;
  onSort: (value: SortMode) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="flex items-center gap-1 text-xs font-semibold text-[var(--sl-ink-2)]">
      {t("search.sortBy")}:
      <select
        value={sort}
        onChange={(event) => {
          const next = event.target.value;
          onSort(next === "name" || next === "relevance" ? next : "price-low-high");
        }}
        className="rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] px-2 py-1 text-xs font-semibold text-[var(--sl-ink)]"
        aria-label={t("search.sortBy")}
      >
        <option value="price-low-high">{t("search.priceLowHigh")}</option>
        <option value="relevance">{t("search.relevance")}</option>
        <option value="name">{t("search.nameAZ")}</option>
      </select>
    </label>
  );
}
