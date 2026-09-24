"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/components/preferences-provider";
import { SearchHighlight } from "@/components/search-highlight";
import { getBrandLogo } from "@/lib/brand-logo";
import type { MessageKey } from "@/lib/i18n";
import { displayProductTitle } from "@/lib/product-detail-fields";
import { readRecentSearches, rememberSearch } from "@/lib/recent-searches";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";
import { slugifyFitment } from "@/lib/vehicle-fitment";

type SearchPanelTab = "all" | "products" | "brands" | "categories" | "vehicles" | "articles";

type Listing = {
  id?: string;
  sku?: string | null;
  pricePaise?: number;
  stock?: number | null;
  status?: string;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

export type HeaderSearchProduct = {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  mediumUrl: string | null;
  listing?: Listing;
};

type FacetRow = { value: string; count: number };
type VehicleRow = { make: string; model: string; count: number };

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m1.2-4.3a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

function CartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-2 6h14M10 21a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4z"
      />
    </svg>
  );
}

function TabIcon({ kind }: { kind: SearchPanelTab }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (kind === "all") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    );
  }
  if (kind === "products") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      </svg>
    );
  }
  if (kind === "brands") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
      </svg>
    );
  }
  if (kind === "categories") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h7v7H4V6zm9 0h7v4h-7V6zM4 15h7v5H4v-5zm9-3h7v8h-7v-8z" />
      </svg>
    );
  }
  if (kind === "vehicles") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-5h14l2 5M5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10v16H7zM9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function rupees(paise: number) {
  return (paise / 100).toLocaleString("en-IN");
}

function mapHits(results: unknown, fallbackName: string): HeaderSearchProduct[] {
  if (!Array.isArray(results)) return [];
  return results.map((hit, index) => {
    const row = (hit ?? {}) as {
      document?: Record<string, unknown>;
      imageUrl?: string | null;
      thumbUrl?: string | null;
      mediumUrl?: string | null;
      listings?: Listing[];
    };
    const doc = row.document ?? {};
    const listing = selectPreferredStorefrontListing(
      Array.isArray(row.listings) ? row.listings : undefined,
    );
    const partNumber = String(doc.part_number || listing?.sku || "");
    const name = String(doc.name || fallbackName);
    return {
      id: String(doc.id || partNumber || index),
      name: displayProductTitle(name, partNumber),
      partNumber,
      brand: String(doc.brand || ""),
      category: String(doc.category || ""),
      imageUrl:
        (typeof row.imageUrl === "string" && row.imageUrl) ||
        (typeof listing?.imageUrl === "string" && listing.imageUrl) ||
        null,
      thumbUrl:
        (typeof row.thumbUrl === "string" && row.thumbUrl) ||
        (typeof listing?.thumbUrl === "string" && listing.thumbUrl) ||
        null,
      mediumUrl:
        (typeof row.mediumUrl === "string" && row.mediumUrl) ||
        (typeof listing?.mediumUrl === "string" && listing.mediumUrl) ||
        null,
      listing,
    };
  });
}

function CompactPrice({ listing }: { listing?: Listing }) {
  const { t } = useI18n();
  const list = listing?.listInclusivePaise ?? listing?.pricePaise ?? 0;
  const net = listing?.netInclusivePaise ?? list;
  const priced = isAuthoritativeSellingPricePaise(list, net, listing?.pricePaise);
  if (!priced) {
    return <span className="text-sm font-extrabold text-slate-700">{t("price.onRequest")}</span>;
  }
  return <span className="text-base font-extrabold text-slate-950">₹{rupees(net || list)}</span>;
}

function stockText(
  listing: Listing | undefined,
  t: (key: MessageKey, vars?: Record<string, string>) => string,
) {
  if (!listing) return "";
  const list = listing.listInclusivePaise ?? listing.pricePaise ?? 0;
  const net = listing.netInclusivePaise ?? list;
  const priced = isAuthoritativeSellingPricePaise(list, net, listing.pricePaise);
  const stock = listing.stock ?? 0;
  if (!priced) return t("price.onRequest");
  if (listing.status !== "active" || stock <= 0) return t("product.outOfStock");
  if (stock <= 5) return t("product.lowStock");
  return t("product.inStock", { count: String(stock) });
}

function SidebarRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="shrink-0 text-slate-400" aria-hidden>
        ›
      </span>
    </button>
  );
}

export function HeaderSearchField({
  value,
  onChange,
  onSubmitSearch,
  searchLoading,
  onOpenProduct,
  onAddToCart,
  panelHost,
  orderMode = false,
  orderPage = false,
  categoryOptions = [],
  activeCategory = "",
  onCategoryChange,
  stockFilter = "all",
  onStockFilterChange,
  onClearFilters,
  mobileCartHref,
  mobileCartCount = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmitSearch: (nextQuery?: string) => void;
  searchLoading: boolean;
  onOpenProduct?: (product: HeaderSearchProduct) => void;
  onAddToCart?: (listingId: string, unitPaise?: number) => Promise<void> | void;
  panelHost?: HTMLElement | null;
  orderMode?: boolean;
  orderPage?: boolean;
  categoryOptions?: FacetRow[];
  activeCategory?: string;
  onCategoryChange?: (value: string) => void;
  stockFilter?: "all" | "in_stock";
  onStockFilterChange?: (value: "all" | "in_stock") => void;
  onClearFilters?: () => void;
  mobileCartHref?: string;
  mobileCartCount?: number;
}) {
  const { t } = useI18n();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const suppressOpenRef = useRef(false);
  const [panelTab, setPanelTab] = useState<SearchPanelTab>("all");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<HeaderSearchProduct[]>([]);
  const [brands, setBrands] = useState<FacetRow[]>([]);
  const [categories, setCategories] = useState<FacetRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [found, setFound] = useState(0);
  const [page, setPage] = useState(1);
  const [suggesting, setSuggesting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addingId, setAddingId] = useState("");
  const autocompleteGen = useRef(0);
  const autocompleteInFlight = useRef(false);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const recent = readRecentSearches();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const suppressAutocomplete = orderPage && !hasUserEdited;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const q = value.trim();
    const gen = ++autocompleteGen.current;
    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = null;
    if (suppressAutocomplete) {
      return;
    }

    if (!q || q.length < 2) {
      autocompleteInFlight.current = false;
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      if (gen !== autocompleteGen.current || controller.signal.aborted) return;
      autocompleteInFlight.current = true;
      setSuggesting(true);
      void fetch(`/api/search/parts?q=${encodeURIComponent(q)}&page=1&perPage=24`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (gen !== autocompleteGen.current || controller.signal.aborted) return;
          const rows = mapHits(data?.results, t("product.partFallback"));
          setSuggestions(rows);
          setBrands(Array.isArray(data?.facets?.brands) ? data.facets.brands : []);
          setCategories(Array.isArray(data?.facets?.categories) ? data.facets.categories : []);
          setVehicles(Array.isArray(data?.vehicles) ? data.vehicles : []);
          setFound(typeof data?.found === "number" ? data.found : rows.length);
          setPage(1);
          setActiveIndex(-1);
          setPanelTab("all");
          const focused = Boolean(rootRef.current?.contains(document.activeElement));
          if (focused && !suppressOpenRef.current) setOpen(true);
          rememberSearch(q);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (gen !== autocompleteGen.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (gen !== autocompleteGen.current) return;
          autocompleteInFlight.current = false;
        });
    }, 300);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
      autocompleteInFlight.current = false;
    };
  }, [suppressAutocomplete, t, value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function loadMore() {
    const q = value.trim();
    if (!q || q.length < 2) return;
    if (loadingMoreRef.current || suggesting || autocompleteInFlight.current) return;
    if (suggestions.length >= found) return;
    const gen = autocompleteGen.current;
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const response = await fetch(
        `/api/search/parts?q=${encodeURIComponent(q)}&page=${nextPage}&perPage=24`,
        { cache: "no-store", signal: controller.signal },
      );
      if (gen !== autocompleteGen.current || controller.signal.aborted) return;
      if (!response.ok) return;
      const data = await response.json();
      if (gen !== autocompleteGen.current || controller.signal.aborted) return;
      const rows = mapHits(data?.results, t("product.partFallback"));
      setSuggestions((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...rows.filter((item) => !seen.has(item.id))];
      });
      setPage(nextPage);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      /* keep existing rows */
    } finally {
      if (loadMoreAbortRef.current === controller) loadMoreAbortRef.current = null;
      if (gen === autocompleteGen.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  function chooseProduct(item: HeaderSearchProduct) {
    setOpen(false);
    if (onOpenProduct) {
      onOpenProduct(item);
      return;
    }
    onSubmitSearch(item.partNumber || item.name);
  }

  async function addListing(item: HeaderSearchProduct, event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const listingId = item.listing?.id;
    if (!listingId || !onAddToCart) return;
    setAddingId(listingId);
    try {
      const unitPaise =
        item.listing?.netInclusivePaise ??
        item.listing?.listInclusivePaise ??
        item.listing?.pricePaise ??
        0;
      await onAddToCart(listingId, unitPaise);
    } finally {
      setAddingId("");
    }
  }

  function submitForm() {
    const q = value.trim();
    if (!q) return;
    suppressOpenRef.current = true;
    setHasUserEdited(false);
    setOpen(false);
    setActiveIndex(-1);
    onSubmitSearch(q);
  }

  const canSuggest = value.trim().length >= 2;
  const showIdle = open && !canSuggest && recent.length > 0;
  const showDropdown =
    open &&
    (showIdle ||
      (canSuggest &&
        (suggesting ||
          suggestions.length > 0 ||
          brands.length > 0 ||
          categories.length > 0 ||
          vehicles.length > 0 ||
          !suggesting)));
  const productCount = found;
  const brandCount = brands.length;
  const categoryCount = categories.length;
  const vehicleCount = vehicles.length;
  const articleCount = 0;
  const allCount = productCount + brandCount + categoryCount + vehicleCount + articleCount;
  const panelTabs: Array<{ id: SearchPanelTab; label: string; count: number }> = [
    { id: "all", label: t("search.tabAll"), count: allCount },
    { id: "products", label: t("search.tabProducts"), count: productCount },
    { id: "brands", label: t("search.tabBrands"), count: brandCount },
    { id: "categories", label: t("search.tabCategories"), count: categoryCount },
    { id: "vehicles", label: t("search.tabVehicles"), count: vehicleCount },
    { id: "articles", label: t("search.tabArticles"), count: articleCount },
  ];
  const showProductRows = panelTab === "all" || panelTab === "products";
  const sidebarCategories = categories.slice(0, 8);
  const sidebarBrands = brands.slice(0, 8);
  const orderCategories = categoryOptions.length ? categoryOptions : categories;

  const panel = showDropdown ? (
    <div
      id={listId}
      ref={panelRef}
      role="listbox"
      aria-label={t("search.tabsLabel")}
      className="absolute inset-x-3 z-[70] mt-1.5 flex max-h-[min(76dvh,720px)] min-h-[min(48dvh,480px)] w-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] md:inset-x-6"
    >
      {showIdle ? (
        <div className="p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {t("search.recentSearches")}
          </p>
          <div className="flex flex-wrap gap-2">
            {recent.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:border-[#7a1233]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setOpen(true);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 overflow-x-auto border-b border-slate-200 px-3 py-2.5" role="tablist">
            <div className="flex min-w-max gap-2">
              {panelTabs.map((item) => {
                const active = panelTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setPanelTab(item.id)}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold ${
                      active
                        ? "bg-[#7a1233] text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                  >
                    <TabIcon kind={item.id} />
                    <span>
                      {item.label} ({item.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(11rem,17.5rem)_minmax(0,1fr)]">
            <aside className="hidden min-h-0 min-w-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
              <section className="shrink-0 px-3 pt-4">
                <p className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {t("search.relatedCategories")}
                </p>
                <div className="mt-1">
                  {sidebarCategories.map((row) => (
                    <SidebarRow
                      key={row.value}
                      label={row.value}
                      onClick={() => {
                        onChange(row.value);
                        setOpen(true);
                      }}
                      icon={
                        <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h7" />
                        </svg>
                      }
                    />
                  ))}
                </div>
              </section>
              <div className="mx-5 my-2 border-t border-slate-200" />
              <section className="shrink-0 px-3">
                <p className="px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {t("search.popularBrands")}
                </p>
                <div className="mt-1">
                  {sidebarBrands.map((row) => {
                    const logo = getBrandLogo(row.value);
                    return (
                      <SidebarRow
                        key={row.value}
                        label={row.value}
                        onClick={() => {
                          onChange(row.value);
                          setOpen(true);
                        }}
                        icon={
                          logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt="" className="h-7 w-7 object-contain" />
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500">
                              {row.value.slice(0, 2).toUpperCase()}
                            </span>
                          )
                        }
                      />
                    );
                  })}
                </div>
              </section>
              <div className="mt-auto p-3">
                <div className="rounded-xl bg-slate-100 p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <SearchIcon className="h-4 w-4" />
                    <p className="text-sm font-bold text-slate-900">{t("search.cantFindTitle")}</p>
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-600">{t("search.cantFindHint")}</p>
                  <Link
                    href="/vehicle-fitment"
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-[#7a1233] bg-white px-3 text-xs font-bold text-[#7a1233]"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <SearchIcon className="h-3.5 w-3.5" />
                    {t("search.advancedSearch")}
                  </Link>
                </div>
              </div>
            </aside>

            <div
              ref={listRef}
              className="min-h-0 overflow-y-auto"
              onScroll={(event) => {
                const el = event.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
                  void loadMore();
                }
              }}
            >
              {canSuggest && suggesting && suggestions.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-500">{t("search.searching")}</p>
              ) : null}
              {canSuggest && !suggesting && showProductRows && suggestions.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-500">{t("search.none", { query: value.trim() })}</p>
              ) : null}

              {panelTab === "brands"
                ? brands.map((row) => {
                    const logo = getBrandLogo(row.value);
                    return (
                      <button
                        key={row.value}
                        type="button"
                        className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange(row.value);
                          setOpen(true);
                        }}
                      >
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="h-8 w-12 object-contain" />
                        ) : null}
                        <span className="flex-1 font-semibold">{row.value}</span>
                        <span className="text-xs text-slate-500">{row.count}</span>
                      </button>
                    );
                  })
                : null}

              {panelTab === "categories"
                ? categories.map((row) => (
                    <button
                      key={row.value}
                      type="button"
                      className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onChange(row.value);
                        setOpen(true);
                      }}
                    >
                      <span className="font-semibold">{row.value}</span>
                      <span className="text-xs text-slate-500">{row.count}</span>
                    </button>
                  ))
                : null}

              {panelTab === "vehicles"
                ? (vehicles.length
                    ? vehicles.map((vehicle) => (
                        <Link
                          key={`${vehicle.make}-${vehicle.model}`}
                          href={`/vehicle-fitment/${slugifyFitment(vehicle.make)}`}
                          className="flex items-center justify-between border-b border-slate-100 px-5 py-3 hover:bg-slate-50"
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          <span className="font-semibold">
                            {vehicle.make} {vehicle.model}
                          </span>
                          <span className="text-xs text-slate-500">{vehicle.count}</span>
                        </Link>
                      ))
                    : (
                      <p className="px-5 py-8 text-sm text-slate-500">{t("search.none", { query: value.trim() })}</p>
                    ))
                : null}

              {panelTab === "articles" ? (
                <p className="px-5 py-8 text-sm text-slate-500">{t("search.none", { query: value.trim() })}</p>
              ) : null}

              {showProductRows
                ? suggestions.map((item, index) => {
                    const stock = stockText(item.listing, t);
                    const list = item.listing?.listInclusivePaise ?? item.listing?.pricePaise ?? 0;
                    const net = item.listing?.netInclusivePaise ?? list;
                    const priced = isAuthoritativeSellingPricePaise(list, net, item.listing?.pricePaise);
                    const canAdd =
                      Boolean(item.listing?.id) &&
                      item.listing?.status === "active" &&
                      (item.listing?.stock ?? 0) > 0 &&
                      priced;
                    return (
                      <div
                        key={`${item.id}-${index}`}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`flex min-w-0 flex-col gap-3 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3.5 ${
                          index === activeIndex ? "bg-slate-50" : "bg-white"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseProduct(item)}
                        >
                          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-[88px] sm:w-[88px]">
                            <Image
                              src={
                                item.thumbUrl ||
                                item.imageUrl ||
                                "/images/products/placeholder.svg"
                              }
                              alt=""
                              fill
                              sizes="88px"
                              className="object-contain p-1.5"
                              unoptimized
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-bold text-slate-950">
                              <SearchHighlight text={item.name} query={value} />
                            </span>
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {[item.brand, item.partNumber ? `${t("search.partNo")} ${item.partNumber}` : ""]
                                .filter(Boolean)
                                .join(" | ")}
                            </span>
                            {item.category ? (
                              <span className="mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                {item.category}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <div className="flex w-full min-w-0 shrink-0 flex-row items-center justify-between gap-2 sm:w-[8.25rem] sm:flex-col sm:items-end sm:justify-center sm:gap-1.5">
                          {stock ? (
                            <span
                              className={`text-[11px] font-bold ${
                                canAdd ? "text-emerald-700" : "text-slate-500"
                              }`}
                            >
                              {canAdd ? `✓ ${stock}` : stock}
                            </span>
                          ) : null}
                          <CompactPrice listing={item.listing} />
                          {onAddToCart ? (
                            <button
                              type="button"
                              disabled={!canAdd || addingId === item.listing?.id}
                              className="inline-flex min-h-9 items-center rounded-lg bg-[#7a1233] px-3 text-[11px] font-bold text-white disabled:opacity-50"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={(event) => void addListing(item, event)}
                            >
                              {canAdd ? t("product.addToCart") : t("price.onRequest")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                : null}

              {loadingMore ? (
                <p className="px-5 py-3 text-xs text-slate-500">{t("search.searching")}</p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {t("search.recentSearches")}
              </p>
              <div className="flex gap-2 overflow-x-auto">
                {recent.length ? (
                  recent.slice(0, 6).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onChange(item);
                        setOpen(true);
                      }}
                    >
                      {item}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
            </div>
            <div className="flex min-w-0 gap-2 overflow-x-auto">
              <Link
                href="/vehicle-fitment"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                onMouseDown={(event) => event.preventDefault()}
              >
                {t("search.byVehicle")} ›
              </Link>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => rootRef.current?.querySelector("input")?.focus()}
              >
                {t("search.byPartNumber")} ›
              </button>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => rootRef.current?.querySelector("input")?.focus()}
              >
                {t("search.scanSearch")} ›
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <form
        data-storefront-search
        className={`flex min-h-11 min-w-0 w-full items-stretch md:min-h-12 ${
          orderPage
            ? "gap-1 rounded-xl border border-[#7a1233] bg-white p-1.5 md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:p-0"
            : "overflow-hidden rounded-md border-y border-slate-300 bg-white"
        }`}
        onSubmit={(event) => {
          event.preventDefault();
          submitForm();
        }}
      >
        <div
          className={`flex h-full min-w-0 flex-1 items-center ${
            orderPage
              ? "rounded-lg border-0 px-1 md:rounded-lg md:border md:border-slate-300 md:px-1"
              : ""
          }`}
        >
          <span className="pl-3 text-slate-400" aria-hidden>
            <SearchIcon />
          </span>
          <input
            type="search"
            value={value}
            role="combobox"
            aria-label={
              orderPage
                ? isMobileViewport
                  ? "Search by item, part no., HSN"
                  : "Search by item name, part no., or HSN"
                : orderMode
                  ? "Search by item name, part no., or HSN"
                  : t("search.placeholderHeader")
            }
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-activedescendant={
              activeIndex >= 0 && suggestions[activeIndex]
                ? `${listId}-option-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            autoComplete="off"
            onChange={(event) => {
              setHasUserEdited(true);
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              suppressOpenRef.current = false;
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                submitForm();
                return;
              }
              if (!open || !suggestions.length) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % suggestions.length);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) =>
                  index <= 0 ? suggestions.length - 1 : index - 1,
                );
              }
            }}
            placeholder={
              orderPage
                ? isMobileViewport
                  ? "Search by item, part no., HSN..."
                  : "Search by item name, part no., or HSN..."
                : orderMode
                  ? "Search by item name, part no., or HSN..."
                  : t("search.placeholderHeader")
            }
            className="h-full min-w-0 flex-1 bg-white px-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {value ? (
            <button
              type="button"
              aria-label={t("common.close")}
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              onClick={() => {
                setHasUserEdited(true);
                onChange("");
                setSuggestions([]);
                setOpen(false);
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        {orderMode ? (
          <div className="hidden min-h-full shrink-0 items-center gap-2 px-2 md:flex">
            <label className="flex h-full items-center gap-1 whitespace-nowrap text-xs font-semibold text-slate-600">
              <span>Category:</span>
              <select
                value={activeCategory}
                onChange={(event) => onCategoryChange?.(event.target.value)}
                className={`h-9 max-w-40 rounded-md px-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#7a1233]/20 ${
                  orderPage ? "border border-slate-300 bg-white" : "bg-slate-50"
                }`}
                aria-label="Category"
              >
                <option value="">All Categories</option>
                {orderCategories.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.value}
                  </option>
                ))}
                {activeCategory && !orderCategories.some((row) => row.value === activeCategory) ? (
                  <option value={activeCategory}>{activeCategory}</option>
                ) : null}
              </select>
            </label>
            <label className="flex h-full items-center gap-1 whitespace-nowrap text-xs font-semibold text-slate-600">
              <span>Stock:</span>
              <select
                value={stockFilter}
                onChange={(event) =>
                  onStockFilterChange?.(event.target.value === "in_stock" ? "in_stock" : "all")
                }
                className={`h-9 rounded-md px-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#7a1233]/20 ${
                  orderPage ? "border border-slate-300 bg-white" : "bg-slate-50"
                }`}
                aria-label="Stock"
              >
                <option value="all">All Stock</option>
                <option value="in_stock">In Stock</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => onClearFilters?.()}
              className={`h-9 whitespace-nowrap rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#7a1233] ${
                orderPage ? "border border-[#7a1233]" : ""
              }`}
            >
              Clear Filters
            </button>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={searchLoading}
          aria-label={orderMode ? "Search catalogue" : t("nav.search")}
          className={`${
            orderPage
              ? "hidden"
              : "inline-flex min-h-11 shrink-0 items-center gap-1.5 bg-[#7a1233] px-2.5 text-sm font-bold text-white hover:bg-[#611029] disabled:opacity-60 sm:px-3"
          }`}
        >
          <SearchIcon />
          <span className="hidden lg:inline">{suggesting ? t("nav.searching") : t("nav.search")}</span>
        </button>
        {orderMode && mobileCartHref ? (
          <Link
            href={mobileCartHref}
            aria-label={t("nav.cart")}
            className={`relative inline-flex min-h-11 shrink-0 items-center justify-center px-2.5 text-slate-700 hover:bg-slate-50 md:hidden ${
              orderPage ? "rounded-lg" : ""
            }`}
          >
            <CartIcon />
            {mobileCartCount > 0 ? (
              <span className="absolute right-0.5 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c81e1e] px-1 text-[9px] font-bold leading-none text-white">
                {mobileCartCount > 99 ? "99+" : mobileCartCount}
              </span>
            ) : null}
          </Link>
        ) : null}
      </form>
      {panelHost && typeof document !== "undefined" ? createPortal(panel, panelHost) : panel}
    </div>
  );
}
