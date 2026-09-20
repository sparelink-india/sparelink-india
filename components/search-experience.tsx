"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import { SearchProductCard } from "@/components/search-product-card";
import { getBrandLogo } from "@/lib/brand-logo";
import { readRecentSearches } from "@/lib/recent-searches";
import { slugifyFitment } from "@/lib/vehicle-fitment";

export type SearchListing = {
  id: string;
  sku?: string | null;
  pricePaise: number;
  stock: number | null;
  status: string;
  gstRate?: number | null;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  isPensol?: boolean;
  imageUrl?: string | null;
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
  listings?: SearchListing[];
};

export type FacetRow = { value: string; count: number };
export type VehicleRow = { make: string; model: string; count: number };

export type SearchTab = "all" | "products" | "brands" | "categories" | "vehicles";

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
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
        {active ? (
          <button type="button" className="text-[11px] font-semibold text-[#7a1233]" onClick={() => onToggle("")}>
            {tClear}
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-1">
        {visible.map((row) => {
          const checked = active === row.value;
          return (
            <li key={row.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(checked ? "" : row.value)}
                  className="h-4 w-4 rounded border-slate-300 text-[#7a1233] accent-[#7a1233]"
                />
                <span className="min-w-0 flex-1 truncate">{row.value}</span>
                <span className="shrink-0 text-xs text-slate-500">{row.count}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {rows.length > 8 ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-[#7a1233]"
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
  onBrand,
  onCategory,
  categories,
  brands,
  vehicles,
}: {
  activeBrand: string;
  activeCategory: string;
  onBrand: (brand: string) => void;
  onCategory: (category: string) => void;
  categories: FacetRow[];
  brands: FacetRow[];
  vehicles: VehicleRow[];
}) {
  const { t } = useI18n();
  return (
    <aside className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">{t("search.filters")}</h2>
        {activeBrand || activeCategory ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-[#7a1233]"
            onClick={() => {
              onBrand("");
              onCategory("");
            }}
          >
            {t("search.clearAll")}
          </button>
        ) : null}
      </div>
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
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {t("search.tabVehicles")}
          </h3>
          <ul className="mt-2 space-y-1">
            {vehicles.slice(0, 8).map((row) => (
              <li key={`${row.make}-${row.model}`}>
                <Link
                  href={`/vehicle-fitment/${slugifyFitment(row.make)}/${slugifyFitment(row.model)}`}
                  className="flex items-center justify-between rounded-lg px-1 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate">
                    {row.make} {row.model}
                  </span>
                  <span className="text-xs text-slate-500">{row.count}</span>
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
  tab,
  addingId,
  onTabChange,
  onBrand,
  onCategory,
  onPage,
  onOpenProduct,
  onAddToCart,
  onSearch,
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
  tab: SearchTab;
  addingId: string;
  onTabChange: (tab: SearchTab) => void;
  onBrand: (brand: string) => void;
  onCategory: (category: string) => void;
  onPage: (page: number) => void;
  onOpenProduct: (hit: SearchHit) => void;
  onAddToCart: (listingId: string, name: string) => void;
  onSearch: (query: string) => void;
}) {
  const { t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<"relevance" | "name">("relevance");
  const recent = useMemo(() => readRecentSearches(), [query, found]);
  const totalPages = Math.max(1, Math.ceil(found / Math.max(perPage, 1)));
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
  const sortedResults = useMemo(() => {
    if (sort !== "name") return results;
    return [...results].sort((a, b) =>
      String(a.document?.name || "").localeCompare(String(b.document?.name || ""), "en", {
        sensitivity: "base",
      }),
    );
  }, [results, sort]);

  const filterProps = {
    activeBrand,
    activeCategory,
    onBrand,
    onCategory,
    categories,
    brands,
    vehicles,
  };

  return (
    <section id="search-results" className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#7a1233]">{t("search.parts")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {t("search.resultsFor", { query })}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {loading
              ? t("search.searching")
              : found === 1
                ? t("search.foundOne", { query })
                : t("search.found", { count: found, query })}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("search.tabsLabel")}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => onTabChange(item.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                tab === item.id
                  ? "bg-[#7a1233] text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            {t("search.filters")}
          </button>
          <Toolbar
            found={found}
            layout={layout}
            sort={sort}
            onLayout={setLayout}
            onSort={setSort}
          />
        </div>
        {filtersOpen ? (
          <div className="mt-3 lg:hidden">
            <SearchFilters {...filterProps} />
          </div>
        ) : null}

        <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(12rem,16.25rem)_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <SearchFilters {...filterProps} />
          </div>

          <div className="min-w-0">
            <div className="mb-3 hidden items-center justify-between gap-3 lg:flex">
              <p className="text-sm font-semibold text-slate-800">
                {loading
                  ? t("search.searching")
                  : t("search.showing", {
                      from: found ? (page - 1) * perPage + 1 : 0,
                      to: Math.min(page * perPage, found),
                      total: found,
                    })}
              </p>
              <Toolbar found={found} layout={layout} sort={sort} onLayout={setLayout} onSort={setSort} />
            </div>

            {error ? (
              <p className="mb-3 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}

            {tab === "brands" ? (
              <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {brands.map((row) => {
                  const logo = getBrandLogo(row.value);
                  return (
                    <li key={row.value} className="border-b border-slate-100 last:border-0">
                      <button
                        type="button"
                        onClick={() => onBrand(row.value)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="h-8 w-12 object-contain" />
                        ) : (
                          <span className="flex h-8 w-12 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                            {row.value.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="flex-1 font-semibold">{row.value}</span>
                        <span className="text-xs text-slate-500">{row.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {tab === "categories" ? (
              <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {categories.map((row) => (
                  <li key={row.value} className="border-b border-slate-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => onCategory(row.value)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="font-semibold">{row.value}</span>
                      <span className="text-xs text-slate-500">{row.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "vehicles" ? (
              <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {vehicles.map((row) => (
                  <li key={`${row.make}-${row.model}`} className="border-b border-slate-100 last:border-0">
                    <Link
                      href={`/vehicle-fitment/${slugifyFitment(row.make)}/${slugifyFitment(row.model)}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                    >
                      <span className="font-semibold">
                        {row.make} {row.model}
                      </span>
                      <span className="text-xs text-slate-500">{row.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {showProducts && loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                  <div key={item} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-200" />
                ))}
              </div>
            ) : null}

            {showProducts && !loading && results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold">{t("search.noneTitle")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("search.noneHint")}</p>
              </div>
            ) : null}

            {showProducts && !loading ? (
              layout === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {sortedResults.map((hit, index) => (
                    <SearchProductCard
                      key={hit.document?.id || hit.document?.part_number || index}
                      hit={hit}
                      query={query}
                      addingId={addingId}
                      layout="grid"
                      onOpen={() => onOpenProduct(hit)}
                      onAddToCart={onAddToCart}
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {sortedResults.map((hit, index) => (
                    <SearchProductCard
                      key={hit.document?.id || hit.document?.part_number || index}
                      hit={hit}
                      query={query}
                      addingId={addingId}
                      layout="list"
                      onOpen={() => onOpenProduct(hit)}
                      onAddToCart={onAddToCart}
                    />
                  ))}
                </div>
              )
            ) : null}

            {showProducts && totalPages > 1 ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPage(page - 1)}
                  className="min-h-10 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-40"
                >
                  {t("search.prev")}
                </button>
                <p className="text-xs text-slate-600">{t("search.page", { page, pages: totalPages })}</p>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPage(page + 1)}
                  className="min-h-10 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-40"
                >
                  {t("search.next")}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
          {recent.length ? (
            <button
              type="button"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
              onClick={() => onSearch(recent[0] || query)}
            >
              {t("search.recent")}: {recent[0]}
            </button>
          ) : null}
          <Link
            href="/vehicle-fitment"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {t("search.byVehicle")}
          </Link>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            onClick={() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus()}
          >
            {t("search.byPartNumber")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Toolbar({
  found,
  layout,
  sort,
  onLayout,
  onSort,
}: {
  found: number;
  layout: "grid" | "list";
  sort: "relevance" | "name";
  onLayout: (value: "grid" | "list") => void;
  onSort: (value: "relevance" | "name") => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <label className="hidden items-center gap-1 text-xs font-semibold text-slate-600 sm:flex">
        {t("search.sortBy")}
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value === "name" ? "name" : "relevance")}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
        >
          <option value="relevance">{t("search.relevance")}</option>
          <option value="name">{t("search.nameAZ")}</option>
        </select>
      </label>
      {found > 0 ? (
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            aria-label={t("search.gridView")}
            className={`px-2.5 py-1.5 text-xs font-bold ${layout === "grid" ? "bg-[#7a1233] text-white" : "text-slate-600"}`}
            onClick={() => onLayout("grid")}
          >
            ▦
          </button>
          <button
            type="button"
            aria-label={t("search.listView")}
            className={`px-2.5 py-1.5 text-xs font-bold ${layout === "list" ? "bg-[#7a1233] text-white" : "text-slate-600"}`}
            onClick={() => onLayout("list")}
          >
            ☰
          </button>
        </div>
      ) : null}
    </div>
  );
}
