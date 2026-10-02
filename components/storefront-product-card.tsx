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

/**
 * The product card used by every grid in the storefront: the catalogue, the
 * "popular products" band on the homepage, related products, and search results.
 *
 * ONE card, because a shopper who compares the same part on two screens must
 * not be shown two different hierarchies - and because this is the single
 * highest-leverage surface in the storefront: it appears more often than every
 * other component combined.
 *
 * It is written entirely in the V3 token vocabulary (v3-panel, v3-stage,
 * v3-badge, v3-price, v3-partno) rather than raw palette utilities. That is the
 * whole point of the migration: the card was the most-repeated legacy surface,
 * and every raw `bg-white` / `text-slate-950` / `rounded-2xl` on it was one more
 * thing that had to be remembered when the theme changed, instead of a token
 * that changes with everything else.
 *
 * NOTHING ABOUT THE DATA CHANGED. Same fields, same price logic, same
 * availability rule, same add-to-cart behaviour, same i18n keys.
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

  return (
    <article
      className={`v3-panel v3-panel-hover group flex overflow-hidden ${
        compact ? "flex-row" : "flex-col"
      } ${className}`} > {/* The image stage. `v3-stage` supplies the sunk ground and the radius,
          so the picture sits on the same tone in both themes instead of a flat
          grey box that only matched in light mode. */}
      <button
        type="button"
        onClick={onOpen}
        className={`v3-stage v3-focus shrink-0 ${
          compact ? "h-28 w-28" : "aspect-[4/3] w-full"
        }`}
        aria-label={t("photo.enlargeAria", { name })}
      >
        <CatalogueProductImage
          src={imageUrl || listing?.imageUrl}
          thumbUrl={thumbUrl || listing?.thumbUrl}
          mediumUrl={mediumUrl || listing?.mediumUrl}
          alt={name}
          size="thumb"
          className="h-full w-full p-3"
          imgClassName="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
        />
      </button>

      <div
        className={`flex min-w-0 flex-1 flex-col ${
          compact ? "gap-1 p-3" : "gap-1.5 p-4"
        }`}
      >
        {/* Identity first, in the order a buyer scans it: what it is, who
            makes it, and the number they would type into a search box. */}
        {badge ? <span className="v3-badge w-fit">{badge}</span> : null}
        {brand ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v3-brand-ink)]">
            {brand}
          </p>
        ) : null}
        {partNumber ? <p className="v3-partno">{partNumber}</p> : null}

        <h3
          className={`font-bold leading-snug text-[var(--v3-text)] ${
            compact ? "v3-clamp-2 text-sm" : "v3-clamp-2 text-[0.9375rem]"
          }`}
        >
          {name}
        </h3>
        {application ? (
          <p className="v3-small v3-clamp-1">{application}</p>
        ) : null}

        {listing ? (
          <div className="mt-auto flex flex-col gap-2 pt-2">
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
              <p className="text-sm font-bold text-[var(--v3-text)]">
                {t("price.onRequest")}
              </p>
            )}

            {listing.mrpPaise && listing.mrpPaise > listing.pricePaise ? (
              <p className="v3-price-was">
                {t("price.mrp")} ₹{(listing.mrpPaise / 100).toLocaleString("en-IN")}
              </p>
            ) : null}

            {/* Stock is a state, so it wears the state badge rather than
                grey helper text: a shopper scanning a grid should be able to
                filter out the sold-out rows without reading every line. */}
            <div>
              {isAvailable ? (
                <span className="v3-badge v3-badge-ok">{t("product.inStock", { count: stock })}</span>
              ) : (
                <span className="v3-badge v3-badge-bad">{t("product.outOfStock")}</span>
              )}
            </div>

            {/* Full-width primary action at the card foot, 44px tall so it is a
                reliable thumb target on mobile. `justAdded` swaps the label
                rather than moving the button, so the grid does not reflow the
                moment a shopper taps. */}
            <button
              type="button"
              disabled={!isAvailable || adding || justAdded}
              onClick={onAdd}
              className={`btn-press v3-btn !min-h-11 w-full !px-3 text-xs ${
                justAdded
                  ? "v3-btn-primary !bg-[var(--v3-ok)]"
                  : isAvailable
                    ? "v3-btn-primary"
                    : "cursor-not-allowed !border-[var(--v3-rule)] !bg-[var(--v3-sunk)] !text-[var(--v3-text-3)]"
              }`}
            >
              {adding ? "..." : justAdded ? "✓" : t("product.addToCart")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="v3-btn v3-btn-outline btn-press mt-auto !min-h-11 w-full text-xs"
          >
            {t("offers.details")}
          </button>
        )}
      </div>
    </article>
  );
}