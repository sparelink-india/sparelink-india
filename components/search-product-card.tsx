"use client";

import { InclusivePrice } from "@/components/inclusive-price";
import { useI18n } from "@/components/preferences-provider";
import { SearchHighlight } from "@/components/search-highlight";
import type { SearchHit, SearchListing } from "@/components/search-experience";
import type { MessageKey } from "@/lib/i18n";
import { displayProductTitle } from "@/lib/product-detail-fields";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";

function stockLabel(
  listing: SearchListing | undefined,
  priced: boolean,
  t: (key: MessageKey, vars?: Record<string, string>) => string,
) {
  if (!listing) return t("product.noListing");
  const stock = listing.stock ?? 0;
  if (!priced) return t("price.onRequest");
  if (listing.status !== "active" || stock <= 0) return t("product.outOfStock");
  return t("product.inStock", { count: String(stock) });
}

function listingImageSrc(hit: SearchHit, listing: SearchListing | undefined) {
  return (
    hit.thumbUrl ||
    listing?.thumbUrl ||
    hit.imageUrl ||
    listing?.imageUrl ||
    "/images/products/placeholder.svg"
  );
}

function formatPaise(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `₹${(value / 100).toLocaleString("en-IN")}`
    : "—";
}

function listingListPaise(listing: SearchListing | undefined) {
  const value = listing?.listInclusivePaise ?? listing?.pricePaise;
  return typeof value === "number" && value > 0 ? value : null;
}

function discountText(listing: SearchListing | undefined) {
  return typeof listing?.discountPercent === "number"
    ? `${Math.round(listing.discountPercent)}%`
    : "—";
}

function MobileCartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4h2l1.4 10.2a2 2 0 0 0 2 1.8h7.8a2 2 0 0 0 1.9-1.4L20 8H6.2M9 20h.01M17 20h.01"
      />
    </svg>
  );
}

export function SearchProductCard({
  hit,
  query,
  addingId,
  layout = "grid",
  index = 0,
  onOpen,
  onAddToCart,
}: {
  hit: SearchHit;
  query: string;
  addingId: string;
  layout?: "grid" | "list" | "mobile";
  /** Card index in the current page; first few stay eager for first paint. */
  index?: number;
  onOpen: () => void;
  onAddToCart: (listingId: string, name: string) => void;
}) {
  const { t } = useI18n();
  const partData = hit.document ?? {};
  const listing = selectPreferredStorefrontListing(hit.listings);
  const title = displayProductTitle(partData.name || t("product.partFallback"), partData.part_number);
  const priced = isAuthoritativeSellingPricePaise(
    listing?.listInclusivePaise,
    listing?.netInclusivePaise,
    listing?.pricePaise,
  );
  const canAdd =
    Boolean(listing) && listing?.status === "active" && (listing?.stock ?? 0) > 0 && priced;
  const image = listingImageSrc(hit, listing);
  const stock = stockLabel(listing, priced, t);
  const eager = index < 4;
  const loading = eager ? "eager" : "lazy";

  const priceBlock = listing ? (
    listing.isPensol ? (
      <p className="sl-price">
        {listing.pricePaise > 0
          ? `₹${(listing.pricePaise / 100).toLocaleString("en-IN")}`
          : t("price.onRequest")}
      </p>
    ) : (
      <InclusivePrice
        pricePaise={listing.pricePaise}
        listInclusivePaise={listing.listInclusivePaise}
        netInclusivePaise={listing.netInclusivePaise}
        discountPercent={listing.discountPercent}
        gstRate={listing.gstRate}
        align={layout === "grid" ? "left" : "right"}
      />
    )
  ) : (
    <p className="sl-h3">{t("price.onRequest")}</p>
  );

  if (layout === "mobile") {
    const listPaise = listingListPaise(listing);
    const partMeta = [
      partData.part_number ? `Part No: ${partData.part_number}` : "Part No: —",
      listing?.gstRate != null ? `GST: ${listing.gstRate}%` : "GST: —",
      listing?.hsn ? `HSN: ${listing.hsn}` : "HSN: —",
    ].join(" • ");

    return (
      <article className="sl-v2-card sl-v2-card-hover p-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="sl-v2-focus flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]100 bg-gradient-to-b from-white to-brand-50/60"
            onClick={onOpen}
            aria-label={title}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              width={48}
              height={48}
              loading={loading}
              decoding="async"
              className="h-full w-full object-contain p-1"
              onError={(event) => {
                const el = event.currentTarget as HTMLImageElement;
                const original = hit.imageUrl || listing?.imageUrl;
                if (original && el.src !== original) {
                  el.src = original;
                  return;
                }
                el.src = "/images/products/placeholder.svg";
              }}
            />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="sl-v2-focus block w-full truncate text-left text-[15px] font-bold leading-snug text-[var(--sl-text)] transition-colorslors duration-200 hover:text-[var(--sl-primary)]"
              onClick={onOpen}
              title={title}
            >
              <SearchHighlight text={title} query={query} />
            </button>
            <p className="sl-partno mt-1 truncate">{partMeta}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="sl-v2-badge sl-v2-badge-brand">LIST {formatPaise(listPaise)}</span>
              <span className="sl-v2-badge">MRP {formatPaise(listing?.mrpPaise)}</span>
              <span className="sl-v2-badge sl-v2-badge-success">DISC {discountText(listing)}</span>
              <button
                type="button"
                disabled={!canAdd || addingId === listing?.id}
                onClick={() => listing && onAddToCart(listing.id, title)}
                className="sl-v2-btn sl-v2-btn-primary ml-auto !min-h-9 !px-3 !text-xs disabled:!bg-[var(--sl-surface-sunk)]0 disabled:text-[var(--sl-muted)]"
                aria-label={`${t("product.addToCart")}: ${title}`}
              >
                {canAdd ? (
                  <>
                    <MobileCartIcon />
                    {t("product.addToCart")}
                  </>
                ) : priced ? (
                  t("product.outOfStock")
                ) : (
                  t("price.onRequest")
                )}
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (layout === "list") {
    return (
      <article className="flex min-w-0 flex-col gap-3 border-b border-[var(--sl-border)] bg-white px-3 py-3 transition-colors duration-200 hover:bg-[var(--sl-primary-soft)]/30 sm:flex-row sm:px-4">
        <button type="button" className="sl-v2-focus h-20 w-20 shrink-0 overflow-hidden rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]radient-to-b from-white to-brand-50/50" onClick={onOpen}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            width={80}
            height={80}
            loading={loading}
            decoding="async"
            className="h-full w-full object-contain p-1"
            onError={(event) => {
              const el = event.currentTarget as HTMLImageElement;
              const original = hit.imageUrl || listing?.imageUrl;
              if (original && el.src !== original) {
                el.src = original;
                return;
              }
              el.src = "/images/products/placeholder.svg";
            }}
          />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" className="sl-v2-focus block w-full text-left text-sm font-bold text-[var(--sl-text)] transition-colorsion-200 hover:text-[var(--sl-primary)]" onClick={onOpen} title={title}>
            <SearchHighlight text={title} query={query} />
          </button>
          <p className="sl-small mt-1">
            {[partData.brand, partData.part_number ? `${t("search.partNo")} ${partData.part_number}` : ""]
              .filter(Boolean)
              .join(" | ")}
          </p>
          {partData.category ? (
            <span className="sl-v2-badge sl-v2-badge-brand mt-10">
              {partData.category}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 flex-row items-end justify-between gap-2 sm:flex-col sm:items-end">
          <p className={`sl-v2-badge ${canAdd ? "sl-v2-badge-success" : "sl-v2-badge-danger"}`}>{stock}</p>
          {priceBlock}
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="sl-v2-btn sl-v2-btn-primary !min-h-9 !px-3 !text-[0.6875rem] disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="sl-v2-card sl-v2-card-hover sl-v2-rule flex h-full flex-col overflow-hidden">
      <button type="button" className="relative aspect-square w-full bg-gradient-to-b from-white to-brand-50/40" onClick={onOpen} aria-label={title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          width={400}
          height={400}
          loading={loading}
          decoding="async"
          className="h-full w-full object-contain p-3"
          onError={(event) => {
            const el = event.currentTarget as HTMLImageElement;
            const original = hit.imageUrl || listing?.imageUrl;
            if (original && el.src !== original) {
              el.src = original;
              return;
            }
            el.src = "/images/products/placeholder.svg";
          }}
        />
      </button>
      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          className="line-clamp-2 text-left text-sm font-bold leading-snug text-slate-950 hover:text-[var(--sl-primary)]"
          onClick={onOpen}
        >
          <SearchHighlight text={title} query={query} />
        </button>
        {partData.brand ? <p className="mt-1 text-xs font-semibold text-[var(--sl-text-soft)]">{partData.brand}</p> : null}
        {partData.part_number ? (
          <p className="mt-0.5 text-[11px] text-[var(--sl-muted)]">
            {t("search.partNo")} {partData.part_number}
          </p>
        ) : null}
        {partData.category ? (
          <span className="mt-2 w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--sl-text-soft)]">
            {partData.category}
          </span>
        ) : null}
        <div className="mt-auto pt-3">
          <p className={`text-[11px] font-bold ${canAdd ? "text-emerald-700" : "text-[var(--sl-muted)]"}`}>{stock}</p>
          <div className="mt-1">{priceBlock}</div>
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary)] px-3 text-xs font-bold text-white hover:bg-[var(--sl-primary-dark)] disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </div>
    </article>
  );
}
