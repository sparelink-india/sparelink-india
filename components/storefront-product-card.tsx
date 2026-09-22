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
      className={`card-hover flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs ${
        compact ? "flex-row gap-0" : "flex-col"
      } ${className}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className={`relative shrink-0 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233] ${
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
          className="h-full w-full p-2"
          imgClassName="h-full w-full object-contain"
        />
      </button>

      <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${compact ? "p-3" : "p-3.5"}`}>
        {badge ? (
          <span className="inline-flex w-fit rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
            {badge}
          </span>
        ) : null}
        {brand ? (
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{brand}</p>
        ) : null}
        {partNumber ? (
          <p className="font-mono text-xs font-semibold text-slate-800">{partNumber}</p>
        ) : null}
        <h3 className={`font-bold leading-snug text-slate-950 ${compact ? "line-clamp-2 text-sm" : "line-clamp-3 text-base"}`}>
          {name}
        </h3>
        {application ? (
          <p className="line-clamp-1 text-xs text-slate-500">{application}</p>
        ) : null}

        {listing ? (
          <div className="mt-auto space-y-2 pt-1">
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
              <p className="text-sm font-bold text-slate-800">{t("price.onRequest")}</p>
            )}
            {listing.mrpPaise && listing.mrpPaise > listing.pricePaise ? (
              <p className="text-[11px] text-slate-400 line-through">
                {t("price.mrp")} ₹{(listing.mrpPaise / 100).toLocaleString("en-IN")}
              </p>
            ) : null}
            <p className="text-[11px] text-slate-500">
              {isAvailable ? t("product.inStock", { count: stock }) : t("product.outOfStock")}
            </p>
            <button
              type="button"
              disabled={!isAvailable || adding || justAdded}
              onClick={onAdd}
              className={`btn-press min-h-11 w-full rounded-xl text-xs font-bold ${
                justAdded
                  ? "bg-emerald-600 text-white"
                  : isAvailable
                    ? "bg-slate-950 text-white"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              {adding ? "..." : justAdded ? "✓" : t("product.addToCart")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="btn-press mt-auto min-h-11 w-full rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
          >
            {t("offers.details")}
          </button>
        )}
      </div>
    </article>
  );
}
