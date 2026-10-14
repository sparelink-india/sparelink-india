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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 3h2.2l.5 2.4M7 13h10.2l3-8.4H6.3M7 13 5.3 5.2M7 13l-2.1 6.1h14.2M10 21.2a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2zm8 0a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z" />
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
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

/**
 * V3 catalogue product card.
 *
 * The composition is a SPECIFICATION ENTRY, not a marketplace listing. V2
 * stacked loose text vertically — brand in brand colour, then name, then part
 * number, then price, then a pill badge, then a full-width rounded button —
 * and every card in a grid was a soft raised box. That is why a V2 grid read
 * as a consumer template.
 *
 * V3 is three ruled bands:
 *
 *   SHELF LABEL   a hairline strip carrying the brand in tracked caps behind a
 *                 3px burgundy rule — the label on a parts-catalogue shelf
 *   IMAGE         a square, consistent well. The image is the single largest
 *                 element on the card, per the V3 brief
 *   DATA BLOCK    name, then a hairline-divided identifier row, then a ruled
 *                 price band, then a ruled action row where the stock state and
 *                 the call to action share one line
 *
 * Every division is a 1px rule and the gutters between rules are visible, so a
 * grid of these reads as a printed catalogue page rather than a card gallery.
 * Radii are 3px and there is no resting shadow; depth appears on hover only.
 *
 * Pricing is untouched. `InclusivePrice` and `isAuthoritativeSellingPricePaise`
 * remain the single source of truth for what is displayed, exactly as in V2.
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
    /* Dense single-line row for search facets and related-parts rails. */
    return (
      <article
        className={`sl-panel flex items-center gap-3 p-2 transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)] ${className}`}
      >
        <button
          type="button"
          onClick={onOpen}
          className="sl-focus h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sl-r-xs)] bg-[var(--sl-sunken)]"
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
          {partNumber ? <p className="sl-partno">{partNumber}</p> : null}
          <h3 className="sl-clamp-2 text-[0.8125rem] font-semibold leading-snug text-[var(--sl-ink)]">
            {name}
          </h3>
        </div>
        <span className={`sl-badge shrink-0 ${isAvailable ? "sl-badge-ok" : "sl-badge-bad"}`}>
          {isAvailable ? t("product.inStockShort") : t("product.outOfStockShort")}
        </span>
      </article>
    );
  }

  return (
    <article
      className={`sl-panel group flex flex-col overflow-hidden transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)] ${className}`}
    >
      {/* ---- BAND 1: SHELF LABEL -------------------------------------- */}
      <div className="flex items-center gap-2 border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)] px-3 py-1.5">
        <span
          className="inline-block h-3 w-[3px] shrink-0 bg-[var(--sl-brand)]"
          aria-hidden
        />
        {brand ? (
          <span className="sl-label mb-0 sl-clamp-1 !text-[0.625rem] !text-[var(--sl-ink-2)]">
            {brand}
          </span>
        ) : (
          /* Keep the label strip height constant whether or not the record
             carries a brand, so a grid never develops a ragged top edge. No
             placeholder brand name is invented. */
          <span className="text-[0.6875rem] text-[var(--sl-ink-3)]" aria-hidden>
            &mdash;
          </span>
        )}
        {badge ? (
          <span className="sl-badge sl-badge-copper ml-auto shrink-0 !text-[0.5625rem]">
            {badge}
          </span>
        ) : null}
      </div>

      {/* ---- BAND 2: IMAGE --------------------------------------------
          Square, not 4:3. Spare parts are photographed on a neutral ground and
          a square well is the only ratio in which they all sit at the same
          visual weight; 4:3 left a band of dead cream under every product. */}
      <button
        type="button"
        onClick={onOpen}
        className="sl-focus relative block aspect-square w-full shrink-0 overflow-hidden bg-[var(--sl-sunken)]"
        aria-label={t("photo.enlargeAria", { name })}
      >
        <CatalogueProductImage
          src={imageUrl || listing?.imageUrl}
          thumbUrl={thumbUrl || listing?.thumbUrl}
          mediumUrl={mediumUrl || listing?.mediumUrl}
          alt={name}
          size="thumb"
          className="h-full w-full p-4 transition-transform duration-300 group-hover:scale-[1.04]"
          imgClassName="h-full w-full object-contain"
        />
        {/* Part number is stamped on the image corner: it is the identifier a
            mechanic scans for, so it should be readable without reading prose. */}
        {partNumber ? (
          <span className="sl-partno absolute bottom-0 left-0 max-w-[85%] truncate rounded-tr-[var(--sl-r-xs)] bg-[var(--sl-surface)] px-1.5 py-0.5 !text-[0.6875rem]">
            {partNumber}
          </span>
        ) : null}
      </button>

      {/* ---- BAND 3: DATA BLOCK --------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-3 pt-3">
          <h3 className="sl-h3 sl-clamp-2 leading-snug transition-colors group-hover:text-[var(--sl-brand)]">
            {name}
          </h3>
          {application ? (
            <p className="sl-small sl-clamp-1 mt-1">{application}</p>
          ) : null}
        </div>

        {listing ? (
          <>
            {/* Price band, ruled top and bottom. Tabular figures so a column
                of cards lines up digit for digit. */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-y border-[var(--sl-rule)] px-3 py-2">
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

            {/* Action row: state on the left, action on the right, one line. */}
            <div className="mt-auto flex items-center gap-2 px-3 py-2.5">
              <span className={`sl-badge ${isAvailable ? "sl-badge-ok" : "sl-badge-bad"}`}>
                {isAvailable
                  ? t("product.inStock", { count: stock })
                  : t("product.outOfStock")}
              </span>
              <button
                type="button"
                disabled={!isAvailable || adding || justAdded}
                onClick={onAdd}
                className={`sl-btn sl-btn-sm ml-auto !min-h-9 ${
                  justAdded || isAvailable
                    ? "sl-btn-primary"
                    : "!border-[var(--sl-rule)] !bg-[var(--sl-sunken)] !text-[var(--sl-ink-3)]"
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
          </>
        ) : (
          <div className="mt-auto border-t border-[var(--sl-rule)] px-3 py-2.5">
            <button
              type="button"
              onClick={onOpen}
              className="sl-btn sl-btn-secondary sl-btn-sm w-full"
            >
              {t("offers.details")}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
