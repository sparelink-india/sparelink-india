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

function CartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
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

/**
 * V3 search result card.
 *
 * Shares the catalogue language of `StorefrontProductCard` — shelf-label strip,
 * square image well with the part number stamped on the corner, then a ruled
 * data block — but carries the fields a SEARCH result has and a browse card
 * does not: HSN, GST rate, list price, MRP and discount, all read from the
 * existing search response. No field is invented and the search API, ranking
 * and HSN parsing are untouched.
 *
 * V2 built this three times over, once per layout, with a different visual
 * result each time: a rounded card with a cream-to-pink gradient image well, a
 * bordered list row, and a compact row with three coloured pills for
 * LIST / MRP / DISC. Three pills per card is what made a results page look
 * like a coupon feed. Here the same numbers are set as a single monospaced
 * figure row separated by rules, so they read as data.
 *
 * This rewrite also removes several malformed class strings that were present
 * in the V2 file and were being silently dropped by Tailwind:
 *   `bg-[var(--sl-sunken)]100`, `bg-[var(--sl-sunken)]radient-to-b`,
 *   `transition-colorslors`, `transition-colorsion-200`,
 *   `disabled:!bg-[var(--sl-sunken)]0`, and a `mt-10` on the category
 *   badge that pushed it 2.5rem below the product name.
 */
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
  const title = displayProductTitle(
    partData.name || t("product.partFallback"),
    partData.part_number,
  );
  const priced = isAuthoritativeSellingPricePaise(
    listing?.listInclusivePaise,
    listing?.netInclusivePaise,
    listing?.pricePaise,
  );
  const canAdd =
    Boolean(listing) &&
    listing?.status === "active" &&
    (listing?.stock ?? 0) > 0 &&
    priced;
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
        align="left"
      />
    )
  ) : (
    <p className="sl-h3">{t("price.onRequest")}</p>
  );

  /* Shared image with the V2 two-step error fallback: try the thumbnail source,
     fall back to the original catalogue URL, then to the placeholder. */
  const imageNode = (size: number, pad: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      width={size}
      height={size}
      loading={loading}
      decoding="async"
      className={`h-full w-full object-contain ${pad}`}
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
  );

  /* Identifier row: the catalogue numbers, set as one monospaced run so a
     reader scanning a results page sees columns of comparable data. */
  const identifierRow = (listing ? (
    <dl className="sl-partno flex flex-wrap items-center gap-x-3 gap-y-0.5 !text-[0.6875rem]">
      {partData.part_number ? (
        <>
          <dt className="sr-only">{t("search.partNo")}</dt>
          <dd>
            {t("search.partNo")} {partData.part_number}
          </dd>
        </>
      ) : null}
      {listing.hsn ? (
        <>
          <dt className="sr-only">HSN</dt>
          <dd>HSN {listing.hsn}</dd>
        </>
      ) : null}
      {listing.gstRate != null ? (
        <>
          <dt className="sr-only">GST</dt>
          <dd>GST {listing.gstRate}%</dd>
        </>
      ) : null}
    </dl>
  ) : null);

  if (layout === "mobile") {
    return (
      <article className="sl-panel p-2.5 transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            className="sl-focus h-16 w-16 shrink-0 overflow-hidden rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-sunken)]"
            onClick={onOpen}
            aria-label={title}
          >
            {imageNode(64, "p-1.5")}
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="sl-focus block w-full text-left text-[0.875rem] font-bold leading-snug text-[var(--sl-ink)] transition-colors hover:text-[var(--sl-brand)]"
              onClick={onOpen}
              title={title}
            >
              <SearchHighlight text={title} query={query} />
            </button>
            {partData.brand ? (
              <p className="sl-label mb-0 mt-1 !text-[0.5625rem]">{partData.brand}</p>
            ) : null}

            {/* Figures as one ruled strip, not three coloured pills. */}
            <div className="sl-partno mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-y border-[var(--sl-rule)] py-1 !text-[0.625rem]">
              <span>LIST {formatPaise(listingListPaise(listing))}</span>
              <span>MRP {formatPaise(listing?.mrpPaise)}</span>
              <span>DISC {discountText(listing)}</span>
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              <span className={`sl-badge ${canAdd ? "sl-badge-ok" : "sl-badge-bad"}`}>
                {stock}
              </span>
              <button
                type="button"
                disabled={!canAdd || addingId === listing?.id}
                onClick={() => listing && onAddToCart(listing.id, title)}
                className={`sl-btn sl-btn-sm ml-auto !min-h-9 !px-2.5 !text-[0.75rem] ${
                  canAdd ? "sl-btn-primary" : "!border-[var(--sl-rule)] !bg-[var(--sl-sunken)] !text-[var(--sl-ink-3)]"
                }`}
                aria-label={`${t("product.addToCart")}: ${title}`}
              >
                <CartIcon className="h-3.5 w-3.5" />
                {canAdd ? t("product.addToCart") : t("product.outOfStock")}
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (layout === "list") {
    return (
      <article className="sl-panel flex flex-col gap-3 p-3 transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)] sm:flex-row sm:items-start sm:p-4">
        <button
          type="button"
          className="sl-focus h-20 w-20 shrink-0 overflow-hidden rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-sunken)]"
          onClick={onOpen}
          aria-label={title}
        >
          {imageNode(80, "p-1.5")}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="sl-focus block w-full text-left text-[0.9375rem] font-bold leading-snug text-[var(--sl-ink)] transition-colors hover:text-[var(--sl-brand)]"
            onClick={onOpen}
            title={title}
          >
            <SearchHighlight text={title} query={query} />
          </button>
          {partData.brand ? (
            <p className="sl-label mb-0 mt-1 !text-[0.5625rem]">{partData.brand}</p>
          ) : null}
          {identifierRow ? <div className="mt-1.5">{identifierRow}</div> : null}
        </div>
        <div className="flex shrink-0 items-end justify-between gap-3 sm:w-44 sm:flex-col sm:items-end">
          {priceBlock}
          <span className={`sl-badge ${canAdd ? "sl-badge-ok" : "sl-badge-bad"}`}>
            {stock}
          </span>
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className={`sl-btn sl-btn-sm sm:w-full ${
              canAdd ? "sl-btn-primary" : "!border-[var(--sl-rule)] !bg-[var(--sl-sunken)] !text-[var(--sl-ink-3)]"
            }`}
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="sl-panel group flex h-full flex-col overflow-hidden transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]">
      {/* Shelf label: brand first, category as the fallback identifier, so the
          strip is never empty. */}
      <div className="flex items-center gap-2 border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)] px-3 py-1.5">
        <span
          className="inline-block h-3 w-[3px] shrink-0 bg-[var(--sl-brand)]"
          aria-hidden
        />
        <span className="sl-label mb-0 sl-clamp-1 !text-[0.625rem] !text-[var(--sl-ink-2)]">
          {partData.brand || partData.category || "—"}
        </span>
      </div>

      <button
        type="button"
        className="relative block aspect-square w-full shrink-0 overflow-hidden bg-[var(--sl-sunken)]"
        onClick={onOpen}
        aria-label={title}
      >
        {imageNode(400, "p-4 transition-transform duration-300 group-hover:scale-[1.04]")}
        {partData.part_number ? (
          <span className="sl-partno absolute bottom-0 left-0 max-w-[85%] truncate rounded-tr-[var(--sl-r-xs)] bg-[var(--sl-surface)] px-1.5 py-0.5 !text-[0.6875rem]">
            {partData.part_number}
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 flex-col px-3 pt-3">
        <button
          type="button"
          className="sl-focus sl-h3 sl-clamp-2 text-left leading-snug transition-colors hover:text-[var(--sl-brand)]"
          onClick={onOpen}
        >
          <SearchHighlight text={title} query={query} />
        </button>

        {identifierRow ? <div className="mt-1.5">{identifierRow}</div> : null}

        {partData.category && partData.brand ? (
          <span className="sl-badge mt-2 w-fit !text-[0.5625rem]">
            {partData.category}
          </span>
        ) : null}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 border-y border-[var(--sl-rule)] px-0 py-2 pt-3">
          {priceBlock}
        </div>

        <div className="mt-auto flex items-center gap-2 py-2.5">
          <span className={`sl-badge ${canAdd ? "sl-badge-ok" : "sl-badge-bad"}`}>
            {stock}
          </span>
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className={`sl-btn sl-btn-sm ml-auto !min-h-9 ${
              canAdd ? "sl-btn-primary" : "!border-[var(--sl-rule)] !bg-[var(--sl-sunken)] !text-[var(--sl-ink-3)]"
            }`}
          >
            <CartIcon className="h-3.5 w-3.5" />
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </div>
    </article>
  );
}
