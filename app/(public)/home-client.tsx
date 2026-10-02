"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { HomeHero, type HeroSlotAvailability } from "@/components/home-hero";
import { HeroSearchPanel } from "@/components/hero-search-panel";
import { PublicBrandsSection } from "@/components/public-brand-grid";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { SearchExperience, type SearchTab } from "@/components/search-experience";
import { useI18n } from "@/components/preferences-provider";
import { STOREFRONT_CATEGORIES } from "@/lib/storefront-categories";
import { rememberSearch } from "@/lib/recent-searches";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";

import { VehicleQuickSelector } from "@/components/vehicle-quick-selector";
import { PromotionalBannerSlider } from "@/components/promotional-banner-slider";
import type { PublicBanner } from "@/lib/promotional-banners";
import {
  HomeOffersTeaser,
  RecentlyViewedSection,
} from "@/components/home-mobile-extras";
import {
  HomeDealerCta,
  HomeOrderCta,
} from "@/components/home-discovery-sections";

/* Small tick used by the trust indicator list. Inline rather than imported so
   the V3 list does not depend on a V2 icon module. */
function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-[var(--v3-ok)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

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
  hsn?: string | null;
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
  extras: { brand?: string; categoryName?: string; stock?: StockFilter; tab?: string } = {},
) {
  const trimmed = searchQuery.trim();
  if (!trimmed) return "/";
  const params = new URLSearchParams({ q: trimmed });
  if (nextPage > 1) params.set("page", String(nextPage));
  if (extras.brand) params.set("brand", extras.brand);
  if (extras.categoryName) params.set("categoryName", extras.categoryName);
  if (extras.stock) params.set("stock", extras.stock);
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

type StockFilter = "all" | "in_stock";

export function HomePageContent({
  initialQuery = "",
  initialPage = 1,
  banners = [],
  heroSlots,
}: {
  initialQuery?: string;
  initialPage?: number;
  /** Enabled promotional banners, resolved on the server. */
  banners?: PublicBanner[];
  /**
   * Which hero vehicle classes have a curated set, resolved on the server.
   * Undefined means "none known", which sends every vehicle hotspot to the
   * fitment browser rather than to a page that would render nothing.
   */
  heroSlots?: HeroSlotAvailability;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = (searchParams.get("q") ?? initialQuery).trim();
  const urlPage = parseSearchPage(searchParams.get("page") ?? String(initialPage));
  const urlBrand = (searchParams.get("brand") ?? "").trim();
  const urlCategory = (searchParams.get("categoryName") ?? "").trim();
  const urlStock: StockFilter = searchParams.get("stock") === "all" ? "all" : "in_stock";
  const urlTab = parseSearchTab(searchParams.get("tab"));
  const [query, setQuery] = useState(urlQuery);
  const focusSearch = searchParams.get("focus") === "search";
  const [searchedQuery, setSearchedQuery] = useState(urlQuery);
  const [page, setPage] = useState(urlPage);
  const brandFilter = urlBrand;
  const categoryFilter = urlCategory;
  const tab = urlTab;
  const [results, setResults] = useState<SearchHit[]>([]);
  const [found, setFound] = useState(0);
  const [facetBrands, setFacetBrands] = useState<Array<{ value: string; count: number }>>([]);
  const [facetCategories, setFacetCategories] = useState<Array<{ value: string; count: number }>>([]);
  const [vehicleHits, setVehicleHits] = useState<Array<{ make: string; model: string; count: number }>>([]);
  const [perPage, setPerPage] = useState(24);
  const [loading, setLoading] = useState(() => Boolean(urlQuery));
  const [addingId, setAddingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cartCount, setCartCount] = useState<number>(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [estimatedTotalPaise, setEstimatedTotalPaise] = useState(0);
  const searchGenRef = useRef(0);
  const initialSearchKeyRef = useRef("");
  const pendingPageScrollRef = useRef(false);
  const refreshCartSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.itemCount === "number") {
        setCartCount(data.itemCount);
        setSelectedCount(data.itemCount);
      } else if (Array.isArray(data.items)) {
        const count = data.items.reduce(
          (sum: number, item: { quantity: number }) => sum + item.quantity,
          0,
        );
        setCartCount(count);
        setSelectedCount(count);
      }
      if (typeof data.totalPaise === "number" && Number.isFinite(data.totalPaise)) {
        setEstimatedTotalPaise(data.totalPaise);
      }
    } catch {
      // Cart summary is supplementary; the cart page remains the source of truth.
    }
  }, []);
  const [detailTarget, setDetailTarget] = useState<{
    partId?: string;
    sku?: string;
  } | null>(null);

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
  // Fetch initial cart and wishlist summaries.
  useEffect(() => {
    void fetch("/api/cart", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        if (typeof data.itemCount === "number") {
          setCartCount(data.itemCount);
          setSelectedCount(data.itemCount);
        } else if (Array.isArray(data.items)) {
          const count = data.items.reduce(
            (sum: number, item: { quantity: number }) => sum + item.quantity,
            0,
          );
          setCartCount(count);
          setSelectedCount(count);
        }
        if (typeof data.totalPaise === "number" && Number.isFinite(data.totalPaise)) {
          setEstimatedTotalPaise(data.totalPaise);
        }
      })
      .catch(() => undefined);

    void fetch("/api/wishlist")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) setWishlistCount(data.items.length);
      })
      .catch(() => setWishlistCount(0));
  }, []);

  /* THE CATEGORY TILES.
     Read from STOREFRONT_CATEGORIES rather than declared here. This block
     used to be a second, hand-maintained copy of the same eight categories
     with their own image paths - so a change to the registry did not reach
     the homepage, and the two could silently disagree. Reading the registry
     also means the homepage now renders `framedImage`, the tightly-framed
     derivative, because the registry is where that field lives. */
  const categoryCards = STOREFRONT_CATEGORIES.map((category) => ({
    name: t(category.nameKey),
    slug: category.slug,
    desc: t(category.descKey),
    image: category.framedImage,
  }));

  function commitSearch(
    searchQuery: string,
    nextPage = 1,
    extras: { brand?: string; categoryName?: string; stock?: StockFilter; tab?: SearchTab } = {},
  ) {
    const nextBrand = extras.brand ?? brandFilter;
    const nextCategory = extras.categoryName ?? categoryFilter;
    const nextStock = extras.stock ?? urlStock;
    const nextTab = extras.tab ?? tab;
    if (nextPage !== page) pendingPageScrollRef.current = true;
    const href = storefrontSearchHref(searchQuery, nextPage, {
      brand: nextBrand,
      categoryName: nextCategory,
      stock: nextStock,
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
    const requestKey = [q, nextPage, nextBrand, nextCategory, urlStock, urlTab].join("\u001f");
    if (initialSearchKeyRef.current === requestKey) return;
    initialSearchKeyRef.current = requestKey;
    void performSearch(q, nextPage, { brand: nextBrand, categoryName: nextCategory });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout search from the real URL
  }, [urlQuery, urlPage, urlBrand, urlCategory, urlStock, urlTab, initialQuery, initialPage]);

  useEffect(() => {
    if (!pendingPageScrollRef.current || loading) return;
    const target = document.getElementById("search-results");
    if (target) {
      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerHeight);
      window.scrollTo({ top, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    pendingPageScrollRef.current = false;
  }, [loading, page, results, searchedQuery]);

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

      // Increment cart badge and order summary selection.
      setCartCount((prev) => prev + 1);
      const selectedListing = results
        .flatMap((hit) => hit.listings ?? [])
        .find((listing) => listing.id === listingId);
      const unitPaise =
        selectedListing?.netInclusivePaise ??
        selectedListing?.listInclusivePaise ??
        selectedListing?.pricePaise ??
        0;
      setSelectedCount((count) => count + 1);
      setEstimatedTotalPaise((total) => total + unitPaise);
      void refreshCartSummary();
      setMessage(t("product.added", { name: partName }));
    } catch (cartError) {
      console.error(cartError);
      setError(t("product.addFail"));
    } finally {
      setAddingId("");
    }
  }

  const isOrderSearchState = Boolean(searchedQuery || urlQuery || loading || error || message);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--v3-page)] text-[var(--v3-text)]">
      <StorefrontHeader
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        query={query}
        onQueryChange={setQuery}
        onSearch={(nextQuery) => commitSearch(nextQuery ?? query, 1)}
        searchLoading={loading}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        onCartItemAdded={(_listingId, unitPaise) => {
          setCartCount((count) => count + 1);
          setSelectedCount((count) => count + 1);
          setEstimatedTotalPaise((total) => total + (unitPaise ?? 0));
          void refreshCartSummary();
        }}
      />

      <main id="main-content" className="flex flex-col">
        {!searchedQuery && !urlQuery ? (
          <>
            {/* ============ 1. HERO / GLOBAL SEARCH ============ */}
            <HomeHero
              availability={heroSlots}
              /* Hotspot names are resolved HERE because this component already has
                 `t()` and home-hero.tsx is deliberately a server component. The
                 list is explicit rather than derived, so a key added to
                 home-hero.tsx without a line here fails the type check instead of
                 silently rendering the English fallback. */
              labels={{
                "heroTarget.heavyCommercial": t("heroTarget.heavyCommercial"),
                "heroTarget.lightCommercial": t("heroTarget.lightCommercial"),
                "heroTarget.passenger": t("heroTarget.passenger"),
                "heroTarget.agriculture": t("heroTarget.agriculture"),
                "heroTarget.earthmover": t("heroTarget.earthmover"),
                "heroTarget.motorcycle": t("heroTarget.motorcycle"),
                "heroTarget.scooter": t("heroTarget.scooter"),
                "heroTarget.brakeParts": t("heroTarget.brakeParts"),
                "heroTarget.filters": t("heroTarget.filters"),
                "heroTarget.shockers": t("heroTarget.shockers"),
                "heroTarget.grease": t("heroTarget.grease"),
                "heroTarget.lubricants": t("heroTarget.lubricants"),
                "heroTarget.shopParts": t("heroTarget.shopParts"),
                "heroTarget.dealerBulk": t("heroTarget.dealerBulk"),
              }}
            />

            {/* ============ 1b. SEARCH-FIRST BAND ============
                Mounted HERE rather than inside components/home-hero.tsx.

                That file is a PROTECTED file: the hero bitmap is a single
                approved composite whose baked-in left column, headline and both
                CTA buttons mean the visible headline cannot be re-drawn, and
                whose nine vehicle hotspot coordinates were derived by template
                matching the artwork. lib/dark-mode-tier2.test.ts pins that file
                byte-for-byte against colour edits, and deliberately so - fixing a
                colour inside it is the wrong trade when a global rule can do it.

                Adding a sibling band is not a colour edit and does not touch the
                artwork or a hotspot, but mounting it from here keeps the
                protected file untouched altogether, which is cheaper to justify
                than an argument about which kind of edit is acceptable.

                It sits between the hero and the vehicle finder so the page reads
                artwork -> search -> browse on every viewport. */}
            <HeroSearchPanel />

            {/* ============ 2. QUICK VEHICLE FINDER ============
                Sits directly under the hero, per the V3 brief: the highest-value
                entry point for someone who already knows their vehicle. In V2
                this band was desktop-only-placed-above-the-hero and read as an
                afterthought; here it is the first thing after the headline. */}
            <section
              id="vehicle-type"
              className="v3-band border-b border-[var(--v3-rule)] bg-white"
              aria-labelledby="vehicle-type-heading"
            >
              <div className="v3-container">
                <div className="v3-head">
                  <h2 id="vehicle-type-heading" className="v3-h2">
                    {t("hero.v3finderTitle")}
                  </h2>
                  <p className="v3-small ml-auto hidden sm:block">
                    {t("hero.v3finderHint")}
                  </p>
                  <Link
                    href="/vehicle-fitment"
                    className="v3-btn v3-btn-quiet v3-btn-sm ml-auto shrink-0 sm:ml-0"
                  >
                    {t("nav.fitment")}
                  </Link>
                </div>
                <div className="mt-4">
                  <VehicleQuickSelector limit={8} />
                </div>
              </div>
            </section>

            <div className="md:hidden">
              <HomeOffersTeaser />
            </div>

        {/* ============ 3. SHOP BY CATEGORY ============
            Restrained tiles: a single square image stage, a name, one line of
            description and a text affordance. V2 used 8 near-identical rounded
            cards whose only difference was the padding of the image well. */}
        <section id="categories" className="v3-band border-b border-[var(--v3-rule)]">
          <div className="v3-container">
            <div className="v3-head">
              <h2 className="v3-h2">{t("hero.browseSystem")}</h2>
              <p className="v3-small ml-auto hidden max-w-md text-right md:block">
                {t("hero.browseHint")}
              </p>
              <Link
                href="/category/filters"
                className="v3-btn v3-btn-quiet v3-btn-sm ml-auto shrink-0 md:ml-0"
              >
                {t("hero.v3browseAll")}
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-rule)] sm:grid-cols-3 lg:grid-cols-4">
              {categoryCards.map((cat) => {
                const isFilters = cat.slug === "filters";
                const isLubricants = cat.slug === "lubricants";
                return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="v3-focus group flex flex-col bg-white p-2.5 transition-colors hover:bg-[var(--v3-brand-soft)]"
                >
                  {/* One consistent square well for every category, so the
                      row never looks ragged. The inset differs per asset
                      because the source rasters have different margins. */}
                  <div className="v3-stage aspect-square w-full">
                    <Image
                      src={cat.image}
                      alt={cat.name}
                      width={280}
                      height={280}
                      className={
                        isFilters
                          ? "h-full w-full object-contain p-[18%]"
                          : isLubricants
                            ? "h-full w-full object-contain p-[14%]"
                            : "h-full w-full object-contain p-[6%]"
                      }
                      sizes="(min-width: 1024px) 280px, (min-width: 640px) 200px, 45vw"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1 px-1 pt-3">
                    <h3 className="v3-h3 transition-colors group-hover:text-[var(--v3-brand-ink)]">
                      {cat.name}
                    </h3>
                    <p className="v3-small v3-clamp-2 mt-1">{cat.desc}</p>
                    <span className="mt-2.5 inline-flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-bold text-[var(--v3-brand-ink)]">
                      {t("hero.explore")}
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============ 4. SHOP BY BRAND ============
            Brand directory before vehicle discovery. A customer arriving from
            a known part usually knows the brand; a customer who knows only
            their vehicle should meet fitment next, not a logo grid. V2 ran
            fitment first and brands second, which inverted that intent. */}
        <PublicBrandsSection onSelect={(q) => commitSearch(q, 1)} />

        {/* ============ 5. PROMOTIONAL BANNERS ============
            The admin-managed advertisement slider. It sits in exactly the slot
            the removed duplicate Vehicle Fitment section occupied, and shares
            the `v3-band` + `v3-container` device, so it reads as the next
            section in the rhythm rather than as a replacement bolted in.

            The banners are resolved on the server (see app/(public)/page.tsx)
            and passed in, so the slot is server-rendered and occupies its
            height on first paint. */}
        <PromotionalBannerSlider banners={banners} />

        {/* ============ 6. DEALER / BULK ORDER ============
            Deliberately a different visual register from the retail sections
            above it: charcoal field, gold rule, no product imagery. */}
        <HomeDealerCta />
          </>
        ) : null}

        {!searchedQuery && !urlQuery ? (
          <div className="md:hidden">
            <RecentlyViewedSection
              onOpen={(item) =>
                setDetailTarget({
                  partId: item.id,
                  sku: item.partNumber,
                })
              }
            />
          </div>
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
            activeStock={urlStock}
            tab={tab}
            addingId={addingId}
            selectedCount={selectedCount}
            estimatedTotalPaise={estimatedTotalPaise}
            cartCount={cartCount}
            onTabChange={(next) => commitSearch(searchedQuery || query, 1, { tab: next })}
            onBrand={(brand) => commitSearch(searchedQuery || query, 1, { brand, tab: "products" })}
            onCategory={(categoryName) =>
              commitSearch(searchedQuery || query, 1, {
                categoryName,
                stock: urlStock,
                tab: "products",
              })
            }
            onStockChange={(value) => commitSearch(searchedQuery || query, 1, { stock: value })}
            onClearFilters={() =>
              commitSearch(searchedQuery || query, 1, {
                brand: "",
                categoryName: "",
                stock: "all",
                tab: "all",
              })
            }
            onPage={(nextPage) => commitSearch(searchedQuery || query, nextPage)}
            onOpenProduct={(hit) =>
              setDetailTarget({
                partId: hit.document?.id,
                sku: hit.listings?.[0]?.sku || hit.document?.part_number,
              })
            }
            onAddToCart={(listingId, name) => void addToCart(listingId, name)}
          />
        )}

        {!isOrderSearchState ? (
          <>
          {/* ============ 7. TRUST ============
              Spec K: compact, factual, not over-designed.

              V2 split this across two components — a three-item strip that was
              `md:hidden` (so desktop and every dealer user never saw it) and a
              separate "Why SpareLink" narrative card further down. They are one
              section here, on all breakpoints, and the narrative sentence and
              the four support CTAs from that card are kept rather than dropped.

              Five indicators, all functional claims already true of the
              storefront: catalogue parts, GST-inclusive billing, pan-India
              supply, dealer support and Cashfree-backed payment. No counts, no
              ratings, no "trusted by N" figures. */}
          <section
            className="v3-band border-t border-[var(--v3-rule)] bg-white"
            aria-labelledby="trust-heading"
          >
            <div className="v3-container">
              <div className="v3-head">
                <h2 id="trust-heading" className="v3-h2">
                  {t("trust.title")}
                </h2>
              </div>

              <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-rule)] sm:grid-cols-3 lg:grid-cols-5">
                {[
                  t("trust.genuine"),
                  t("trust.gstBilling"),
                  t("trust.panIndia"),
                  t("trust.support"),
                  t("trust.securePayments"),
                ].map((item) => (
                  <li
                    key={item}
                    className="flex min-h-[3.25rem] items-center gap-2 bg-white px-3 py-2.5 text-[0.8125rem] font-semibold text-[var(--v3-text-2)]"
                  >
                    <CheckIcon />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="v3-body mt-4 max-w-3xl">{t("trust.fulfilledBy")}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href="/offers" className="v3-btn v3-btn-quiet v3-btn-sm">
                  {t("nav.offers")}
                </Link>
                <Link href="/help-support" className="v3-btn v3-btn-quiet v3-btn-sm">
                  {t("nav.help")}
                </Link>
                <Link href="/shipping-policy" className="v3-btn v3-btn-quiet v3-btn-sm">
                  {t("legal.shipping")}
                </Link>
                <Link href="/contact-us" className="v3-btn v3-btn-quiet v3-btn-sm">
                  {t("nav.contact")}
                </Link>
              </div>
            </div>
          </section>

          {/* ============ 8. FIRM / DISTRIBUTION INFORMATION ============
              A two-column reading layout: the copy on the left, a sticky
              contents rail on the right. V2 ran this as one narrow centred
              column with eight undifferentiated headings, which is why it read
              as filler. */}
          <section
            id="how-it-works"
            className="v3-band-lg border-t border-[var(--v3-rule)] bg-white"
          >
            <div className="v3-container grid gap-x-10 gap-y-6 lg:grid-cols-12">
              <div className="lg:col-span-4">
                {/* `top-32` was 128px, which is less than the V3 desktop
                    header's 210px, so the moment this rail actually stuck it
                    pinned the top 82px of its own heading behind the header.
                    It read the same header token the cart summary uses, so the
                    rail tracks the header instead of guessing at it. */}
                <div className="lg:sticky lg:top-[calc(var(--v3-header-h)+1rem)]">
                  <p className="v3-label">{t("fulfill.kicker")}</p>
                  <h2 className="v3-h1 mt-2">{t("fulfill.title")}</h2>
                  <p className="v3-small mt-3">{t("fulfill.goalLabel")}</p>
                  <p className="v3-h3">{t("fulfill.goal")}</p>
                </div>
              </div>

              <div className="v3-body space-y-4 lg:col-span-8">
                <p>{t("fulfill.p1")}</p>
                <p>{t("fulfill.p2")}</p>

                <h3 className="v3-h3 pt-3">{t("fulfill.stockTitle")}</h3>
                <p>{t("fulfill.stockP1")}</p>
                <p>{t("fulfill.stockP2")}</p>

                <h3 className="v3-h3 pt-3">{t("fulfill.processTitle")}</h3>
                <p>{t("fulfill.processP")}</p>

                <h3 className="v3-h3 pt-3">{t("fulfill.approachTitle")}</h3>
                <p>{t("fulfill.approachP1")}</p>
                <p className="pt-3">{t("fulfill.close")}</p>
              </div>
            </div>
          </section>

          <HomeOrderCta />
          </>
        ) : null}
      </main>

      {!isOrderSearchState ? (
        <>
          <SiteFooter />
          <Suspense fallback={null}>
            <MobileBottomNav cartCount={cartCount} />
          </Suspense>
        </>
      ) : null}

      <ProductDetailModal
        key={detailTarget?.partId || detailTarget?.sku || "no-product"}
        open={Boolean(detailTarget)}
        partId={detailTarget?.partId}
        sku={detailTarget?.sku}
        onClose={() => setDetailTarget(null)}
        onAddedToCart={() => {
          setCartCount((prev) => prev + 1);
          void refreshCartSummary();
        }}
        onWishlistChange={() => setWishlistCount((prev) => prev + 1)}
      />
    </div>
  );
}
