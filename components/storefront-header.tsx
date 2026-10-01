"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CategoriesMenu } from "@/components/categories-menu";
import { HeaderPreferenceToggle } from "@/components/header-preference-toggle";
import {
  HeaderSearchField,
  type HeaderSearchProduct,
} from "@/components/header-search";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { useI18n } from "@/components/preferences-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { StorefrontWhatsApp } from "@/components/storefront-whatsapp";
import { useStorefrontSession } from "@/components/use-storefront-session";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { UTILITY_STRIP } from "@/lib/brand";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

/**
 * Where each role's account control goes, and what it is called.
 *
 * Keyed by the role the session endpoint reports. An unknown or absent role
 * falls back to the customer paths, so a newly added role cannot produce a
 * dead link.
 */
const ACCOUNT_HOME = {
  buyer: "/profile",
  dealer: "/dealer",
  admin: "/admin",
} as const;

/**
 * The visible label for a signed-in visitor, by role.
 *
 * "Admin" and "Dealer" are role NAMES, not copy: they are the words on the
 * account type, and they read as English to a Hindi user exactly as "Admin"
 * does in every Indian admin panel. The customer's own label comes from the
 * dictionary so it does localise.
 */
const ROLE_LABEL = { admin: "Admin", dealer: "Dealer" } as const;

/**
 * WHY THE FLOATING WHATSAPP CONTROL LIVES HERE.
 * =========================================
 * There is NO public storefront layout. `app/layout.tsx` is the only layout
 * above the storefront routes, and it also wraps `/admin` and `/dealer`, so
 * mounting the control there would put a customer contact button in the admin
 * console. A `(storefront)` route group with its own layout would need roughly
 * twenty route directories moved into it, and every one of those files is
 * currently uncommitted work - a move would show up as a delete plus a new
 * file and destroy the "pre-existing changes preserved" property that this
 * repository's safety depends on.
 *
 * So the control is mounted in `StorefrontHeader`, which is the ONE component
 * guaranteed to appear on every customer-facing storefront route:
 *
 *   - `StorefrontShell`   (/products, /about-us, /contact-us, the policy pages)
 *   - `fitment-shell`     (/vehicle-fitment, /vehicle-fitment/[make]/[model])
 *   - directly            (the homepage, /brands, /category/*, /login,
 *                          /register, /login/dealer, /cart, /checkout,
 *                          /orders, /profile, /wishlist, /offers,
 *                          /help-support, /track-order, change-password)
 *
 * EXACTLY ONE INSTANCE, and why that is guaranteed rather than hoped for:
 * every page renders `StorefrontHeader` exactly once, and no page renders both
 * the header and the shell. So one mount in the header yields exactly one
 * control per page, with no per-page work and nothing to keep in sync.
 *
 * WHY A `position: fixed` CONTROL BELONGS INSIDE A `position: sticky` BAR.
 * `sticky` does not create a containing block for a fixed descendant, so the
 * control still resolves against the VIEWPORT - verified by the absence of
 * `transform`, `filter`, `backdrop-filter`, `perspective`, `will-change` or
 * `contain` on the header and on every wrapper above it. The one consequence
 * worth stating: the header is a stacking context at `z-40`, so the control
 * paints WITHIN it. That is correct here - the mobile bottom nav is `z-45` and
 * the control is offset clear of it, and the product modal is `z-50` and
 * should cover it. If a future ancestor of the header gains a `transform`, the
 * control would be positioned against that ancestor instead; the test in
 * `lib/web-completion-regression.test.ts` asserts the no-transform property so
 * that change cannot land silently.
 *
 * NOT MOUNTED FOR `/admin`, `/dealer` or `/order-confirmation`: those render
 * `admin-shell`, the dealer layout, or no storefront chrome at all, and none of
 * them renders this header.
 */

type StorefrontHeaderProps = {
  cartCount?: number;
  wishlistCount?: number;
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: (query?: string) => void;
  searchLoading?: boolean;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  onCartItemAdded?: (listingId: string, unitPaise?: number) => void;
};

/* The header used to accept `orderMode`, `orderPage`, `categoryOptions`,
   `activeCategory`, `onCategoryChange`, `stockFilter`, `onStockFilterChange`
   and `onClearFilters` purely so it could render the Category / Stock / Clear
   filter row underneath the search. All eight props are gone, which is what
   makes "no filter row in the global header" a structural guarantee rather
   than a promise: there is no longer any path from this component to
   `OrderSearchFilters`.

   The filters themselves were not lost. `SearchExperience` already renders its
   own `SearchFilters` panel (brand, category, stock, clear) inside the search
   results, and `category-results` has a `FilterSidebar` for the category
   listing. The header row was a third, duplicate copy of the same controls. */

/* ---------------------------------------------------------------------
   ICONS
   All hand-drawn SVG at a single 1.7 stroke weight and 24px grid so the
   header reads as one set. No emoji anywhere.
   --------------------------------------------------------------------- */

function CartIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 3h2.2l.5 2.4M7 13h10.2l3-8.4H6.3M7 13 5.3 5.2M7 13l-2.1 6.1h14.2M10 21.2a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2zm8 0a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7.2a4 4 0 11-8 0 4 4 0 018 0zM3.8 20.8a8.2 8.2 0 1116.4 0"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
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
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M9.1 9a3 3 0 115.8 1c0 1.5-1.5 2-2.4 2.6S12 14 12 15" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

/* Square count chip. A circle badge read as a consumer-app bubble; a chip
   reads as a data readout, which is the V3 register. */
function CountChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="v3-num absolute -right-1.5 -top-1.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[2px] bg-[var(--v3-brand)] px-1 text-[10px] font-bold leading-none text-white">
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
      strokeWidth="1.8"
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
  onCartItemAdded,
}: StorefrontHeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const whatsappHref = getWhatsAppChatUrl();
  /* The real session, so the account control reflects who is actually
     signed in. See use-storefront-session for why this is a fetch rather
     than a prop, and why `loading` starts true. */
  const session = useStorefrontSession();
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);
  const [detailTarget, setDetailTarget] = useState<{
    partId?: string;
    sku?: string;
  } | null>(null);
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
      // Plain sizing wrapper. The search geometry lives on the <form> itself
      // via `searchClassName`, so it must not be duplicated here or the field
      // renders as a box inside a box.
      //
      // `orderMode` / `orderPage` are deliberately NOT passed. Left at their
      // defaults they disable three things that must not appear in the global
      // header: the Category/Stock/Clear filter row, the second cart control
      // that used to be injected inside the search field on phones, and the
      // variant that hid the Search button. `HeaderSearchField` keeps those
      // props for its own order-search mode; the header is not that mode.
      <div className="w-full min-w-0">
        <HeaderSearchField
          value={searchValue}
          onChange={(value) =>
            onQueryChange ? onQueryChange(value) : setLocalQuery(value)
          }
          onSubmitSearch={submitSearch}
          searchLoading={searchLoading}
          onOpenProduct={openProduct}
          onAddToCart={async (listingId, unitPaise) => {
            const response = await fetch("/api/cart", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dealerListingId: listingId,
                quantity: 1,
              }),
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
          searchClassName="v3-search"
        />
      </div>
    );
  }

  /* V3 nav item: no pill, no filled active background. The active page is
     marked by a 2px burgundy underline, which is the only place burgundy
     appears in this row. */
  /* "Products" now points at /products, the full catalogue index, and NOT at
     /category/filters. A navigation item labelled "Products" that opened one
     category was misrepresenting itself: the shopper got a filtered slice and
     had no filters, no brand axis and no vehicle axis to widen it with.
     /category/filters still exists and is still reachable from the category
     grid, the footer and every category link. */
  const navLink = (href: string, label: string) => {
    const active =
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`v3-focus relative inline-flex h-16 shrink-0 items-center px-3 text-[0.8125rem] font-semibold tracking-[0.01em] transition-colors ${
          active
            ? "text-[var(--v3-brand-ink)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[var(--v3-brand)]"
            : "text-[var(--v3-text-2)] hover:text-[var(--v3-brand-ink)]"
        }`}
      >
        {label}
      </Link>
    );
  };

  /* The old `orderPage` early return rendered a completely different header -
     utility bar, nav row and right-hand controls all gone, replaced by an
     "Order Search" panel with its own copy of the search field and its own
     filter row. It therefore swapped the entire header out from under the user
     the moment a query was typed, and it was the reason the homepage carried
     two live search forms.

     It is gone. There is now one header, and `SearchExperience` owns the
     search-results presentation below it. */

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--v3-rule)] bg-white">
      {/* ================= A. UTILITY BAR =================
          Charcoal, one line. In V2 this strip was burgundy, which made burgundy
          the site's default background. Here burgundy is reserved for actions
          and the active state, so the strip is ink.

          48px on desktop per the brief, 32px on a phone - a 48px strip on a
          667px-tall screen is dead weight, and the brief also asks for the
          utility bar to stay compact. The strip carries the theme and language
          controls below `lg`, where the main row has no room for them; from
          `lg` they move into the main row and this slot is empty. */}
      <div className="bg-[var(--v3-inverse)] text-white">
        <div className="v3-container flex h-8 items-center gap-4 md:h-12">
          <p className="v3-label hidden min-w-0 truncate text-white/55 md:block">
            {UTILITY_STRIP}
          </p>
          <nav
            className="ml-auto flex items-center gap-1 whitespace-nowrap"
            aria-label={t("common.utilityNavAria")}
          >
            <Link
              href="/help-support"
              className="v3-focus-invert inline-flex h-8 items-center gap-1.5 px-2 text-[0.75rem] font-medium text-white/75 transition-colors hover:text-white md:h-12"
            >
              <HelpIcon />
              <span className="hidden sm:inline">{t("nav.needHelp")}</span>
            </Link>
            <Link
              href="/track-order"
              className="v3-focus-invert inline-flex h-8 items-center px-2 text-[0.75rem] font-medium text-white/75 transition-colors hover:text-white md:h-12"
            >
              {t("nav.track")}
            </Link>
            {/* DEALER LOGIN IS NOT HERE.
                It used to be a bordered link in the utility bar of every
                page. A retailer or a customer has no reason to see a trade
                portal, and the same link was repeated in the mobile drawer
                and the footer, so a B2B entry point read as a customer
                feature.

                The ROUTE is untouched: /login/dealer still resolves, the
                dealer layout still redirects here, and the homepage's
                Dealer / Bulk Order band still links to it for a buyer who
                genuinely wants it. This is a navigation-surface change, not
                a removal. */}
            <div className="lg:hidden">
              <HeaderPreferenceToggle compact />
            </div>
          </nav>
        </div>
      </div>

      {/* ================= B. MAIN HEADER =================
          ONE row on desktop: logo | search | account / wishlist / cart /
          theme+language, all on a shared vertical centre line.

          There is exactly ONE search form in the DOM. The previous version
          rendered `renderSearchField()` twice - once in an `lg:block` wrapper
          and once in an `lg:hidden` wrapper below it - so the homepage shipped
          two live `data-storefront-search` forms sharing one piece of state.
          The single form below is placed with `order` instead: full width on
          its own line under the logo row on a phone, inline in the middle of
          the row from `md` up. Same one form, no duplicate.

          The search is a real flex child (`flex-1 min-w-0` with a max width)
          so it absorbs the leftover space and can never push the controls
          beside it off the container. Everything else is `shrink-0`. */}
      <div ref={setPanelHost} className="v3-container relative z-30">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 py-2.5 md:gap-x-5 md:py-3 md:min-h-[96px] lg:gap-x-6 lg:py-0">
          {/* LEFT: logo. Fixed width at every breakpoint, because the mark is
              exactly 2:1, so the box is locked to its intrinsic ratio and the
              logo can never reflow the row. */}
          <div className="flex shrink-0 items-center">
            <BrandLogo />
          </div>

          {/* CENTER: the search. `order-last w-full` puts it on its own line
              below the logo row on a phone; from `md` it returns to document
              order and becomes the flexible middle column. 500px, then 600px
              from `xl`, per the brief. `min-w-0` is what lets it shrink on a
              768px screen instead of wrapping the row. */}
          <div className="order-last w-full min-w-0 md:order-none md:mx-auto md:w-auto md:max-w-[500px] md:flex-1 xl:max-w-[600px]">
            {renderSearchField()}
          </div>

          {/* RIGHT: account, wishlist, cart, theme + language, and the drawer
              button. Grouped so the cluster can never be split across lines. */}
          <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
            {/* THE ACCOUNT CONTROL.

                Previously this was an unconditional "Login / Register" link,
                so a customer who had just signed in still saw it. It now
                reflects the real session:

                  signed out  -> /login, labelled Login / Register
                  signed in   -> the role's own home, labelled with the role

                A role home rather than a generic dashboard, because the three
                roles land in three different places and a signed-in admin
                clicking "My Account" and being sent to /admin is correct,
                not a bug.

                `SignOutButton` is rendered only in the signed-in branch, so
                the DOM contains the action that actually works. Nothing is
                hidden with CSS. */}
            {session.authenticated ? (
              <>
                <Link
                  href={ACCOUNT_HOME[session.role ?? "buyer"]}
                  className="v3-focus hidden h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--v3-r)] text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-brand-ink)] md:inline-flex xl:w-auto xl:justify-start xl:px-2.5"
                >
                  <UserIcon />
                  <span className="hidden text-[0.8125rem] font-semibold xl:inline">
                    {session.role && session.role !== "buyer"
                      ? ROLE_LABEL[session.role]
                      : t("nav.account")}
                  </span>
                  <span className="sr-only">{t("nav.account")}</span>
                </Link>
                <SignOutButton
                  className="hidden h-11 shrink-0 items-center rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] px-3 text-[0.8125rem] font-semibold text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-brand-ink)] md:inline-flex"
                  onSignedOut={session.refresh}
                />
              </>
            ) : (
              <Link
                href="/login"
                className="v3-focus hidden h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--v3-r)] text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-brand-ink)] md:inline-flex xl:w-auto xl:justify-start xl:px-2.5"
              >
                <UserIcon />
                <span className="hidden text-[0.8125rem] font-semibold xl:inline">
                  {t("nav.loginRegister")}
                </span>
                <span className="sr-only">{t("nav.loginRegister")}</span>
              </Link>
            )}

            <Link
              href="/wishlist"
              className="v3-focus relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-[var(--v3-r)] text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-brand-ink)] sm:inline-flex"
              aria-label={t("nav.wishlist")}
            >
              <span className="relative inline-flex">
                <HeartIcon />
                <CountChip count={wishlistCount + wishBump} />
              </span>
            </Link>

            {/* Cart is the one filled control in the header: the single
                primary action available before a session exists. */}
            <Link
              href="/cart"
              className="v3-focus relative inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--v3-r)] bg-[var(--v3-brand)] text-white transition-colors hover:bg-[var(--v3-brand-hover)] xl:w-auto xl:px-3.5"
              aria-label={t("nav.cart")}
            >
              <span className="relative inline-flex">
                <CartIcon />
                <CountChip count={cartCount + cartBump} />
              </span>
              <span className="hidden text-[0.8125rem] font-bold xl:inline">
                {t("nav.cart")}
              </span>
            </Link>

            <div className="hidden shrink-0 lg:block">
              <HeaderPreferenceToggle />
            </div>

            {/* Drawer button. It moved to the RIGHT of the cart: the brief asks
                for LOGO / CART / MENU on a phone, and the drawer is the only
                way to reach the navigation below `lg`. */}
            <button
              type="button"
              className="v3-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] text-[var(--v3-text)] transition-colors hover:border-[var(--v3-brand)] hover:text-[var(--v3-brand-ink)] lg:hidden"
              aria-label={t("nav.menu")}
              aria-expanded={menuOpen}
              onClick={toggleMenu}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
        </div>
      </div>

      {/* ================= C. PRIMARY NAV =================
          White, hairline top, no filled active pill.

          The `overflow-x-auto` scroller deliberately wraps ONLY the nav links,
          not the whole row. It used to sit on the row itself, which put
          `<CategoriesMenu>` inside a scroll container - and because
          `overflow-x: auto` forces the other axis to compute to `auto` too,
          that container clipped the menu's absolutely-positioned panel to the
          44px nav strip. The panel is `md:w-[38rem]` and hangs below the nav,
          so it was cut away and the menu appeared not to open at all.

          The header is `sticky z-40` and the hero and page sections are static
          with no z-index, transform or isolation, so once the panel is no
          longer clipped it already paints above them. The panel's own `z-50`
          keeps it above the nav row, and the product modal - `fixed z-50`,
          later in this same header - still paints above the panel. */}
      <nav
        className="hidden border-t border-[var(--v3-rule)] bg-white lg:block"
        aria-label={t("nav.primary")}
      >
        <div className="v3-container flex min-w-0 items-center lg:min-h-16">
          <CategoriesMenu />
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--v3-rule)]" />
            {/* PRIMARY CUSTOMER NAVIGATION.
                Home / Products / Cart / Accounts / Profile.

                The product-discovery destinations this row used to carry
                directly (Brands, Vehicle Fitment, Offers) are now reached
                through the CategoriesMenu to the left and the mobile drawer,
                so nothing became unreachable. About Us and Contact Us remain
                in the footer. Cart stays a main-row control as well as a nav
                item, because the row control carries the live count. */}
            {navLink("/", t("nav.home"))}
            {navLink("/products", t("nav.products"))}
            {navLink("/cart", t("nav.cart"))}
            {navLink("/account", t("nav.accounts"))}
            {navLink("/profile", t("nav.profile"))}
          </div>
          {/* Wishlist used to sit here as well as in the main row. It is a
              main-row control now, so this row carries only the one thing the
              brief asks for on the right. */}
          <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
            <WhatsAppCta
              href={whatsappHref}
              className="v3-btn v3-btn-primary !min-h-9 !px-3.5 !py-0 !text-[0.8125rem]"
            />
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

      {/* ================= MOBILE DRAWER ================= */}
      {menuOpen ? (
        <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto border-t border-[var(--v3-rule)] bg-white lg:hidden">
          <div className="v3-container py-4">
            <CategoriesMenu />
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {[
                { href: "/", label: t("nav.home") },
                { href: "/products", label: t("nav.products") },
                { href: "/cart", label: t("nav.cart") },
                { href: "/account", label: t("nav.accounts") },
                { href: "/profile", label: t("nav.profile") },
                { href: "/brands", label: t("nav.brands") },
                { href: "/vehicle-fitment", label: t("nav.fitment") },
                { href: "/offers", label: t("nav.offers") },
                { href: "/wishlist", label: t("nav.wishlist") },
                { href: "/track-order", label: t("nav.track") },
                { href: "/help-support", label: t("nav.help") },
                { href: "/about-us", label: t("nav.about") },
                { href: "/contact-us", label: t("nav.contact") },
                /* No dealer entry here either. The drawer is the phone's
                   primary navigation, so a trade-portal link in it was the
                   most prominent customer-facing instance of the problem. */
              ].map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`v3-focus flex min-h-11 items-center border px-3 text-[0.8125rem] font-semibold transition-colors ${
                      active
                        ? "border-[var(--v3-brand-line)] bg-[var(--v3-brand-soft)] text-[var(--v3-brand-ink)]"
                        : "border-[var(--v3-rule)] text-[var(--v3-text-2)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/login" className="v3-btn v3-btn-primary w-full">
                <UserIcon />
                {t("nav.loginRegister")}
              </Link>
              <WhatsAppCta href={whatsappHref} className="v3-btn v3-btn-outline w-full" />
            </div>
          </div>
        </div>
      ) : null}

      {/* THE ONE FLOATING WHATSAPP CONTROL.

          Mounted here, as the last child of <header>, for the coverage
          reasons set out above. Placement notes:

            - AFTER the drawer, so it is not inside the `lg:hidden` subtree and
              does not disappear when the drawer is closed.
            - It is a sibling of the modal trigger, not a descendant of any
              `overflow` container. The drawer's `overflow-y-auto` would have
              clipped a control placed inside it, which is one reason the
              earlier footer-and-shell mounts were unreliable.
            - `StorefrontWhatsApp` reads the same session hook and the same
              session endpoint this header already uses, so the two can never
              disagree about who is signed in, and it returns null while signed
              in. */}
      <StorefrontWhatsApp />
    </header>
  );
}
