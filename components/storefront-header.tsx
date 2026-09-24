"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CategoriesMenu } from "@/components/categories-menu";
import { HeaderPreferenceToggle } from "@/components/header-preference-toggle";
import { HeaderSearchField, type HeaderSearchProduct } from "@/components/header-search";
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

function PeopleIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 20a6 6 0 0112 0M16 14a4 4 0 014 6" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v8H3V7zm11 3h4l3 3v2h-7v-5zM7 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
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
    <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c81e1e] px-1 text-[10px] font-bold leading-none text-white">
      {count}
    </span>
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

  function renderSearchField() {
    return (
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
    );
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className="px-3 py-2 text-slate-800 hover:text-[#7a1233]"
    >
      {label}
    </Link>
  );

  if (orderPage) {
    return (
      <header className="bg-[#f7f5f3] text-slate-900">
        <div className="mx-auto max-w-[1240px] px-4 py-4 sm:px-6 md:py-8 lg:px-8">
          <div className="hidden items-start justify-between gap-6 md:flex">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-[#4b0d20] sm:text-5xl">
                Order Spare Parts
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Search and add parts to your cart • All prices are inclusive of GST
              </p>
            </div>
            <Link
              href="/?focus=search"
              className="inline-flex min-h-14 items-center rounded-xl bg-[#7a1233] px-6 text-lg font-bold text-white shadow-sm transition hover:bg-[#611029]"
            >
              <span className="mr-2 text-2xl leading-none">+</span>
              Create New Order
            </Link>
          </div>
          <div className="relative mt-0 md:mt-7 md:rounded-2xl md:bg-white md:p-3 md:shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            {renderSearchField()}
          </div>
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
    <header className="sticky top-0 z-40 overflow-visible bg-white text-slate-900 shadow-sm">
      <div className="bg-[#7a1233] px-4 py-[7px] text-[12px] font-medium text-white sm:px-6">
        <div className="mx-auto flex max-w-[1688px] items-center gap-3">
          <Link href="/" className="shrink-0 text-sm font-extrabold tracking-tight text-white hover:underline">
            SpareParts Pro
          </Link>
          <nav className="hidden items-center gap-1 text-xs font-semibold text-white/90 sm:flex" aria-label="Primary order navigation">
            <Link href="/profile" className="rounded px-2 py-1 hover:bg-white/10 hover:text-white">
              Dashboard
            </Link>
            <Link href="/?focus=search" className="rounded px-2 py-1 hover:bg-white/10 hover:text-white">
              Catalog
            </Link>
            <Link href="/orders" className="rounded px-2 py-1 hover:bg-white/10 hover:text-white">
              Orders
            </Link>
          </nav>
          <p className="ml-auto hidden min-w-0 truncate text-[11px] text-white/75 xl:block">{UTILITY_STRIP}</p>
          <nav className="ml-auto hidden items-center gap-3 whitespace-nowrap text-[12px] font-medium text-white xl:flex">
            <span className="inline-flex items-center gap-1.5">
              <PeopleIcon />
              {t("nav.trusted")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TruckIcon />
              {t("nav.panIndia")}
            </span>
            <Link href="/help-support" className="inline-flex items-center gap-1.5 hover:underline">
              <HelpIcon />
              {t("nav.needHelp")}
            </Link>
            <Link href="/login/dealer" className="hover:underline">
              {t("nav.dealer")}
            </Link>
          </nav>
          <div className="ml-auto shrink-0 sm:hidden">
            <HeaderPreferenceToggle compact />
          </div>
        </div>
      </div>

      <div ref={setPanelHost} className="relative z-30 mx-auto w-full max-w-[1688px]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-3 py-2.5 lg:flex lg:min-w-0 lg:flex-wrap lg:gap-x-5 lg:gap-y-2 lg:px-6 lg:py-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 lg:hidden"
          aria-label={t("nav.menu")}
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <span className="text-lg leading-none" aria-hidden>
            {menuOpen ? "×" : "☰"}
          </span>
        </button>
        <div className="min-w-0 justify-self-center lg:justify-self-auto lg:shrink-0">
          <BrandLogo />
        </div>
        {orderMode ? null : (
          <Link
            href="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center lg:hidden"
            aria-label={t("nav.cart")}
          >
            <CartIcon />
            <CountBadge count={cartCount + cartBump} />
          </Link>
        )}
        <div className="col-span-3 min-w-0 w-full lg:order-3 lg:basis-full xl:order-3 xl:basis-full">{renderSearchField()}</div>
        <div className="hidden min-w-0 shrink items-center justify-end gap-x-3 gap-y-2 text-[13px] font-semibold text-slate-800 lg:flex lg:flex-wrap xl:gap-5">
          <Link href="/login" className="inline-flex min-h-11 items-center gap-1.5 hover:text-[#7a1233]">
            <UserIcon />
            {t("nav.loginRegister")}
          </Link>
          <Link href="/cart" className="relative inline-flex min-h-11 items-center gap-1.5 pr-1 hover:text-[#7a1233]">
            <span className="relative inline-flex">
              <CartIcon />
              <CountBadge count={cartCount + cartBump} />
            </span>
            {t("nav.cart")}
          </Link>
          <Link href="/wishlist" className="relative inline-flex min-h-11 items-center gap-1.5 pr-1 hover:text-[#7a1233]">
            <span className="relative inline-flex">
              <HeartIcon />
              <CountBadge count={wishlistCount + wishBump} />
            </span>
            {t("nav.wishlist")}
          </Link>
          <HeaderPreferenceToggle />
        </div>
      </div>
      </div>

      <nav className="hidden border-t border-slate-200 bg-white lg:block">
        <div className="mx-auto flex max-w-[1688px] min-w-0 items-center gap-1 overflow-x-auto px-4 py-2 text-[13px] font-semibold xl:px-6">
          <CategoriesMenu />
          {navLink("/", t("nav.home"))}
          {navLink("/brands", t("nav.brands"))}
          {navLink("/vehicle-fitment", t("nav.fitment"))}
          {navLink("/offers", t("nav.offers"))}
          {navLink("/about-us", t("nav.about"))}
          {navLink("/contact-us", t("nav.contact"))}
          <WhatsAppCta href={whatsappHref} className="ml-auto px-3 py-2" />
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

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-3 text-sm font-semibold">
            <CategoriesMenu />
            <Link href="/">{t("nav.home")}</Link>
            <Link href="/brands">{t("nav.brands")}</Link>
            <Link href="/vehicle-fitment">{t("nav.fitment")}</Link>
            <Link href="/offers">{t("nav.offers")}</Link>
            <Link href="/about-us">{t("nav.about")}</Link>
            <Link href="/contact-us">{t("nav.contact")}</Link>
            <Link href="/login">{t("nav.loginRegister")}</Link>
            <Link href="/wishlist">{t("nav.wishlist")}</Link>
            <Link href="/track-order">{t("nav.track")}</Link>
            <Link href="/help-support">{t("nav.help")}</Link>
            <Link href="/login/dealer">{t("nav.dealer")}</Link>
            <WhatsAppCta href={whatsappHref} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
