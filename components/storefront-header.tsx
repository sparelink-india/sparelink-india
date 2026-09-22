"use client";

import Link from "next/link";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CategoriesMenu } from "@/components/categories-menu";
import { HeaderPreferenceToggle } from "@/components/header-preference-toggle";
import { HeaderSearchField, type HeaderSearchProductPick } from "@/components/header-search";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { UTILITY_STRIP } from "@/lib/brand";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

type StorefrontHeaderProps = {
  cartCount?: number;
  wishlistCount?: number;
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: (query?: string) => void;
  onSelectProduct?: (item: HeaderSearchProductPick) => void;
  searchLoading?: boolean;
  committedQuery?: string;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
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
  onSelectProduct,
  searchLoading = false,
  committedQuery = "",
  mobileMenuOpen,
  onMobileMenuToggle,
}: StorefrontHeaderProps) {
  const { t } = useI18n();
  const whatsappHref = getWhatsAppChatUrl();
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);
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
    window.location.assign(resolved ? `/?q=${encodeURIComponent(resolved)}` : "/");
  }

  function renderSearchField() {
    return (
      <HeaderSearchField
        value={searchValue}
        onChange={(value) => (onQueryChange ? onQueryChange(value) : setLocalQuery(value))}
        onSubmitSearch={submitSearch}
        onSelectProduct={onSelectProduct}
        searchLoading={searchLoading}
        committedQuery={committedQuery}
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

  return (
    <header className="sticky top-0 z-40 bg-white text-slate-900 shadow-sm pt-[env(safe-area-inset-top,0px)]">
      <div className="hidden bg-[#7a1233] px-4 py-[7px] text-[12px] font-medium text-white sm:px-6 md:block">
        <div className="mx-auto flex max-w-[1688px] items-center justify-between gap-3">
          <p className="min-w-0 truncate">{UTILITY_STRIP}</p>
          <nav className="hidden items-center gap-3 whitespace-nowrap lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <PeopleIcon />
              {t("nav.trusted")}
            </span>
            <span className="opacity-50">|</span>
            <span className="inline-flex items-center gap-1.5">
              <TruckIcon />
              {t("nav.panIndia")}
            </span>
            <span className="opacity-50">|</span>
            <Link href="/help-support" className="inline-flex items-center gap-1.5 hover:underline">
              <HelpIcon />
              {t("nav.needHelp")}
            </Link>
            <span className="opacity-50">|</span>
            <Link href="/login/dealer" className="inline-flex items-center gap-1.5 hover:underline">
              {t("nav.dealer")}
            </Link>
          </nav>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1688px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-3 py-2 md:flex md:gap-5 md:px-6 md:py-3">
        <button
          type="button"
          className="touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 md:hidden"
          aria-label={t("nav.menu")}
          aria-expanded={menuOpen}
          onClick={toggleMenu}
        >
          <span className="text-lg leading-none" aria-hidden>
            {menuOpen ? "×" : "☰"}
          </span>
        </button>
        <div className="min-w-0 justify-self-center md:justify-self-auto md:shrink-0">
          <BrandLogo />
        </div>
        <Link
          href="/cart"
          className="relative inline-flex h-11 w-11 items-center justify-center md:hidden"
          aria-label={t("nav.cart")}
        >
          <CartIcon />
          <CountBadge count={cartCount} />
        </Link>
        <div className="col-span-3 min-w-0 w-full md:col-auto md:flex-1" data-storefront-search>
          {renderSearchField()}
        </div>
        <div className="hidden shrink-0 items-center justify-end gap-5 text-[13px] font-semibold text-slate-800 md:flex">
          <Link href="/login" className="inline-flex min-h-11 items-center gap-1.5 hover:text-[#7a1233]">
            <UserIcon />
            {t("nav.loginRegister")}
          </Link>
          <Link href="/cart" className="relative inline-flex min-h-11 items-center gap-1.5 pr-1 hover:text-[#7a1233]">
            <span className="relative inline-flex">
              <CartIcon />
              <CountBadge count={cartCount} />
            </span>
            {t("nav.cart")}
          </Link>
          <Link href="/wishlist" className="relative inline-flex min-h-11 items-center gap-1.5 pr-1 hover:text-[#7a1233]">
            <span className="relative inline-flex">
              <HeartIcon />
              <CountBadge count={wishlistCount} />
            </span>
            {t("nav.wishlist")}
          </Link>
          <HeaderPreferenceToggle />
        </div>
      </div>

      <nav className="hidden border-t border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-[1688px] items-center gap-1 px-6 py-2 text-[13px] font-semibold">
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

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1 text-sm font-semibold">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("nav.menu")}</span>
              <HeaderPreferenceToggle compact />
            </div>
            <CategoriesMenu />
            <Link className="min-h-11 py-2.5" href="/">{t("nav.home")}</Link>
            <Link className="min-h-11 py-2.5" href="/brands">{t("nav.brands")}</Link>
            <Link className="min-h-11 py-2.5" href="/vehicle-fitment">{t("nav.fitment")}</Link>
            <Link className="min-h-11 py-2.5" href="/offers">{t("nav.offers")}</Link>
            <Link className="min-h-11 py-2.5" href="/orders">{t("nav.orders")}</Link>
            <Link className="min-h-11 py-2.5" href="/profile">{t("mobile.account")}</Link>
            <Link className="min-h-11 py-2.5" href="/about-us">{t("nav.about")}</Link>
            <Link className="min-h-11 py-2.5" href="/contact-us">{t("nav.contact")}</Link>
            <Link className="min-h-11 py-2.5" href="/login">{t("nav.loginRegister")}</Link>
            <Link className="min-h-11 py-2.5" href="/wishlist">{t("nav.wishlist")}</Link>
            <Link className="min-h-11 py-2.5" href="/track-order">{t("nav.track")}</Link>
            <Link className="min-h-11 py-2.5" href="/help-support">{t("nav.help")}</Link>
            <Link className="min-h-11 py-2.5" href="/login/dealer">{t("nav.dealer")}</Link>
            <WhatsAppCta href={whatsappHref} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
