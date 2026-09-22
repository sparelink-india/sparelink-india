"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { HomeHero } from "@/components/home-hero";
import { PublicBrandsSection } from "@/components/public-brand-grid";
import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { useI18n } from "@/components/preferences-provider";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { QuickOrderPanel } from "@/components/quick-order-panel";
import { VehicleQuickSelector } from "@/components/vehicle-quick-selector";
import {
  HomeOffersTeaser,
  HomeTrustStrip,
  RecentlyViewedSection,
} from "@/components/home-mobile-extras";
import { CatalogueProductImage } from "@/components/catalogue-product-image";
import { pushRecentlyViewed } from "@/lib/recently-viewed";

type Listing = {
  id: string;
  dealerId: string;
  dealerName: string;
  firmId?: string | null;
  firmName?: string | null;
  firmCode?: string | null;
  sku: string | null;
  pricePaise: number;
  mrpPaise: number | null;
  status: string;
  stock: number | null;
  gstRate?: number | null;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  isPensol?: boolean;
  pensolUnit?: string | null;
  pensolCashDiscountPaisePerUnit?: number | null;
  pensolCreditDiscountPaisePerUnit?: number | null;
  pensolCashNetInclusivePaise?: number | null;
  pensolCreditNetInclusivePaise?: number | null;
  moq?: string | number | null;
  uom?: string | null;
  imageUrl?: string | null;
};

type SearchHit = {
  document?: {
    id?: string;
    part_number?: string;
    name?: string;
    description?: string;
    brand?: string;
    category?: string;
  };
  imageUrl?: string | null;
  listings?: Listing[];
  compatibleVehicles?: {
    vehicleId: string;
    make: string;
    model: string;
    variant: string | null;
  }[];
};

function storefrontSearchHref(searchQuery: string, nextPage = 1) {
  const trimmed = searchQuery.trim();
  if (!trimmed) return "/";
  return nextPage > 1
    ? `/?q=${encodeURIComponent(trimmed)}&page=${nextPage}`
    : `/?q=${encodeURIComponent(trimmed)}`;
}

function parseSearchPage(value: string | null) {
  const parsed = Number(value || "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function searchPartsUrl(query: string, page: number) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    perPage: "24",
  });
  return `/api/search/parts?${params.toString()}`;
}

async function fetchSearchPayload(query: string, page: number) {
  const request =
    typeof window !== "undefined" ? window.fetch.bind(window) : fetch;
  const response = await request(searchPartsUrl(query, page), {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const responseText = await response.text();
  let data: {
    results?: SearchHit[];
    found?: number;
    perPage?: number;
    error?: string;
  } = {};
  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText) as typeof data;
    } catch {
      throw new Error(`Search API returned invalid JSON (${response.status})`);
    }
  }
  if (!response.ok) {
    throw new Error(data.error || "Search failed");
  }
  return data;
}

export function HomePageContent({
  initialQuery = "",
  initialPage = 1,
}: {
  initialQuery?: string;
  initialPage?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = (searchParams.get("q") ?? initialQuery).trim();
  const urlPage = parseSearchPage(searchParams.get("page") ?? String(initialPage));
  const focusSearch = searchParams.get("focus") === "search";
  const [query, setQuery] = useState(urlQuery);
  const [searchedQuery, setSearchedQuery] = useState(urlQuery);
  const [page, setPage] = useState(urlPage);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [found, setFound] = useState(0);
  const [perPage, setPerPage] = useState(24);
  const [loading, setLoading] = useState(() => Boolean(urlQuery));
  const [addingId, setAddingId] = useState("");
  const [addedId, setAddedId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cartCount, setCartCount] = useState<number>(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchGenRef = useRef(0);
  const [selectedPart, setSelectedPart] = useState<{ id?: string; partNumber?: string } | null>(
    null,
  );

  // Prevent background scroll when lightbox is open & listen for ESC key
  // Fetch initial cart count
  useEffect(() => {
    void fetch("/api/cart")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.itemCount === "number") {
          setCartCount(data.itemCount);
        } else if (data && Array.isArray(data.items)) {
          const count = data.items.reduce(
            (acc: number, item: { quantity: number }) => acc + item.quantity,
            0,
          );
          setCartCount(count);
        }
      })
      .catch(() => setCartCount(0));

    void fetch("/api/wishlist")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) setWishlistCount(data.items.length);
      })
      .catch(() => setWishlistCount(0));
  }, []);

  useEffect(() => {
    if (!focusSearch) return;
    const timer = window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        "[data-storefront-search] input",
      );
      input?.focus();
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusSearch]);

  const categoryCards = [
    {
      name: t("cat.body"),
      slug: "body-parts",
      desc: t("cat.bodyDesc"),
      image: "/images/category/body-parts.png",
    },
    {
      name: t("cat.filters"),
      slug: "filters",
      desc: t("cat.filtersDesc"),
      image: "/images/category/filters.png",
    },
    {
      name: t("cat.brakes"),
      slug: "braking-system",
      desc: t("cat.brakesDesc"),
      image: "/images/category/braking-system.png",
    },
    {
      name: t("cat.engine"),
      slug: "engine-parts",
      desc: t("cat.engineDesc"),
      image: "/images/category/engine-parts.png",
    },
    {
      name: t("cat.suspension"),
      slug: "suspension-steering",
      desc: t("cat.suspensionDesc"),
      image: "/images/category/suspension-steering.png",
    },
    {
      name: t("cat.clutch"),
      slug: "clutch-transmission",
      desc: t("cat.clutchDesc"),
      image: "/images/category/clutch-transmission.png",
    },
    {
      name: t("cat.electricals"),
      slug: "electricals",
      desc: t("cat.electricalsDesc"),
      image: "/images/category/electricals.png",
    },
    {
      name: t("cat.lubricants"),
      slug: "lubricants",
      desc: t("cat.lubricantsDesc"),
      image: "/images/category/lubricants.png",
    },
  ];

  function commitSearch(searchQuery: string, nextPage = 1) {
    const trimmed = searchQuery.trim();
    const href = storefrontSearchHref(trimmed, nextPage);
    if (trimmed) {
      setQuery(trimmed);
      setSearchedQuery(trimmed);
    }
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === href) {
      void performSearch(trimmed, nextPage >= 1 ? nextPage : 1);
      return;
    }
    router.replace(href, { scroll: false });
  }

  async function performSearch(trimmedQuery: string, safePage: number) {
    const gen = ++searchGenRef.current;

    if (!trimmedQuery) {
      const stillInUrl =
        typeof window !== "undefined"
          ? (new URLSearchParams(window.location.search).get("q") ?? "").trim()
          : "";
      if (stillInUrl) {
        void performSearch(stillInUrl, safePage);
        return;
      }
      setResults([]);
      setFound(0);
      setPage(1);
      setSearchedQuery("");
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setPage(safePage);
    setQuery(trimmedQuery);
    setSearchedQuery(trimmedQuery);

    try {
      const data = await fetchSearchPayload(trimmedQuery, safePage);
      if (gen !== searchGenRef.current) return;
      if (data.error && !Array.isArray(data.results)) {
        throw new Error(data.error);
      }

      setResults(Array.isArray(data.results) ? data.results : []);
      setFound(typeof data.found === "number" ? data.found : 0);
      if (typeof data.perPage === "number" && data.perPage > 0) {
        setPerPage(data.perPage);
      }
    } catch (searchError) {
      if (gen !== searchGenRef.current) return;
      if (searchError instanceof DOMException && searchError.name === "AbortError") return;
      console.error(searchError);
      setResults([]);
      setFound(0);
      setError(t("search.failed"));
    } finally {
      if (gen === searchGenRef.current) {
        setLoading(false);
      }
    }
  }

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get("q") ?? urlQuery ?? initialQuery).trim();
    const nextPage = parseSearchPage(
      params.get("page") ?? String(urlPage || initialPage),
    );
    void performSearch(q, nextPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout search from the real URL
  }, [urlQuery, urlPage, initialQuery, initialPage]);

  async function addToCart(listingId: string, partName: string) {
    setAddingId(listingId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealerListingId: listingId,
          quantity: 1,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || t("product.addFail"));
      }

      setAddedId(listingId);
      setTimeout(() => setAddedId(""), 2500);

      // Increment cart badge
      setCartCount((prev) => prev + 1);
      setMessage(t("product.added", { name: partName }));
    } catch (cartError) {
      console.error(cartError);
      setError(t("product.addFail"));
    } finally {
      setAddingId("");
    }
  }

  return (
    <div className="storefront-mobile-pad min-h-screen bg-slate-50 text-slate-900">
      <StorefrontHeader
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        query={query}
        onQueryChange={setQuery}
        onSearch={(nextQuery) => commitSearch(nextQuery ?? query, 1)}
        onSelectProduct={(item) =>
          setSelectedPart({ id: item.id, partNumber: item.partNumber })
        }
        searchLoading={loading}
        committedQuery={searchedQuery}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className="flex flex-col">
        {/* Mobile discovery stack */}
        {!searchedQuery && !urlQuery ? (
          <div className="space-y-3 px-3 pt-3 md:hidden">
            <VehicleQuickSelector />
            <QuickOrderPanel onCartChange={(delta) => setCartCount((prev) => prev + delta)} />
          </div>
        ) : null}

        <div className="hidden md:block">
          <HomeHero onQuickSearch={(q) => commitSearch(q, 1)} />
        </div>

        {!searchedQuery && !urlQuery ? (
          <div className="md:hidden">
            <HomeOffersTeaser />
          </div>
        ) : null}

        <div className={searchedQuery || urlQuery ? "hidden md:block" : undefined}>
          <PublicBrandsSection onSelect={(q) => commitSearch(q, 1)} />
        </div>

        {/* Categories Section */}
        <section id="categories" className="py-8 sm:py-14 bg-white border-b border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  {t("hero.productCategories")}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {t("home.shopByCategory")}
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-md hidden sm:block">
                {t("hero.browseHint")}
              </p>
            </div>

            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
              {categoryCards.map((cat) => {
                const isFilters = cat.slug === "filters";
                const isLubricants = cat.slug === "lubricants";
                return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="card-hover group flex min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-md sm:min-w-0 sm:gap-4 sm:p-5"
                >
                  <div
                    className={
                      isFilters
                        ? "relative flex h-[5rem] w-[5rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f6f8] ring-1 ring-slate-200/90 sm:h-[6.5rem] sm:w-[6.5rem] lg:h-[8.5rem] lg:w-[8.5rem]"
                        : isLubricants
                          ? "relative flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f6f8] ring-1 ring-slate-200/90 sm:h-[7.5rem] sm:w-[7.5rem] lg:h-[8.75rem] lg:w-[8.75rem]"
                        : "relative h-[5rem] w-[5rem] shrink-0 overflow-hidden rounded-full bg-[#f4f6f8] ring-1 ring-slate-200/90 sm:h-[7.5rem] sm:w-[7.5rem] lg:h-[8.75rem] lg:w-[8.75rem]"
                    }
                  >
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      width={280}
                      height={280}
                      className={
                        isFilters
                          ? "h-full w-full object-contain object-center p-[0.875rem] sm:p-4 lg:p-5"
                          : isLubricants
                            ? "h-full w-full object-contain object-center p-3 sm:p-3.5 lg:p-4"
                          : "h-full w-full object-contain p-1.5 sm:p-2"
                      }
                      sizes={
                        isFilters
                          ? "(min-width: 1024px) 136px, (min-width: 640px) 104px, 96px"
                          : isLubricants
                            ? "(min-width: 1024px) 140px, (min-width: 640px) 120px, 108px"
                          : "(min-width: 1024px) 140px, (min-width: 640px) 120px, 100px"
                      }
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 group-hover:text-slate-950">
                      {cat.name}
                    </h3>
                    <p
                      className={
                        isFilters
                          ? "mt-1 text-xs leading-relaxed text-pretty break-words text-slate-500 line-clamp-2"
                          : "mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2"
                      }
                    >
                      {cat.desc}
                    </p>
                    <span
                      className={
                        isFilters
                          ? "mt-2.5 inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-700 group-hover:underline"
                          : "mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:underline"
                      }
                    >
                      <span>{t("hero.explore")}</span>
                      <span>→</span>
                    </span>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        </section>

        {!searchedQuery && !urlQuery ? (
          <section className="border-b border-slate-200 bg-slate-50 px-3 py-5 md:hidden" aria-labelledby="shop-vehicle-heading">
            <h2 id="shop-vehicle-heading" className="text-lg font-bold text-slate-950">
              {t("home.shopByVehicle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t("vehicleSelect.title")}</p>
            <Link
              href="/vehicle-fitment"
              className="btn-press mt-3 flex min-h-12 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white"
            >
              {t("hero.findVehicle")}
            </Link>
          </section>
        ) : null}

        {!searchedQuery && !urlQuery ? (
          <div className="md:hidden">
            <RecentlyViewedSection
              onOpen={(item) => setSelectedPart({ id: item.id, partNumber: item.partNumber })}
            />
            <HomeTrustStrip />
          </div>
        ) : null}

        {/* Search Results Section */}
        {(loading || error || message || results.length > 0 || searchedQuery.trim() || urlQuery) && (
          <section id="search-results" className="order-first py-10 sm:py-14 bg-slate-50/80">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {t("search.catalogQuery")}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    {loading
                      ? t("search.searching")
                      : found > 0
                        ? found === 1
                          ? t("search.foundOne", { query: searchedQuery })
                          : t("search.found", { count: found, query: searchedQuery })
                        : t("search.none", { query: searchedQuery })}
                  </h2>
                </div>

                {found > 0 && (
                  <span className="rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                    {t("search.showing", {
                      from: (page - 1) * perPage + 1,
                      to: Math.min(page * perPage, found),
                      total: found,
                    })}
                  </span>
                )}
              </div>

              {/* Feedback messages */}
              {error && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  role="status"
                  className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
                >
                  <span>{message}</span>
                  <Link
                    href="/cart"
                    className="ml-4 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    {t("cart.view")}
                  </Link>
                </div>
              )}

              {/* Loading Skeletons */}
              {loading && (
                <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
                    >
                      <div className="aspect-[16/9] w-full rounded-xl bg-slate-200" />
                      <div className="mt-4 h-5 w-2/3 rounded bg-slate-200" />
                      <div className="mt-2 h-4 w-1/3 rounded bg-slate-200" />
                      <div className="mt-6 h-10 w-full rounded-xl bg-slate-200" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty Search Results */}
              {!loading && !error && results.length === 0 && (
                <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <svg
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {t("search.noneTitle")}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                    {t("search.noneHint")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("113");
                      commitSearch("113", 1);
                    }}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#7a1233] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#611029]"
                  >
                    {t("search.try113")}
                  </button>
                </div>
              )}

              {/* Product Cards Grid */}
              {!loading && !error && results.length > 0 && (
                <div className="mt-6 grid items-start gap-3 sm:mt-8 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {results.map((hit, index) => {
                    const partData = hit.document ?? {};
                    const listings = hit.listings ?? [];
                    const partNo = partData.part_number;
                    const description = partData.description?.trim();
                    const imageSrc =
                      hit.imageUrl ||
                      listings.find((listing) => listing.imageUrl)?.imageUrl ||
                      (partNo
                        ? `/images/products/${encodeURIComponent(partNo)}.svg`
                        : "/images/products/placeholder.svg");
                    const primaryListing = listings[0];
                    const application =
                      hit.compatibleVehicles && hit.compatibleVehicles.length > 0
                        ? hit.compatibleVehicles
                            .slice(0, 2)
                            .map((v) => `${v.make} ${v.model}`)
                            .join(" / ")
                        : null;

                    return (
                      <article
                        key={partData.id ?? index}
                        className="card-hover group flex h-auto flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs sm:flex-col"
                      >
                        {/* Mobile compact row */}
                        <div className="flex gap-0 sm:hidden">
                          <button
                            type="button"
                            className="h-28 w-28 shrink-0 bg-slate-50 p-2"
                            onClick={() => {
                              if (partData.id && partNo) {
                                pushRecentlyViewed({
                                  id: partData.id,
                                  partNumber: partNo,
                                  name: partData.name || t("product.partFallback"),
                                  brand: partData.brand,
                                  imageUrl: imageSrc,
                                });
                              }
                              setSelectedPart({
                                id: partData.id,
                                partNumber: partNo,
                              });
                            }}
                            aria-label={t("photo.enlargeAria", { name: partData.name || t("product.partFallback") })}
                          >
                            <CatalogueProductImage
                              src={imageSrc}
                              alt={partData.name || t("product.partFallback")}
                              size="thumb"
                              className="h-full w-full"
                            />
                          </button>
                          <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                            {partData.brand ? (
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                {partData.brand}
                              </p>
                            ) : null}
                            {partNo ? (
                              <p className="font-mono text-xs font-semibold text-slate-800">{partNo}</p>
                            ) : null}
                            <h3 className="line-clamp-2 text-sm font-bold text-slate-950">
                              {partData.name || t("product.partFallback")}
                            </h3>
                            {application ? (
                              <p className="line-clamp-1 text-xs text-slate-500">{application}</p>
                            ) : null}
                            {primaryListing ? (
                              <>
                                <InclusivePrice
                                  pricePaise={primaryListing.pricePaise}
                                  listInclusivePaise={primaryListing.listInclusivePaise}
                                  netInclusivePaise={primaryListing.netInclusivePaise}
                                  discountPercent={primaryListing.discountPercent}
                                  gstRate={primaryListing.gstRate}
                                  align="left"
                                />
                                <button
                                  type="button"
                                  disabled={
                                    primaryListing.status !== "active" ||
                                    (primaryListing.stock ?? 0) <= 0 ||
                                    addingId === primaryListing.id
                                  }
                                  onClick={() =>
                                    void addToCart(
                                      primaryListing.id,
                                      partData.name || t("product.partFallback"),
                                    )
                                  }
                                  className="btn-press mt-1 min-h-11 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
                                >
                                  {addingId === primaryListing.id
                                    ? "..."
                                    : addedId === primaryListing.id
                                      ? "✓"
                                      : t("product.addToCart")}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPart({ id: partData.id, partNumber: partNo })
                                }
                                className="btn-press mt-1 min-h-11 rounded-xl border border-slate-200 text-xs font-bold"
                              >
                                {t("offers.details")}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Desktop / tablet card */}
                        <div className="hidden sm:contents">
                        {/* Product Image Area with Lightbox Trigger */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (partData.id && partNo) {
                              pushRecentlyViewed({
                                id: partData.id,
                                partNumber: partNo,
                                name: partData.name || t("product.partFallback"),
                                brand: partData.brand,
                                imageUrl: imageSrc,
                              });
                            }
                            setSelectedPart({
                              id: partData.id,
                              partNumber: partNo,
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedPart({
                                id: partData.id,
                                partNumber: partNo,
                              });
                            }
                          }}
                          aria-label={t("photo.enlargeAria", { name: partData.name || t("product.partFallback") })}
                          className="relative flex w-full cursor-zoom-in items-center justify-center overflow-hidden border-b border-slate-100 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                        >
                          <CatalogueProductImage
                            src={imageSrc}
                            alt={partData.name || t("product.partFallback")}
                            size="medium"
                            className="mx-auto block max-h-[22rem] w-full p-4"
                            imgClassName="mx-auto block h-auto max-h-[20rem] w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          />

                          {/* Hover Zoom Overlay Hint */}
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-xs">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                              </svg>
                              {t("photo.viewLarge")}
                            </span>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="flex flex-col gap-3 p-4">
                          <div>
                            <h3 className="line-clamp-3 text-base font-bold leading-snug text-slate-950 sm:text-lg">
                              {partData.name || t("product.partFallback")}
                            </h3>
                            {partData.brand ? (
                              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                {partData.brand}
                              </p>
                            ) : null}
                            {partNo ? (
                              <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                                {t("product.partHash", { number: partNo })}
                              </p>
                            ) : null}
                            {partData.category ? (
                              <span className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {partData.category}
                              </span>
                            ) : null}
                            {description ? (
                              <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-2">
                                {description}
                              </p>
                            ) : null}
                          </div>

                          {/* Compatible Vehicles */}
                          {hit.compatibleVehicles && hit.compatibleVehicles.length > 0 && (
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                              <span className="font-semibold text-slate-700">
                                Verified Fits:{" "}
                              </span>
                              <span className="text-slate-600">
                                {hit.compatibleVehicles
                                  .slice(0, 3)
                                  .map((v) => `${v.make} ${v.model}`)
                                  .join(", ")}
                                {hit.compatibleVehicles.length > 3
                                  ? ` +${hit.compatibleVehicles.length - 3} more`
                                  : ""}
                              </span>
                            </div>
                          )}

                          {/* Dealer Listings & Pricing */}
                          {listings.length > 0 ? (
                            <div className="space-y-3 border-t border-slate-100 pt-3">
                              {listings.map((listing) => {
                                const stock = listing.stock ?? 0;
                                const isPriced = isAuthoritativeSellingPricePaise(
                                  listing.listInclusivePaise,
                                  listing.netInclusivePaise,
                                  listing.pricePaise,
                                  listing.pensolCashNetInclusivePaise,
                                  listing.pensolCreditNetInclusivePaise,
                                );
                                const isAvailable =
                                  listing.status === "active" && stock > 0 && isPriced;
                                const isAdding = addingId === listing.id;
                                const isJustAdded = addedId === listing.id;

                                return (
                                  <div key={listing.id} className="flex flex-col gap-2">
                                    {listing.dealerName ? (
                                      <p className="text-xs font-bold text-slate-900">
                                        {listing.dealerName}
                                      </p>
                                    ) : null}

                                    {listing.firmName ? (
                                      <p className="text-[11px] font-semibold text-emerald-700">
                                        {t("product.fulfilledBy", { firm: listing.firmName })}
                                      </p>
                                    ) : null}

                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          isAvailable ? "bg-emerald-500" : "bg-rose-500"
                                        }`}
                                      />
                                      <span className="text-[11px] text-slate-500">
                                        {isAvailable
                                          ? t("product.inStock", { count: stock })
                                          : t("product.outOfStock")}
                                      </span>
                                    </div>

                                    <div>
                                      {listing.isPensol ? (
                                        <div className="space-y-0.5 text-[11px] text-slate-600">
                                          {listing.mrpPaise ? (
                                            <p>
                                              {t("price.mrp")}: ₹
                                              {(listing.mrpPaise / 100).toLocaleString("en-IN")}
                                            </p>
                                          ) : null}
                                          {listing.pricePaise > 0 ? (
                                            <p>
                                              {t("price.dlp")}: ₹
                                              {(listing.pricePaise / 100).toLocaleString("en-IN")}{" "}
                                              {t("price.inclGst")}
                                            </p>
                                          ) : (
                                            <p className="font-bold text-slate-800">{t("price.onRequest")}</p>
                                          )}
                                          {listing.pensolCashDiscountPaisePerUnit != null &&
                                          listing.pensolCashDiscountPaisePerUnit > 0 ? (
                                            <p>
                                              Cash: ₹
                                              {(listing.pensolCashDiscountPaisePerUnit / 100).toLocaleString("en-IN")}
                                              /{(listing.pensolUnit || "unit").toUpperCase()}
                                              {listing.pensolCashNetInclusivePaise != null
                                                ? ` → ₹${(listing.pensolCashNetInclusivePaise / 100).toLocaleString("en-IN")}`
                                                : ""}
                                            </p>
                                          ) : null}
                                          {listing.pensolCreditDiscountPaisePerUnit != null &&
                                          listing.pensolCreditDiscountPaisePerUnit > 0 ? (
                                            <p>
                                              Credit: ₹
                                              {(listing.pensolCreditDiscountPaisePerUnit / 100).toLocaleString("en-IN")}
                                              /{(listing.pensolUnit || "unit").toUpperCase()}
                                              {listing.pensolCreditNetInclusivePaise != null
                                                ? ` → ₹${(listing.pensolCreditNetInclusivePaise / 100).toLocaleString("en-IN")}`
                                                : ""}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <InclusivePrice
                                          pricePaise={listing.pricePaise}
                                          listInclusivePaise={listing.listInclusivePaise}
                                          netInclusivePaise={listing.netInclusivePaise}
                                          discountPercent={listing.discountPercent}
                                          gstRate={listing.gstRate}
                                          align="left"
                                        />
                                      )}
                                      {listing.mrpPaise &&
                                      !listing.isPensol &&
                                      listing.mrpPaise > listing.pricePaise ? (
                                        <p className="text-[11px] text-slate-400 line-through">
                                          ₹
                                          {(listing.mrpPaise / 100).toLocaleString("en-IN")}
                                        </p>
                                      ) : null}
                                      {listing.uom || listing.moq ? (
                                        <p className="text-[11px] text-slate-500">
                                          {listing.uom ? String(listing.uom) : null}
                                          {listing.uom && listing.moq ? " · " : null}
                                          {listing.moq ? `MOQ ${listing.moq}` : null}
                                        </p>
                                      ) : null}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={
                                        !isAvailable || isAdding || isJustAdded
                                      }
                                      onClick={() =>
                                        void addToCart(
                                          listing.id,
                                          partData.name || t("product.partFallback"),
                                        )
                                      }
                                      aria-label={t("product.addAria", { name: partData.name || t("product.partFallback") })}
                                      className={`btn-press mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                                        isJustAdded
                                          ? "bg-emerald-600 text-white"
                                          : isAvailable
                                            ? "bg-slate-950 text-white shadow-xs hover:bg-slate-800"
                                            : "cursor-not-allowed bg-slate-200 text-slate-400"
                                      }`}
                                    >
                                      {isAdding ? (
                                        <span>Adding...</span>
                                      ) : isJustAdded ? (
                                        <>
                                          <svg
                                            className="h-4 w-4"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                          <span>Added to Cart!</span>
                                        </>
                                      ) : isAvailable ? (
                                        <>
                                          <svg
                                            className="h-3.5 w-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M12 4v16m8-8H4"
                                            />
                                          </svg>
                                          <span>{t("product.addToCart")}</span>
                                        </>
                                      ) : (
                                        <span>
                                          {isPriced ? t("product.outOfStock") : t("price.onRequest")}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-slate-500">
                              {t("product.noListing")}
                            </p>
                          )}
                        </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {!loading && found > perPage && (
                <nav
                  className="mt-8 flex flex-wrap items-center justify-center gap-2"
                  aria-label={t("search.page", {
                    page,
                    pages: Math.max(1, Math.ceil(found / perPage)),
                  })}
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => commitSearch(query, page - 1)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-40"
                  >
                    {t("search.prev")}
                  </button>
                  {Array.from(
                    { length: Math.min(7, Math.ceil(found / perPage)) },
                    (_, index) => {
                      const totalPages = Math.ceil(found / perPage);
                      let pageNumber = index + 1;
                      if (totalPages > 7) {
                        const start = Math.min(
                          Math.max(1, page - 3),
                          totalPages - 6,
                        );
                        pageNumber = start + index;
                      }
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          aria-current={pageNumber === page ? "page" : undefined}
                          onClick={() => commitSearch(query, pageNumber)}
                          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold ${
                            pageNumber === page
                              ? "border-[#7a1233] bg-[#7a1233] text-white"
                              : "border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    },
                  )}
                  <button
                    type="button"
                    disabled={page >= Math.ceil(found / perPage)}
                    onClick={() => commitSearch(query, page + 1)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-40"
                  >
                    {t("search.next")}
                  </button>
                </nav>
              )}
            </div>
          </section>
        )}

        <section id="how-it-works" className="py-16 sm:py-20 bg-white border-t border-slate-200/80">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                {t("fulfill.kicker")}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {t("fulfill.title")}
              </h2>
            </div>
            <div className="mt-8 space-y-4 text-sm leading-7 text-slate-700">
              <p>{t("fulfill.p1")}</p>
              <p>{t("fulfill.p2")}</p>
              <h3 className="pt-4 text-lg font-bold text-slate-950">{t("fulfill.stockTitle")}</h3>
              <p>{t("fulfill.stockP1")}</p>
              <p>{t("fulfill.stockP2")}</p>
              <h3 className="pt-4 text-lg font-bold text-slate-950">{t("fulfill.processTitle")}</h3>
              <p>{t("fulfill.processP")}</p>
              <h3 className="pt-4 text-lg font-bold text-slate-950">{t("fulfill.approachTitle")}</h3>
              <p>{t("fulfill.approachP1")}</p>
              <p>{t("fulfill.goalLabel")}</p>
              <p className="font-bold text-slate-950">{t("fulfill.goal")}</p>
              <p>{t("fulfill.close")}</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <Suspense fallback={null}>
        <MobileBottomNav cartCount={cartCount} />
      </Suspense>

      {selectedPart ? (
        <ProductDetailModal
          partId={selectedPart.id}
          partNumber={selectedPart.partNumber}
          onClose={() => setSelectedPart(null)}
          onCartChange={(delta) => setCartCount((prev) => prev + delta)}
          onWishlistChange={(delta) => setWishlistCount((prev) => prev + delta)}
        />
      ) : null}
    </div>
  );
}


