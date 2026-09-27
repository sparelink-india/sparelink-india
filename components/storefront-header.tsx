"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CategoriesMenu } from "@/components/categories-menu";
import { HeaderPreferenceToggle } from "@/components/header-preference-toggle";
import { HeaderSearchField, OrderSearchFilters, type HeaderSearchProduct } from "@/components/header-search";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { UTILITY_STRIP } from "@/lib/brand";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

type FacetOption = { value: string; count: number };
type OrderStockFilter = "all" | "in_stock";

type StorefrontHeaderProps = {
  cartCount?: number;
  wishlistCount?: number;
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: (query?: string) => void;
  searchLoading?: boolean;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  orderMode?: boolean;
  orderPage?: boolean;
  categoryOptions?: FacetOption[];
  activeCategory?: string;
  onCategoryChange?: (value: string) => void;
  stockFilter?: OrderStockFilter;
  onStockFilterChange?: (value: OrderStockFilter) => void;
  onClearFilters?: () => void;
  onCartItemAdded?: (listingId: string, unitPaise?: number) => void;
};

function CartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 6h14M10 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 1116 0" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.3 12.3L12 20l7.7-7.7a4.5 4.5 0 00-6.4-6.4L12 7.2l-1.3-1.3a4.5 4.5 0 00-6.4 6.4z"
      />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M9.1 9a3 3 0 115.8 1c0 1.5-1.5 2-2.4 2.6S12 14 12 15" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--sl-primary)] px-1 text-[10px] font-bold leading-none text-white tabular-nums ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
      )}
    </svg>
  );
}

export function StorefrontHeader({
  cartCount = 0,
  wishlistCount = 0,
  query = "",
  onQueryChange,
  onSearch,
  searchLoading = false,
  mobileMenuOpen,
  onMobileMenuToggle,
  orderMode = false,
  orderPage = false,
  categoryOptions = [],
  activeCategory = "",
  onCategoryChange,
  stockFilter = "all",
  onStockFilterChange,
  onClearFilters,
  onCartItemAdded,
}: StorefrontHeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const whatsappHref = getWhatsAppChatUrl();
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);
  const [detailTarget, setDetailTarget] = useState<{ partId?: string; sku?: string } | null>(
    null,
  );
  const [cartBump, setCartBump] = useState(0);
  const [wishBump, setWishBump] = useState(0);
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const menuOpen = onMobileMenuToggle ? Boolean(mobileMenuOpen) : internalMenuOpen;
  const toggleMenu =
    onMobileMenuToggle ?? (() => setInternalMenuOpen((open) => !open));
  const searchValue = onQueryChange ? query : localQuery;

  function submitSearch(nextQuery?: string) {
    const resolved = (nextQuery ?? searchValue).trim();
    if (onQueryChange && nextQuery !== undefined) {
      onQueryChange(nextQuery);
    } else if (!onQueryChange && nextQuery !== undefined) {
      setLocalQuery(nextQuery);
    }
    if (onSearch) {
      onSearch(resolved);
      return;
    }
    router.push(resolved ? `/?q=${encodeURIComponent(resolved)}` : "/");
  }

  function openProduct(product: HeaderSearchProduct) {
    setDetailTarget({
      partId: product.id,
      sku: product.listing?.sku || product.partNumber,
    });
  }

  function renderSearchField(compact = false, withFilterRow = false) {
    return (
      <div className={compact ? "sl-search sl-search-compact" : "sl-search"}>
        <HeaderSearchField
        value={searchValue}
        onChange={(value) => (onQueryChange ? onQueryChange(value) : setLocalQuery(value))}
        onSubmitSearch={submitSearch}
        searchLoading={searchLoading}
        onOpenProduct={openProduct}
        onAddToCart={async (listingId, unitPaise) => {
          const response = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dealerListingId: listingId, quantity: 1 }),
          });
          if (response.status === 401) {
            router.push("/login");
            return;
          }
          if (response.ok) {
            setCartBump((count) => count + 1);
            onCartItemAdded?.(listingId, unitPaise);
          }
        }}
        panelHost={panelHost}
        suppressFilters={withFilterRow}
        orderMode={orderMode}
        orderPage={orderPage}
        categoryOptions={categoryOptions}
        activeCategory={activeCategory}
        onCategoryChange={onCategoryChange}
        stockFilter={stockFilter}
        onStockFilterChange={onStockFilterChange}
        onClearFilters={onClearFilters}
        mobileCartHref="/cart"
        mobileCartCount={cartCount + cartBump}
        />
      </div>
    );
  }

  const navLink = (href: string, label: string) => {
    const active =
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`sl-nav sl-v2-focus relative inline-flex h-9 shrink-0 items-center rounded-[var(--sl-radius-sm)] px-2.5 transition-colors duration-200 ${
          active
            ? "bg-[var(--sl-primary-soft)] font-bold text-[var(--sl-primary)]"
            : "text-ink-700 hover:bg-[var(--sl-primary-soft)] hover:text-[var(--sl-primary)]"
        }`}
      >
        {label}
      </Link>
    );
  };

  if (orderPage) {
    return (
      <header className="bg-[var(--sl-cream)] text-[var(--sl-text)]">
        <div className="sl-container py-5 md:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="sl-display !text-[clamp(1.6rem,1.2rem+1.8vw,2.4rem)]">
                Order Spare Parts
              </h1>
              <p className="sl-body mt-2">
                Search and add parts to your cart • All prices are inclusive of GST
              </p>
            </div>
            <Link
              href="/?focus=search"
              className="sl-v2-btn sl-v2-btn-primary self-start"
            >
              Create New Order
            </Link>
          </div>
          <div className="sl-v2-card relative mt-5 p-3">{renderSearchField()}</div>
        </div>
        <ProductDetailModal
          key={detailTarget?.partId || detailTarget?.sku || "no-product"}
          open={Boolean(detailTarget)}
          partId={detailTarget?.partId}
          sku={detailTarget?.sku}
          onClose={() => setDetailTarget(null)}
          onAddedToCart={() => setCartBump((count) => count + 1)}
          onWishlistChange={() => setWishBump((count) => count + 1)}
        />
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--sl-border)] bg-white/92 backdrop-blur-xl">
      {/* ---------- V2 UTILITY STRIP ---------- */}
      <div className="bg-[var(--sl-primary-dark)] text-white">
        <div className="sl-container flex h-8 items-center gap-4">
          <p className="sl-nav hidden min-w-0 truncate text-white/70 md:block">
            {UTILITY_STRIP}
          </p>
          <nav
            className="ml-auto flex items-center gap-4 whitespace-nowrap"
            aria-label="Utility"
          >
            <Link
              href="/help-support"
              className="sl-nav sl-v2-focus-invert inline-flex items-center gap-1.5 rounded px-1 text-white/80 transition-colors hover:text-white"
            >
              <HelpIcon />
              <span className="hidden sm:inline">{t("nav.needHelp")}</span>
            </Link>
            <Link
              href="/track-order"
              className="sl-nav sl-v2-focus-invert rounded px-1 text-white/80 transition-colors hover:text-white"
            >
              {t("nav.track")}
            </Link>
            <Link
              href="/login/dealer"
              className="sl-nav sl-v2-focus-invert inline-flex items-center gap-1.5 rounded border border-white/25 px-2 py-1 text-white transition-colors hover:bg-white/10"
            >
              {t("nav.dealer")}
            </Link>
            <div className="md:hidden">
              <HeaderPreferenceToggle compact />
            </div>
          </nav>
        </div>
      </div>

      {/* ---------- V2 MAIN HEADER: logo | search | account | cart | lang ----------

          RESPONSIVE ARCHITECTURE — three tiers, no font shrinking.

          Row 2 previously held logo + a 42rem search + a LABELLED account link
          + a LABELLED cart link + wishlist + the preference toggle: roughly
          1186px of fixed content, against a ~992px container at 1024px. The
          right-hand controls were pushed out of the container and clipped.

          The band is now tiered:
            lg  1024-1279  account and cart are icon-only; search cap drops
            xl  1280+      text labels return and the search widens
          Controls keep shrink-0 (never squeezed) and the search keeps
          flex-1 min-w-0 (always absorbs the remainder), so the two groups
          cannot collide at any viewport width.
        */}
      <div ref={setPanelHost} className="sl-container relative z-30">
        <div className="flex items-center gap-2 py-2.5 sm:gap-3 xl:gap-5">
          <button
            type="button"
            className="sl-v2-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border-strong)] text-[var(--sl-primary)] transition-colors hover:bg-[var(--sl-primary-soft)] lg:hidden"
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            <MenuIcon open={menuOpen} />
          </button>

          <div className="shrink-0">
            <BrandLogo />
          </div>

          {/* The search is a real flex child: `flex-1 min-w-0` with a max width,
              so it absorbs the leftover space and can never push the controls
              beside it. This is the fix for the earlier overlap. */}
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="mx-auto w-full max-w-[22rem] xl:max-w-[42rem]">
              {renderSearchField(true, true)}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {/* Account. Icon-only on tablet, labelled from lg up. */}
            <Link
              href="/login"
              className="sl-v2-focus inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--sl-radius-sm)] text-ink-700 transition-colors hover:bg-[var(--sl-primary-soft)] hover:text-[var(--sl-primary)] xl:w-auto xl:justify-start xl:px-2.5"
            >
              <UserIcon />
              <span className="sl-nav hidden xl:inline">{t("nav.loginRegister")}</span>
            </Link>
            <Link
              href="/wishlist"
              className="sl-v2-focus relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] text-ink-700 transition-colors hover:bg-[var(--sl-primary-soft)] hover:text-[var(--sl-primary)] sm:inline-flex"
              aria-label={t("nav.wishlist")}
            >
              <span className="relative inline-flex">
                <HeartIcon />
                <CountBadge count={wishlistCount + wishBump} />
              </span>
            </Link>
            <Link
              href="/cart"
              className="sl-v2-focus relative inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary)] text-white shadow-[var(--sl-shadow-brand)] transition-colors hover:bg-[var(--sl-primary-dark)] xl:w-auto xl:px-3"
              aria-label={t("nav.cart")}
            >
              <span className="relative inline-flex">
                <CartIcon />
                <CountBadge count={cartCount + cartBump} />
              </span>
              <span className="sl-nav hidden xl:inline">{t("nav.cart")}</span>
            </Link>
            <div className="hidden shrink-0 lg:block">
              <HeaderPreferenceToggle />
            </div>
          </div>
        </div>

        {/*
          ROW 2 \u2014 ORDER-MODE FILTER ROW (Category / Stock / Clear Filters).

          Rendered directly here, in a dedicated full-width row beneath the
          search pill, instead of being a flex child of `.sl-search`.

          That is the whole fix: as a child of the 3rem pill those ~520px of
          shrink-0 controls consumed the row-1 budget on the homepage only
          (the homepage always passes `orderMode`, inner routes do not), which
          clipped the account label to "...gister" at the same viewport width
          where inner routes showed the full "Login / Register".

          `OrderSearchFilters` uses flex-nowrap with shrink-0 children, so the
          three controls stay on ONE line at 1024px and above; the select widths
          step down by breakpoint before the Clear Filters button could wrap.
        */}
        {orderMode ? (
          <div className="hidden pb-2.5 lg:block">
            <OrderSearchFilters
              categories={categoryOptions}
              activeCategory={activeCategory}
              onCategoryChange={onCategoryChange}
              stockFilter={stockFilter}
              onStockFilterChange={onStockFilterChange}
              onClearFilters={onClearFilters}
            />
          </div>
        ) : null}

        {/* Mobile search: a deliberate second row, not a squeezed one. On phones
            the hero search sits far below the fold, so search must live here. */}
        <div className="pb-2.5 lg:hidden">{renderSearchField(true)}</div>
      </div>

      {/* ---------- V2 PRIMARY NAV ---------- */}
      <nav
        className="hidden border-t border-[var(--sl-border)] bg-[var(--sl-surface-sunk)] lg:block"
        aria-label="Primary"
      >
        <div className="sl-container flex min-w-0 items-center gap-0.5 overflow-x-auto py-1">
          <CategoriesMenu />
          <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--sl-border)]" />
          {navLink("/", t("nav.home"))}
          {navLink("/brands", t("nav.brands"))}
          {navLink("/vehicle-fitment", t("nav.fitment"))}
          {navLink("/offers", t("nav.offers"))}
          {navLink("/about-us", t("nav.about"))}
          {navLink("/contact-us", t("nav.contact"))}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            <Link
              href="/wishlist"
              className="sl-v2-focus relative inline-flex h-9 items-center gap-1.5 rounded-[var(--sl-radius-sm)] px-2 text-ink-700 transition-colors hover:bg-[var(--sl-primary-soft)] hover:text-[var(--sl-primary)]"
              aria-label={t("nav.wishlist")}
            >
              <span className="relative inline-flex">
                <HeartIcon />
                <CountBadge count={wishlistCount + wishBump} />
              </span>
              <span className="sl-nav hidden xl:inline">{t("nav.wishlist")}</span>
            </Link>
            <WhatsAppCta href={whatsappHref} className="sl-v2-btn sl-v2-btn-primary !min-h-9 !px-3.5 !py-0 !text-[0.8125rem]" />
          </div>
        </div>
      </nav>

      <ProductDetailModal
        key={detailTarget?.partId || detailTarget?.sku || "no-product"}
        open={Boolean(detailTarget)}
        partId={detailTarget?.partId}
        sku={detailTarget?.sku}
        onClose={() => setDetailTarget(null)}
        onAddedToCart={() => setCartBump((count) => count + 1)}
        onWishlistChange={() => setWishBump((count) => count + 1)}
      />

      {/* ---------- V2 MOBILE DRAWER ---------- */}
      {menuOpen ? (
        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto border-t border-[var(--sl-border)] bg-white lg:hidden">
          <div className="sl-container py-4">
            <CategoriesMenu />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {[
                { href: "/", label: t("nav.home") },
                { href: "/brands", label: t("nav.brands") },
                { href: "/vehicle-fitment", label: t("nav.fitment") },
                { href: "/offers", label: t("nav.offers") },
                { href: "/wishlist", label: t("nav.wishlist") },
                { href: "/track-order", label: t("nav.track") },
                { href: "/help-support", label: t("nav.help") },
                { href: "/about-us", label: t("nav.about") },
                { href: "/contact-us", label: t("nav.contact") },
                { href: "/login/dealer", label: t("nav.dealer") },
              ].map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sl-nav flex min-h-11 items-center rounded-[var(--sl-radius-sm)] border px-3 transition-colors ${
                      active
                        ? "border-[var(--sl-primary-tint)] bg-[var(--sl-primary-soft)] font-bold text-[var(--sl-primary)]"
                        : "border-[var(--sl-border)] bg-[var(--sl-surface)] text-ink-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/login"
                className="sl-v2-btn sl-v2-btn-primary w-full"
              >
                <UserIcon />
                {t("nav.loginRegister")}
              </Link>
              <WhatsAppCta href={whatsappHref} className="sl-v2-btn sl-v2-btn-secondary w-full" />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
