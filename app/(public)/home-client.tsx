"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { HomeHero } from "@/components/home-hero";
import { PublicBrandsSection } from "@/components/public-brand-grid";
import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { SearchExperience, type SearchTab } from "@/components/search-experience";
import { useI18n } from "@/components/preferences-provider";
import { rememberSearch } from "@/lib/recent-searches";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

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

function storefrontSearchHref(
  searchQuery: string,
  nextPage = 1,
  extras: { brand?: string; categoryName?: string; tab?: string } = {},
) {
  const trimmed = searchQuery.trim();
  if (!trimmed) return "/";
  const params = new URLSearchParams({ q: trimmed });
  if (nextPage > 1) params.set("page", String(nextPage));
  if (extras.brand) params.set("brand", extras.brand);
  if (extras.categoryName) params.set("categoryName", extras.categoryName);
  if (extras.tab && extras.tab !== "all") params.set("tab", extras.tab);
  return `/?${params.toString()}`;
}

function parseSearchPage(value: string | null) {
  const parsed = Number(value || "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function parseSearchTab(value: string | null): SearchTab {
  if (value === "products" || value === "brands" || value === "categories" || value === "vehicles") {
    return value;
  }
  return "all";
}

function searchPartsUrl(
  query: string,
  page: number,
  extras: { brand?: string; categoryName?: string } = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    perPage: "24",
  });
  if (extras.brand) params.set("brand", extras.brand);
  if (extras.categoryName) params.set("categoryName", extras.categoryName);
  return `/api/search/parts?${params.toString()}`;
}

async function fetchSearchPayload(
  query: string,
  page: number,
  extras: { brand?: string; categoryName?: string } = {},
) {
  const request =
    typeof window !== "undefined" ? window.fetch.bind(window) : fetch;
  const response = await request(searchPartsUrl(query, page, extras), {
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
    facets?: {
      brands?: Array<{ value: string; count: number }>;
      categories?: Array<{ value: string; count: number }>;
    };
    vehicles?: Array<{ make: string; model: string; count: number }>;
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
  const urlBrand = (searchParams.get("brand") ?? "").trim();
  const urlCategory = (searchParams.get("categoryName") ?? "").trim();
  const urlTab = parseSearchTab(searchParams.get("tab"));
  const [query, setQuery] = useState(urlQuery);
  const [searchedQuery, setSearchedQuery] = useState(urlQuery);
  const [page, setPage] = useState(urlPage);
  const [brandFilter, setBrandFilter] = useState(urlBrand);
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [tab, setTab] = useState<SearchTab>(urlTab);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [found, setFound] = useState(0);
  const [facetBrands, setFacetBrands] = useState<Array<{ value: string; count: number }>>([]);
  const [facetCategories, setFacetCategories] = useState<Array<{ value: string; count: number }>>([]);
  const [vehicleHits, setVehicleHits] = useState<Array<{ make: string; model: string; count: number }>>([]);
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
  const [detailTarget, setDetailTarget] = useState<{
    partId?: string;
    sku?: string;
  } | null>(null);

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

  function commitSearch(
    searchQuery: string,
    nextPage = 1,
    extras: { brand?: string; categoryName?: string; tab?: SearchTab } = {},
  ) {
    const nextBrand = extras.brand ?? brandFilter;
    const nextCategory = extras.categoryName ?? categoryFilter;
    const nextTab = extras.tab ?? tab;
    const href = storefrontSearchHref(searchQuery, nextPage, {
      brand: nextBrand,
      categoryName: nextCategory,
      tab: nextTab,
    });
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === href) {
      void performSearch(searchQuery.trim(), nextPage >= 1 ? nextPage : 1, {
        brand: nextBrand,
        categoryName: nextCategory,
      });
      return;
    }
    router.replace(href, { scroll: false });
  }

  async function performSearch(
    trimmedQuery: string,
    safePage: number,
    extras: { brand?: string; categoryName?: string } = {},
  ) {
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
      setFacetBrands([]);
      setFacetCategories([]);
      setVehicleHits([]);
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
      const data = await fetchSearchPayload(trimmedQuery, safePage, extras);
      if (gen !== searchGenRef.current) return;
      if (data.error && !Array.isArray(data.results)) {
        throw new Error(data.error);
      }

      setResults(Array.isArray(data.results) ? data.results : []);
      setFound(typeof data.found === "number" ? data.found : 0);
      setFacetBrands(Array.isArray(data.facets?.brands) ? data.facets.brands : []);
      setFacetCategories(Array.isArray(data.facets?.categories) ? data.facets.categories : []);
      setVehicleHits(Array.isArray(data.vehicles) ? data.vehicles : []);
      if (safePage === 1) rememberSearch(trimmedQuery);
      if (typeof data.perPage === "number" && data.perPage > 0) {
        setPerPage(data.perPage);
      }
    } catch (searchError) {
      if (gen !== searchGenRef.current) return;
      if (searchError instanceof DOMException && searchError.name === "AbortError") return;
      console.error(searchError);
      setResults([]);
      setFound(0);
      setFacetBrands([]);
      setFacetCategories([]);
      setVehicleHits([]);
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
    const nextBrand = (params.get("brand") ?? urlBrand).trim();
    const nextCategory = (params.get("categoryName") ?? urlCategory).trim();
    setBrandFilter(nextBrand);
    setCategoryFilter(nextCategory);
    setTab(parseSearchTab(params.get("tab") ?? urlTab));
    void performSearch(q, nextPage, { brand: nextBrand, categoryName: nextCategory });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout search from the real URL
  }, [urlQuery, urlPage, urlBrand, urlCategory, urlTab, initialQuery, initialPage]);

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <StorefrontHeader
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        query={query}
        onQueryChange={setQuery}
        onSearch={(nextQuery) => commitSearch(nextQuery ?? query, 1)}
        searchLoading={loading}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <main className="flex flex-col">
        {!searchedQuery && !urlQuery ? (
          <>
            <HomeHero onQuickSearch={(q) => commitSearch(q, 1)} />
            <PublicBrandsSection onSelect={(q) => commitSearch(q, 1)} />

        {/* Categories Section */}
        <section id="categories" className="py-14 sm:py-18 bg-white border-b border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  {t("hero.productCategories")}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {t("hero.browseSystem")}
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                {t("hero.browseHint")}
              </p>
            </div>

            <div className="mt-8 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
              {categoryCards.map((cat) => {
                const isFilters = cat.slug === "filters";
                const isLubricants = cat.slug === "lubricants";
                return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="card-hover group flex min-w-[260px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-md sm:min-w-0 sm:gap-4 sm:p-5"
                >
                  <div
                    className={
                      isFilters
                        ? "relative flex h-[6rem] w-[6rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f6f8] ring-1 ring-slate-200/90 sm:h-[6.5rem] sm:w-[6.5rem] lg:h-[8.5rem] lg:w-[8.5rem]"
                        : isLubricants
                          ? "relative flex h-[6.75rem] w-[6.75rem] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f6f8] ring-1 ring-slate-200/90 sm:h-[7.5rem] sm:w-[7.5rem] lg:h-[8.75rem] lg:w-[8.75rem]"
                        : "relative h-[6.25rem] w-[6.25rem] shrink-0 overflow-hidden rounded-full bg-[#f4f6f8] ring-1 ring-slate-200/90 sm:h-[7.5rem] sm:w-[7.5rem] lg:h-[8.75rem] lg:w-[8.75rem]"
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
                          ? "mt-1 text-xs leading-relaxed text-pretty break-words text-slate-500"
                          : "mt-1 text-xs text-slate-500 leading-relaxed"
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
          </>
        ) : null}

        {(loading || error || message || results.length > 0 || searchedQuery.trim() || urlQuery) && (
          <SearchExperience
            query={searchedQuery || urlQuery}
            loading={loading}
            error={error}
            results={results}
            found={found}
            page={page}
            perPage={perPage}
            brands={facetBrands}
            categories={facetCategories}
            vehicles={vehicleHits}
            activeBrand={brandFilter}
            activeCategory={categoryFilter}
            tab={tab}
            addingId={addingId}
            onTabChange={(next) => commitSearch(searchedQuery || query, 1, { tab: next })}
            onBrand={(brand) => commitSearch(searchedQuery || query, 1, { brand, tab: "products" })}
            onCategory={(categoryName) =>
              commitSearch(searchedQuery || query, 1, { categoryName, tab: "products" })
            }
            onPage={(nextPage) => commitSearch(searchedQuery || query, nextPage)}
            onOpenProduct={(hit) =>
              setDetailTarget({
                partId: hit.document?.id,
                sku: hit.listings?.[0]?.sku || hit.document?.part_number,
              })
            }
            onAddToCart={(listingId, name) => void addToCart(listingId, name)}
            onSearch={(nextQuery) => commitSearch(nextQuery, 1)}
          />
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

      <ProductDetailModal
        open={Boolean(detailTarget)}
        partId={detailTarget?.partId}
        sku={detailTarget?.sku}
        onClose={() => setDetailTarget(null)}
        onAddedToCart={() => setCartCount((prev) => prev + 1)}
        onWishlistChange={() => setWishlistCount((prev) => prev + 1)}
      />
    </div>
  );
}


