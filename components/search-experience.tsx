"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
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
    <aside className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">{t("search.filters")}</h2>
        {activeBrand || activeCategory || activeStock !== "all" ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-[#7a1233]"
            onClick={onClearFilters}
          >
            {t("search.clearAll")}
          </button>
        ) : null}
      </div>
      <section className="border-b border-slate-100 pb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Browse</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                activeTab === item.id
                  ? "border-[#7a1233] bg-[#7a1233] text-white"
                  : "border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Stock</h3>
        <select
          value={activeStock}
          onChange={(event) =>
            onStockChange(event.target.value === "in_stock" ? "in_stock" : "all")
          }
          className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#7a1233]"
          aria-label="Stock filter"
        >
          <option value="all">All Stock</option>
          <option value="in_stock">In Stock</option>
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
  const [filtersOpen] = useState(false);
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
      className="border-b border-slate-200 bg-slate-50 pb-[calc(var(--mobile-nav-height)+0.5rem)] md:pb-0"
    >
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <div className="mt-4 rounded-xl bg-white p-3 shadow-sm md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-700">
              {loading ? t("search.searching") : `Showing ${visibleFound} items`}
            </p>
            <Toolbar sort={sort} onSort={setSort} />
          </div>
        </div>
        {filtersOpen ? (
          <div className="mt-3 hidden md:block">
            <SearchFilters {...filterProps} />
          </div>
        ) : null}

        <div className="mt-4 min-w-0">
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
              <div className="space-y-2" aria-hidden="true">
                {Array.from({ length: 8 }, (_, item) => (
                  <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
            ) : null}

            {showProducts && !loading && sortedResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h3 className="text-lg font-bold">{t("search.noneTitle")}</h3>
                <p className="mt-1 text-sm text-slate-500">{t("search.noneHint")}</p>
              </div>
            ) : null}

            {showProducts && !loading && sortedResults.length > 0 ? (
              <>
                <div className="hidden md:block">
                  <ProductTable
                    results={sortedResults}
                    query={query}
                    addingId={addingId}
                    onOpenProduct={onOpenProduct}
                    onAddToCart={onAddToCart}
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
                      onOpen={() => onOpenProduct(hit)}
                      onAddToCart={onAddToCart}
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
                <p className="hidden text-sm text-slate-600 md:block">
                  Showing {visibleFound ? (page - 1) * perPage + 1 : 0} of {visibleFound} items
                </p>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => onPage(page - 1)}
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 disabled:opacity-40"
                    >
                      {t("search.prev")}
                    </button>
                    {pageItems.map((item, index) =>
                      item === "ellipsis" ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-sm text-slate-500">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          aria-current={item === page ? "page" : undefined}
                          onClick={() => onPage(item)}
                          className={`min-h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${
                            item === page
                              ? "bg-[#7a1233] text-white"
                              : "border border-slate-300 bg-white text-slate-700"
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
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 disabled:opacity-40"
                    >
                      {t("search.next")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showProducts ? (
              <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-[#d8b9bc] bg-[#ead6d7]/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-6 sm:px-6">
                <div className="mx-auto flex max-w-[1240px] flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-xs font-semibold leading-5 text-slate-700 sm:text-sm">
                    Selected: {selectedCount} items
                    <span className="mx-1.5 text-slate-400">•</span>
                    <span>Estimated Total: {formatTotalPaise(estimatedTotalPaise)}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold sm:shrink-0 sm:text-sm">
                    <Link
                      href="/cart"
                      className="inline-flex min-h-10 items-center rounded-lg bg-[#7a1233] px-3 text-white hover:bg-[#611029]"
                    >
                      View Cart ({cartCount})
                    </Link>
                    <span className="text-[#7a1233]">•</span>
                    <Link
                      href="/checkout"
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#7a1233] px-3 text-white hover:bg-[#611029]"
                    >
                      Proceed to Checkout <span aria-hidden="true">→</span>
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
    <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
        <thead className="bg-[#7a1233] text-sm font-bold text-white">
          <tr>
            <th className="w-[38%] px-3 py-2.5">Item Name</th>
            <th className="w-[13%] px-3 py-2.5">Part No.</th>
            <th className="w-[7%] px-3 py-2.5">GST</th>
            <th className="w-[11%] px-3 py-2.5">HSN</th>
            <th className="w-[10%] px-3 py-2.5">LIST</th>
            <th className="w-[10%] px-3 py-2.5">MRP</th>
            <th className="w-[7%] px-3 py-2.5">DISC</th>
            <th className="w-[10%] px-3 py-2.5 text-right">Action</th>
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
                className="border-t border-slate-100 align-middle hover:bg-slate-50/70"
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenProduct(hit)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7a1233]"
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
                      className="min-w-0 flex-1 truncate text-left text-sm font-bold leading-tight text-slate-950 hover:text-[#7a1233]"
                      onClick={() => onOpenProduct(hit)}
                      title={title}
                    >
                      <SearchHighlight text={title} query={query} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">
                  <span className="text-sm font-semibold text-slate-800">{partData.part_number || "—"}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {listing?.gstRate != null ? `${listing.gstRate}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600">
                  {listing?.hsn || "—"}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                  {formatPaise(listPrice(listing))}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatPaise(listing?.mrpPaise)}
                </td>
                <td className="px-3 py-2 text-sm font-semibold text-slate-800">
                  <span className="rounded-md bg-[#7a1233] px-1.5 py-0.5 text-xs font-bold text-white">
                    {typeof listing?.discountPercent === "number"
                      ? `${Math.round(listing.discountPercent)}%`
                      : "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={!canAdd || addingId === listing?.id}
                    onClick={() => listing && onAddToCart(listing.id, title)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#7a1233] px-3 text-xs font-bold text-white hover:bg-[#611029] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
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
    <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
      {t("search.sortBy")}:
      <select
        value={sort}
        onChange={(event) => {
          const next = event.target.value;
          onSort(next === "name" || next === "relevance" ? next : "price-low-high");
        }}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
        aria-label="Sort results"
      >
        <option value="price-low-high">Price Low-High</option>
        <option value="relevance">{t("search.relevance")}</option>
        <option value="name">{t("search.nameAZ")}</option>
      </select>
    </label>
  );
}
