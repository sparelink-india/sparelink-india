"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore, useState } from "react";

import { CatalogueProductTable } from "@/components/catalogue-product-table";
import { CatalogueViewSwitcher } from "@/components/catalogue-view-switcher";
import { EmptyState, ErrorState, StateIcons } from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import { SearchProductCard } from "@/components/search-product-card";
import {
  type CatalogueViewMode,
  getCatalogueViewServerSnapshot,
  getCatalogueViewSnapshot,
  setCatalogueView,
  subscribeCatalogueView,
} from "@/lib/catalogue-view";
import { getBrandLogo } from "@/lib/brand-logo";
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
        <h3 className="text-[11px] font-bold  text-[var(--v3-text-3)]">{title}</h3>
        {active ? (
          <button type="button" className="text-[11px] font-semibold text-[var(--v3-brand-ink)]" onClick={() => onToggle("")}>
            {tClear}
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-1">
        {visible.map((row) => {
          const checked = active === row.value;
          return (
            <li key={row.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded-[2px] px-1 py-1.5 text-sm text-slate-800 hover:bg-[var(--v3-sunk)]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(checked ? "" : row.value)}
                  className="h-4 w-4 rounded border-[var(--v3-rule-strong)] text-[var(--v3-brand-ink)] accent-[var(--v3-brand)]"
                />
                <span className="min-w-0 flex-1 truncate">{row.value}</span>
                <span className="shrink-0 text-xs text-[var(--v3-text-3)]">{row.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {rows.length > 8 ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-[var(--v3-brand-ink)]"
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
}) {
  const { t } = useI18n();
  return (
    <aside className="space-y-6 rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--v3-text)]">{t("search.filters")}</h2>
        {activeBrand || activeCategory || activeStock !== "all" ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-[var(--v3-brand-ink)]"
            onClick={onClearFilters}
          >
            {t("search.clearAll")}
          </button>
        ) : null}
      </div>
      <section className="border-b border-[var(--v3-rule)] pb-3">
        <h3 className="text-[11px] font-bold  text-[var(--v3-text-3)]">{t("search.browseHeading")}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
              className={`rounded-[2px] border px-2.5 py-1 text-[11px] font-semibold ${
                activeTab === item.id
                  ? "border-[var(--v3-brand)] bg-[var(--v3-brand)] text-white"
                  : "border-[var(--v3-rule)] text-[var(--v3-text-2)] hover:border-[var(--v3-rule-strong)]"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-[11px] font-bold  text-[var(--v3-text-3)]">{t("search.stockHeading")}</h3>
        <select
          value={activeStock}
          onChange={(event) =>
            onStockChange(event.target.value === "in_stock" ? "in_stock" : "all")
          }
          className="mt-2 h-9 w-full rounded-[2px] border border-[var(--v3-rule)] bg-white px-2 text-xs font-semibold text-[var(--v3-text-2)] outline-none focus:border-[var(--v3-brand)]"
          aria-label={t("search.stockFilterAria")}
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
          <h3 className="text-[11px] font-bold  text-[var(--v3-text-3)]">
            {t("search.tabVehicles")}
          </h3>
          <ul className="mt-2 space-y-1">
            {vehicles.slice(0, 8).map((row) => (
              <li key={`${row.make}-${row.model}`}>
                <Link
                  href={`/vehicle-fitment/${slugifyFitment(row.make)}/${slugifyFitment(row.model)}`}
                  className="flex items-center justify-between rounded-[2px] px-1 py-1.5 text-sm text-slate-800 hover:bg-[var(--v3-sunk)]"
                >
                  <span className="min-w-0 truncate">
                    {row.make} {row.model}
                  </span>
                  <span className="v3-small shrink-0 tabular-nums">{row.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
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
  const [sort, setSort] = useState<SortMode>("price-low-high");
  /* Catalogue presentation only. GRID is the default, which is what makes
     pressing Enter in the header search land on a grid rather than a table.

     Read from localStorage through `useSyncExternalStore` rather than copied
     into state from an effect, so the server and the first client render agree
     (no hydration mismatch, no flash of the wrong view).

     Deliberately NOT in the URL: the query, filters, sort and page all stay in
     their existing parameters, and adding a view parameter would have changed
     the search URL contract the brief said to preserve. */
  const view = useSyncExternalStore(
    subscribeCatalogueView,
    getCatalogueViewSnapshot,
    getCatalogueViewServerSnapshot,
  );
  const changeView = setCatalogueView;
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
      className="border-b border-[var(--v3-rule)] bg-[var(--v3-sunk)] pb-[calc(var(--mobile-nav-height)+0.5rem)] md:pb-0"
    >
      {/* ---------- RESULTS HEADER ----------
          States the query being answered and the live count in one place, so
          the toolbar below does not have to repeat it. */}
      <div className="v3-container v3-container">
        {/* The query is set in monospace because it is an identifier the customer
        will reuse, not prose. The count is a figure on a hairline, matching the
        category page exactly — a shopper moving between the two must not meet
        two different designs. */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--v3-rule)] pb-4">
          <div className="min-w-0">
            <p className="v3-label flex items-center gap-2">
              <span
                className="inline-block h-3 w-[3px] shrink-0 bg-[var(--v3-brand)]"
                aria-hidden
              />
              {/* The heading label. The {query} placeholder is filled from
                  the live query so the sentence is complete on its own line;
                  the query is also rendered below in `v3-partno`, which is
                  the larger typographic treatment. The dictionary string
                  carries no surrounding quotes - a quoted part number in a
                  heading read as a truncated string rather than a part. */}
              {t("search.resultsFor", { query })}
            </p>
            <p className="v3-partno mt-1.5 break-words !text-[1.125rem] !font-bold !text-[var(--v3-text)]">
              {query}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="v3-skeleton h-8 w-16" role="status" aria-live="polite" />
            ) : (
              <div className="shrink-0 border-l border-[var(--v3-rule)] pl-4">
                <p className="v3-num text-[1.75rem] font-extrabold leading-none tracking-tight text-[var(--v3-text)]">
                  {visibleFound}
                </p>
                <p className="v3-label mt-1 !text-[0.625rem]">
                  {visibleFound === 1 ? t("category.item") : t("category.items")}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              className="v3-btn v3-btn-outline !min-h-10 !px-3.5 !text-[0.8125rem] md:hidden"
            >
              {t("search.filters")}
            </button>
          </div>
        </div>

        {/* Sort + view switcher.

            This row used to be `md:hidden`, which left desktop with no sort
            control at all. It is now visible at every breakpoint so the view
            switcher has exactly one home and works on both phone and desktop.
            The sort control appearing on desktop is additive - nothing is
            removed - and the sort state itself is unchanged. */} 
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Toolbar sort={sort} onSort={setSort} />
          <CatalogueViewSwitcher value={view} onChange={changeView} />
        </div>
      </div>

      {/* Results body shares the same container as the header above. */}
      <div className="v3-container v3-container">
        {filtersOpen ? (
          <div className="mt-3 hidden md:block">
            <SearchFilters {...filterProps} />
          </div>
        ) : null}

        <div className="mt-4 min-w-0">
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
              <ul className="overflow-hidden rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white">
                {brands.map((row) => {
                  const logo = getBrandLogo(row.value);
                  return (
                    <li key={row.value} className="border-b border-[var(--v3-rule)] last:border-0">
                      <button
                        type="button"
                        onClick={() => onBrand(row.value)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--v3-sunk)]"
                      >
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="h-8 w-12 object-contain" />
                        ) : (
                          <span className="flex h-8 w-12 items-center justify-center rounded-[2px] bg-[var(--v3-sunk)] text-[10px] font-bold text-[var(--v3-text-3)]">
                            {row.value.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="v3-label flex-1 !font-semibold !text-[var(--v3-text)]">{row.value}</span>
                        <span className="v3-small shrink-0 tabular-nums">{row.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {tab === "categories" ? (
              <ul className="overflow-hidden rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white">
                {categories.map((row) => (
                  <li key={row.value} className="border-b border-[var(--v3-rule)] last:border-0">
                    <button
                      type="button"
                      onClick={() => onCategory(row.value)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--v3-sunk)]"
                    >
                      <span className="v3-label !font-semibold !text-[var(--v3-text)]">{row.value}</span>
                      <span className="v3-small shrink-0 tabular-nums">{row.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "vehicles" ? (
              <ul className="overflow-hidden rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white">
                {vehicles.map((row) => (
                  <li key={`${row.make}-${row.model}`} className="border-b border-[var(--v3-rule)] last:border-0">
                    <Link
                      href={`/vehicle-fitment/${slugifyFitment(row.make)}/${slugifyFitment(row.model)}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-[var(--v3-sunk)]"
                    >
                      <span className="font-semibold">
                        {row.make} {row.model}
                      </span>
                      <span className="v3-small shrink-0 tabular-nums">{row.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {showProducts && loading ? (
              <div role="status" aria-busy="true" aria-live="polite">
          {Array.from({ length: 6 }, (_, item) => (
            <div key={item} className="v3-panel mb-2 flex items-center gap-3 p-3">
              <div className="v3-skeleton h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="v3-skeleton h-2.5 w-20" />
                <div className="v3-skeleton h-3.5 w-full" />
                <div className="v3-skeleton h-3 w-2/5" />
              </div>
              <div className="v3-skeleton hidden h-9 w-20 shrink-0 sm:block" />
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
              <CatalogueResults
                view={view}
                results={sortedResults}
                query={query}
                addingId={addingId}
                onOpenProduct={onOpenProduct}
                onAddToCart={onAddToCart}
              />
            ) : null}

            {showProducts ? (
              <div
                className={`mt-4 flex flex-wrap items-center justify-between gap-3 ${
                  totalPages > 1 ? "flex" : "hidden md:flex"
                }`}
              >
                <p className="v3-small hidden md:block">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, visibleFound)} {t("category.of")} {visibleFound}
            </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => onPage(page - 1)}
                      className="v3-btn v3-btn-outline !min-h-9 !px-3 text-sm font-semibold text-[var(--v3-text-2)] disabled:opacity-40"
                    >
                      {t("search.prev")}
                    </button>
                    {pageItems.map((item, index) =>
                      item === "ellipsis" ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-sm text-[var(--v3-text-3)]">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          aria-current={item === page ? "page" : undefined}
                          onClick={() => onPage(item)}
                          className={`min-h-9 min-w-9 rounded-[2px] px-2 text-sm font-semibold ${
                            item === page
                              ? "bg-[var(--v3-brand)] text-white"
                              : "border border-[var(--v3-rule-strong)] bg-white text-[var(--v3-text-2)]"
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
                      className="v3-btn v3-btn-outline !min-h-9 !px-3 text-sm font-semibold text-[var(--v3-text-2)] disabled:opacity-40"
                    >
                      {t("search.next")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showProducts ? (
              <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-[var(--v3-brand-line)] bg-[var(--v3-brand-soft)]/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-6 sm:px-6">
                <div className="mx-auto flex max-w-[1240px] flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-xs font-semibold leading-5 text-[var(--v3-text-2)] sm:text-sm">
                    Selected: {selectedCount} items
                    <span className="mx-1.5 text-[var(--v3-text-3)]">•</span>
                    <span>Estimated Total: {formatTotalPaise(estimatedTotalPaise)}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold sm:shrink-0 sm:text-sm">
                    <Link
                      href="/cart"
                      className="inline-flex min-h-10 items-center rounded-[2px] bg-[var(--v3-brand)] px-3 text-white hover:bg-[var(--v3-brand-hover)]"
                    >
                      View Cart ({cartCount})
                    </Link>
                    <svg
                      className="h-4 w-4 text-[var(--v3-brand-ink)]"
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
                      className="v3-btn v3-btn-primary !min-h-10 !px-3 !text-[0.8125rem]"
                    >
                      Proceed to Checkout
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
    </section>
  );
}

/**
 * Renders a catalogue listing in the selected view mode.
 *
 * GRID is the default, and its desktop column count is the requirement:
 * exactly 4 products per row, 3 on tablet, 2 on a phone. The numbers live in
 * `CATALOGUE_GRID_COLUMNS` so "4 on desktop" has one definition.
 *
 * Mobile is no longer a separate presentation. The page used to render a table
 * on desktop and compact rows on mobile with no way to choose; now the chosen
 * mode is honoured everywhere and each mode reflows instead of overflowing.
 * LIST is the one mode that cannot reflow - its table carries a 920px minimum
 * width - so below `md` it degrades to stacked rows rather than scrolling
 * sideways.
 */
function CatalogueResults({
  view,
  results,
  query,
  addingId,
  onOpenProduct,
  onAddToCart,
}: {
  view: CatalogueViewMode;
  results: SearchHit[];
  query: string;
  addingId: string;
  onOpenProduct: (hit: SearchHit) => void;
  onAddToCart: (listingId: string, name: string) => void;
}) {
  const cards = (layout: "grid" | "tiles" | "detailed", gap: string) => (
    <div className={gap}>
      {results.map((hit, index) => (
        <SearchProductCard
          key={hit.document?.id || hit.document?.part_number || index}
          hit={hit}
          query={query}
          addingId={addingId}
          layout={layout}
          index={index}
          onOpen={() => onOpenProduct(hit)}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );

  if (view === "list") {
    return (
      <>
        <div className="hidden md:block">
          <CatalogueProductTable
            results={results}
            query={query}
            addingId={addingId}
            onOpenProduct={onOpenProduct}
            onAddToCart={onAddToCart}
          />
        </div>
        <div className="space-y-3 md:hidden">
          {results.map((hit, index) => (
            <SearchProductCard
              key={hit.document?.id || hit.document?.part_number || index}
              hit={hit}
              query={query}
              addingId={addingId}
              layout="mobile"
              index={index}
              onOpen={() => onOpenProduct(hit)}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </>
    );
  }
  if (view === "tiles") {
    return cards("tiles", "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4");
  }
  if (view === "detailed") {
    return cards("detailed", "grid grid-cols-1 gap-4 lg:grid-cols-2");
  }
  return cards("grid", "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4");
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
    <label className="flex items-center gap-1 text-xs font-semibold text-[var(--v3-text-2)]">
      {t("search.sortBy")}:
      <select
        value={sort}
        onChange={(event) => {
          const next = event.target.value;
          onSort(next === "name" || next === "relevance" ? next : "price-low-high");
        }}
        className="rounded-md border border-[var(--v3-rule)] bg-white px-2 py-1 text-xs font-semibold text-slate-800"
        aria-label={t("search.sortAria")}
      >
        <option value="price-low-high">{t("search.priceLowHigh")}</option>
        <option value="relevance">{t("search.relevance")}</option>
        <option value="name">{t("search.nameAZ")}</option>
      </select>
    </label>
  );
}
