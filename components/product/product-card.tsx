"use client";

import { CatalogueProductImage } from "@/components/catalogue-product-image";
import { InclusivePrice } from "@/components/inclusive-price";
import { useI18n } from "@/components/preferences-provider";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import type { MessageKey } from "@/lib/i18n";

/**
 * GENERATION-4 PRODUCT CARD.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a rewrite of `StorefrontProductCard`. That component stays in place
 * and stays in use on the category and search pages. This is a NEW card that
 * takes the SAME listing shape, so it can be adopted surface by surface and the
 * two can be compared side by side before the old one is retired.
 *
 * WHAT IS DELIBERATELY REUSED, NOT REINVENTED
 * --------------------------------------------
 *   - `CatalogueProductImage` for the image. It owns the src/thumb/medium
 *     fallback chain and the "no image" behaviour, and rewriting it would mean
 *     two places deciding what a missing product photo looks like.
 *   - `InclusivePrice` + `isAuthoritativeSellingPricePaise` for money. This is
 *     the single source of truth for what a customer may see, including the
 *     "price on request" case when a listing carries no authoritative price.
 *     A new card that formatted paise itself would be a second financial
 *     renderer, which is exactly the duplication to avoid.
 *
 * WHAT THIS ADDS
 * --------------
 * A reading order that matches how a mechanic actually scans a shelf label —
 * image, brand, part number, name, price, stock, action — with tabular figures
 * on every number, a fixed image stage so a grid of cards is a grid and not a
 * staircase, and explicit states (no image, out of stock, long name, long part
 * number, loading, error) so no surface has to invent them.
 */

/** Identical to StorefrontProductCardListing so this card is a drop-in. */
export type ProductCardListing = {
  id: string;
  dealerName?: string | null;
  firmName?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  status?: string;
  stock: number | null;
  gstRate?: number | null;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  isPensol?: boolean;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

export type ProductCardProps = {
  name: string;
  brand?: string | null;
  partNumber?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  /** Free-text application/fitment line. Rendered only when it exists. */
  application?: string | null;
  /**
   * Provenance label (genuine / original / aftermarket / refurbished). Rendered
   * ONLY when the caller supplies one. The card never derives a label, because
   * a wrong provenance claim on a part is a commercial and legal problem, not a
   * styling one.
   */
  badge?: string | null;
  listing?: ProductCardListing | null;
  /** Renders a skeleton of the card's exact geometry. */
  loading?: boolean;
  /** Renders a compact error card. Never throws. */
  error?: boolean;
  compact?: boolean;
  className?: string;
  adding?: boolean;
  justAdded?: boolean;
  onOpen?: () => void;
  onAdd?: () => void;
  /** Wishlist toggle. When absent the button is not rendered at all. */
  onToggleWishlist?: () => void;
  wishlisted?: boolean;
  /** Above-the-fold cards should set this so the image is not lazy. */
  priority?: boolean;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20.3l-1.4-1.3C5.6 14.3 2.5 11.5 2.5 8.1 2.5 5.3 4.8 3 7.6 3c1.6 0 3.1.7 4.4 2C13.3 3.7 14.8 3 16.4 3c2.8 0 5.1 2.3 5.1 5.1 0 3.4-3.1 6.2-8.1 10.9L12 20.3z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 3h2.2l.5 2.4M7 13h10.2l3-8.4H6.3M7 13 5.3 5.2M7 13l-2.1 6.1h14.2M10 21.2a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2zm8 0a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.2 12S5.8 5.4 12 5.4 21.8 12 21.8 12 18.2 18.6 12 18.6 2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 8.5v5M12 17.2v.1" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

/**
 * Stock state is derived ONLY from real fields on the listing. `stock` is a
 * count, so the card can say "in stock" or "out of stock" and nothing in
 * between. There is deliberately no "only N left" copy here: that needs a
 * low-stock threshold, and no such threshold exists in the data model, so
 * inventing one would be inventing inventory policy.
 *
 * `product.inStock` is "{count} in stock" and takes an interpolation, which a
 * badge with no count to give cannot use honestly — hence the separate
 * count-free `product.inStockShort`.
 *
 * `t` is passed in rather than closed over, so there is no module-level mutable
 * binding that concurrent renders could interleave.
 */
type Translate = (key: MessageKey) => string;

function resolveStock(
  listing: ProductCardListing | null | undefined,
  t: Translate,
): { inStock: boolean; label: string } | null {
  if (!listing) return null;
  const active = listing.status === undefined || listing.status === "active";
  const hasStock = typeof listing.stock === "number" && listing.stock > 0;
  if (!active || !hasStock) {
    return { inStock: false, label: t("product.outOfStock") };
  }
  return { inStock: true, label: t("product.inStockShort") };
}

export function ProductCard({
  name,
  brand,
  partNumber,
  imageUrl,
  thumbUrl,
  mediumUrl,
  application,
  badge,
  listing,
  loading = false,
  error = false,
  className = "",
  adding = false,
  justAdded = false,
  onOpen,
  onAdd,
  onToggleWishlist,
  wishlisted = false,
}: ProductCardProps) {
  const { t } = useI18n();

  /* ---- LOADING: same geometry as the real card, so nothing shifts when the
     data lands. The bar count is fixed per row rather than random so the
     skeleton does not re-roll on every render. */
  if (loading) {
    return (
      <article
        className={`sl-panel flex flex-col overflow-hidden ${className}`}
        aria-hidden
      >
        <div className="sl-skel aspect-[4/3] w-full rounded-none" />
        <div className="flex flex-col gap-2.5 p-4">
          <div className="sl-skel h-3 w-1/3" />
          <div className="sl-skel h-3.5 w-4/5" />
          <div className="sl-skel h-3.5 w-3/5" />
          <div className="sl-skel mt-1 h-5 w-1/2" />
          <div className="sl-skel mt-2 h-10 w-full" />
        </div>
      </article>
    );
  }

  /* ---- ERROR: a real state, not an empty grid. */
  if (error) {
    return (
      <article
        className={`sl-panel sl-state sl-state-bad flex-col p-6 ${className}`}
        role="status"
      >
        <span className="sl-state-icon">
          <AlertIcon />
        </span>
        <p className="sl-state-title">{t("product.loadFailed")}</p>
        <p className="sl-state-text">{t("product.loadFailedHint")}</p>
      </article>
    );
  }

  const stock = resolveStock(listing, t);
  const outOfStock = stock ? !stock.inStock : false;
  const priced = listing
    ? isAuthoritativeSellingPricePaise(
        listing.listInclusivePaise,
        listing.netInclusivePaise,
        listing.pricePaise,
      )
    : false;
  /* The whole card is one activation target when there is no separate action.
     `onOpen` is the primary intent; when it is absent the card is inert and
     only its own buttons are interactive, which is correct for a card that has
     nothing to open. */
  const interactive = typeof onOpen === "function";

  return (
    <article
      className={`sl-panel group relative flex flex-col overflow-hidden transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)] focus-within:shadow-[var(--sl-e-3)] ${
        outOfStock ? "opacity-[0.72]" : ""
      } ${className}`}
      aria-label={name}
    >
      {/* ---------- IMAGE STAGE ----------
          A fixed 4:3 frame with a sunk ground. Fixed ratio is what keeps a grid
          of cards aligned; `object-contain` inside it is what stops a
          wide product photo being cropped or stretched. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)]">
        {interactive ? (
          <button
            type="button"
            onClick={onOpen}
            className="sl-focus absolute inset-0 z-10 cursor-pointer"
            tabIndex={-1}
            aria-hidden
          />
        ) : null}

        <CatalogueProductImage
          src={imageUrl ?? listing?.imageUrl}
          thumbUrl={thumbUrl ?? listing?.thumbUrl}
          mediumUrl={mediumUrl ?? listing?.mediumUrl}
          alt={name}
          className="h-full w-full object-contain p-3"
        />

        {/* Provenance. Copper, and only when the caller supplied a real label. */}
        {badge ? (
          <span className="sl-badge sl-badge-copper absolute left-2.5 top-2.5 z-20">
            {badge}
          </span>
        ) : null}

        {stock && !stock.inStock ? (
          <span className="sl-badge sl-badge-bad absolute left-2.5 top-2.5 z-20">
            {stock.label}
          </span>
        ) : null}

        {/* Wishlist sits top-right and above the image overlay, so it never
            fights the card's own click target. */}
        {typeof onToggleWishlist === "function" ? (
          <button
            type="button"
            onClick={onToggleWishlist}
            aria-pressed={wishlisted}
            aria-label={
              wishlisted ? t("product.removeFromWishlist") : t("product.addWishlist")
            }
            className={`sl-focus absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-[var(--sl-r-sm)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]/90 backdrop-blur-sm transition-colors hover:bg-[var(--sl-surface)] ${
              wishlisted
                ? "text-[var(--sl-brand)]"
                : "text-[var(--sl-ink-3)] hover:text-[var(--sl-brand)]"
            }`}
          >
            <HeartIcon filled={wishlisted} />
          </button>
        ) : null}
      </div>

      {/* ---------- DATA BLOCK ---------- */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        {brand ? (
          <p className="sl-micro truncate font-bold uppercase tracking-[0.09em] text-[var(--sl-brand-ink)]">
            {brand}
          </p>
        ) : null}

        {/* Part number: monospace + tabular + wrapping. Never truncated, because
            a clipped part number is a part number the mechanic cannot read. */}
        {partNumber ? (
          <p className="sl-part sl-wrap-any" title={partNumber}>
            {partNumber}
          </p>
        ) : null}

        <h3 className="sl-clamp-2 text-[0.9375rem] font-semibold leading-snug text-[var(--sl-ink)]">
          {/* The heading carries the accessible full name even when the visible
              text is clamped, so assistive tech never gets the truncated form. */}
          <span className="line-clamp-2">{name}</span>
        </h3>

        {application ? (
          <p className="sl-micro sl-clamp-2 text-[var(--sl-ink-3)]">{application}</p>
        ) : null}

        <div className="mt-auto" />

        {/* ---------- PRICE ----------
            Delegates entirely to InclusivePrice. When there is no
            authoritative price it renders the "on request" string itself, so
            the card never has to decide what to print. */}
        {listing ? (
          <div className="sl-rule my-1" />
        ) : null}

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {listing ? (
              <InclusivePrice
                pricePaise={listing.pricePaise}
                listInclusivePaise={listing.listInclusivePaise}
                netInclusivePaise={listing.netInclusivePaise}
                discountPercent={listing.discountPercent}
                gstRate={listing.gstRate}
                align="left"
              />
            ) : (
              /* No listing at all: search results carry no price, so the card
                 says nothing about money rather than implying a free part. */
              <p className="sl-meta text-[var(--sl-ink-3)]">
                {t("product.priceOnEnquiry")}
              </p>
            )}
          </div>

          {priced && stock && stock.inStock ? (
            <span className="sl-badge sl-badge-ok shrink-0">
              {stock.label}
            </span>
          ) : null}
        </div>
      </div>

      {/* ---------- ACTIONS ----------
          One primary action only. A wishlist button lives on the image; a
          second filled button here would compete with it and push the card's
          primary intent below the fold on a phone. */}
      <div className="border-t border-[var(--sl-rule)] p-3">
        {adding ? (
          <button
            type="button"
            disabled
            className="sl-btn sl-btn-secondary sl-btn-block"
            aria-live="polite"
          >
            {t("product.adding")}
          </button>
        ) : justAdded ? (
          <button type="button" disabled className="sl-btn sl-btn-block !border-[var(--sl-ok-line)] !bg-[var(--sl-ok-soft)] !text-[var(--sl-ok)]">
            {t("product.addedShort")}
          </button>
        ) : typeof onAdd === "function" ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={outOfStock}
            className="sl-btn sl-btn-primary sl-btn-block"
          >
            <CartIcon />
            {t("product.addToCart")}
          </button>
        ) : typeof onOpen === "function" ? (
          <button type="button" onClick={onOpen} className="sl-btn sl-btn-secondary sl-btn-block">
            <EyeIcon />
            {t("product.viewPart")}
          </button>
        ) : null}
      </div>
    </article>
  );
}
