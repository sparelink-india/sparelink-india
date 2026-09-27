"use client";

import { CatalogueProductImage } from "@/components/catalogue-product-image";
import { InclusivePrice } from "@/components/inclusive-price";
import { useI18n } from "@/components/preferences-provider";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

export type StorefrontProductCardListing = {
  id: string;
  dealerName?: string | null;
  firmName?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  /** When omitted, treated as active for browse cards that only expose stock. */
  status?: string;
  stock: number | null;
  gstRate?: number | null;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  isPensol?: boolean;
  pensolCashNetInclusivePaise?: number | null;
  pensolCreditNetInclusivePaise?: number | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

type StorefrontProductCardProps = {
  name: string;
  brand?: string | null;
  partNumber?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  application?: string | null;
  badge?: string | null;
  listing?: StorefrontProductCardListing | null;
  compact?: boolean;
  className?: string;
  adding?: boolean;
  justAdded?: boolean;
  onOpen?: () => void;
  onAdd?: () => void;
};

function CartIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2 6h14M10 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

/**
 * V2 catalogue product card.
 *
 * Hierarchy is deliberately fixed so a grid of these reads as a parts
 * catalogue rather than a marketplace listing:
 *   image stage → brand → name → part number → price → stock → add to cart.
 *
 * The part number uses the monospaced `.sl-partno` treatment because it is
 * catalogue data a mechanic will read aloud or copy, not prose. Pricing logic
 * is untouched — `InclusivePrice` and `isAuthoritativeSellingPricePaise` remain
 * the single source of truth for what is displayed.
 */
export function StorefrontProductCard({
  name,
  brand,
  partNumber,
  imageUrl,
  thumbUrl,
  mediumUrl,
  application,
  badge,
  listing,
  compact = false,
  className = "",
  adding = false,
  justAdded = false,
  onOpen,
  onAdd,
}: StorefrontProductCardProps) {
  const { t } = useI18n();
  const stock = listing?.stock ?? 0;
  const status = listing?.status ?? "active";
  const isPriced = listing
    ? isAuthoritativeSellingPricePaise(
        listing.listInclusivePaise,
        listing.netInclusivePaise,
        listing.pricePaise,
        listing.pensolCashNetInclusivePaise,
        listing.pensolCreditNetInclusivePaise,
      )
    : false;
  const isAvailable =
    Boolean(listing) && status === "active" && stock > 0 && isPriced;

  if (compact) {
    /* Dense row used inside search facets and related-parts rails. */
    return (
      <article
        className={`sl-v2-card sl-v2-card-hover flex items-center gap-3 overflow-hidden p-2 ${className}`}
      >
        <button
          type="button"
          onClick={onOpen}
          className="sl-v2-focus h-16 w-16 shrink-0 overflow-hidden rounded-[var(--sl-radius-sm)] bg-[var(--sl-surface-sunk)]"
          aria-label={t("photo.enlargeAria", { name })}
        >
          <CatalogueProductImage
            src={imageUrl || listing?.imageUrl}
            thumbUrl={thumbUrl || listing?.thumbUrl}
            mediumUrl={mediumUrl || listing?.mediumUrl}
            alt={name}
            size="thumb"
            className="h-full w-full p-1.5"
            imgClassName="h-full w-full object-contain"
          />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="sl-h3 line-clamp-2 !text-sm">{name}</h3>
          {partNumber ? <p className="sl-partno mt-0.5">{partNumber}</p> : null}
        </div>
        <span
          className={`sl-v2-badge shrink-0 ${
            isAvailable ? "sl-v2-badge-success" : "sl-v2-badge-danger"
          }`}
        >
          {isAvailable ? t("product.inStockShort") : t("product.outOfStockShort")}
        </span>
      </article>
    );
  }

  return (
    <article
      className={`sl-v2-card sl-v2-card-hover sl-v2-rule group flex flex-col overflow-hidden ${className}`}
    >
      {/* ---- Image stage: the visual focus. One consistent ratio, clean
           surface, no gradient tint, no floating frame. ---- */}
      <button
        type="button"
        onClick={onOpen}
        className="sl-v2-focus relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--sl-surface-sunk)]"
        aria-label={t("photo.enlargeAria", { name })}
      >
        <CatalogueProductImage
          src={imageUrl || listing?.imageUrl}
          thumbUrl={thumbUrl || listing?.thumbUrl}
          mediumUrl={mediumUrl || listing?.mediumUrl}
          alt={name}
          size="thumb"
          className="h-full w-full p-3 transition-transform duration-300 group-hover:scale-[1.03]"
          imgClassName="h-full w-full object-contain"
        />
        {badge ? (
          <span className="sl-v2-badge sl-v2-badge-brand absolute left-2 top-2">
            {badge}
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        {brand ? <p className="sl-label !text-[var(--sl-primary)]">{brand}</p> : null}

        <h3 className="sl-h3 mt-1 line-clamp-2 transition-colors duration-200 group-hover:text-[var(--sl-primary)]">
          {name}
        </h3>

        {partNumber ? (
          <p className="sl-partno mt-1.5">
            <span className="sr-only">Part number: </span>
            {partNumber}
          </p>
        ) : null}

        {application ? (
          <p className="sl-small mt-1.5 line-clamp-1">{application}</p>
        ) : null}

        {listing ? (
          <div className="mt-auto flex flex-1 flex-col pt-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {isPriced ? (
                <InclusivePrice
                  pricePaise={listing.pricePaise}
                  listInclusivePaise={listing.listInclusivePaise}
                  netInclusivePaise={listing.netInclusivePaise}
                  discountPercent={listing.discountPercent}
                  gstRate={listing.gstRate}
                  align="left"
                />
              ) : (
                <p className="sl-h3">{t("price.onRequest")}</p>
              )}
              {listing.mrpPaise && listing.mrpPaise > listing.pricePaise ? (
                <p className="sl-price-strike">
                  {t("price.mrp")} ₹{(listing.mrpPaise / 100).toLocaleString("en-IN")}
                </p>
              ) : null}
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span
                className={`sl-v2-badge ${
                  isAvailable ? "sl-v2-badge-success" : "sl-v2-badge-danger"
                }`}
              >
                {isAvailable
                  ? t("product.inStock", { count: stock })
                  : t("product.outOfStock")}
              </span>
            </div>

            <button
              type="button"
              disabled={!isAvailable || adding || justAdded}
              onClick={onAdd}
              className={`sl-v2-btn mt-2.5 w-full !min-h-11 !text-[0.8125rem] ${
                justAdded
                  ? "sl-v2-btn-primary"
                  : isAvailable
                    ? "sl-v2-btn-primary"
                    : "!border-[var(--sl-border)] !bg-[var(--sl-surface-sunk)] !text-[var(--sl-muted)]"
              }`}
            >
              {adding ? (
                t("product.adding")
              ) : justAdded ? (
                <>
                  <CheckIcon />
                  {t("product.addedShort")}
                </>
              ) : (
                <>
                  <CartIcon />
                  {t("product.addToCart")}
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="sl-v2-btn sl-v2-btn-secondary mt-auto w-full !min-h-11 !text-[0.8125rem]"
          >
            {t("offers.details")}
          </button>
        )}
      </div>
    </article>
  );
}
