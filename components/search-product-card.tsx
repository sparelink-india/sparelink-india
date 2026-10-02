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
  layout?: "grid" | "tiles" | "list" | "mobile" | "detailed";
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
      <p className="text-sm font-extrabold text-[var(--v3-text)]">
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
        /* LIST is the only right-aligned layout; the card layouts read
           left-to-right with the price under the title. */
        align={layout === "list" ? "right" : "left"}
      />
    )
  ) : (
    <p className="text-sm font-extrabold text-[var(--v3-text)]">{t("price.onRequest")}</p>
  );

  if (layout === "mobile") {
    const listPaise = listingListPaise(listing);
    const partMeta = [
      partData.part_number ? `Part No: ${partData.part_number}` : "Part No: —",
      listing?.gstRate != null ? `GST: ${listing.gstRate}%` : "GST: —",
      listing?.hsn ? `HSN: ${listing.hsn}` : "HSN: —",
    ].join(" • ");

    return (
      <article className="rounded-[var(--v3-r)] border border-[var(--v3-brand)] bg-[var(--v3-panel)] p-3 ">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--v3-r)] bg-[var(--v3-brand)]"
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
              className="block w-full truncate text-left text-[17px] font-extrabold leading-tight text-[var(--v3-text)] hover:text-[var(--v3-brand-ink)]"
              onClick={onOpen}
              title={title}
            >
              <SearchHighlight text={title} query={query} />
            </button>
            <p className="mt-1 truncate text-[11px] font-medium text-[var(--v3-text-2)]">{partMeta}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-[var(--v3-brand-soft)] px-2 py-1 text-[11px] font-bold text-[var(--v3-brand-ink)]">
                LIST {formatPaise(listPaise)}
              </span>
              <span className="rounded-md bg-[var(--v3-sunk)] px-2 py-1 text-[11px] font-bold text-[var(--v3-text-2)]">
                MRP {formatPaise(listing?.mrpPaise)}
              </span>
              <span className="rounded-md bg-[var(--v3-ok-soft)] px-2 py-1 text-[11px] font-bold text-[var(--v3-ok)]">
                DISC {discountText(listing)}
              </span>
              <button
                type="button"
                disabled={!canAdd || addingId === listing?.id}
                onClick={() => listing && onAddToCart(listing.id, title)}
                className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-3 text-xs font-bold text-white hover:bg-[#611029] disabled:cursor-not-allowed disabled:bg-[var(--v3-sunk-deep)] disabled:text-[var(--v3-text-3)]"
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
      <article className="flex min-w-0 flex-col gap-3 border-b border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 py-3 sm:flex-row sm:px-4">
        <button type="button" className="h-20 w-20 shrink-0 overflow-hidden rounded-[var(--v3-r)] bg-[var(--v3-sunk)]" onClick={onOpen}>
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
          <button type="button" className="block w-full text-left text-sm font-bold text-[var(--v3-text)] hover:text-[var(--v3-brand-ink)]" onClick={onOpen}>
            <SearchHighlight text={title} query={query} />
          </button>
          <p className="mt-1 text-xs text-[var(--v3-text-3)]">
            {[partData.brand, partData.part_number ? `${t("search.partNo")} ${partData.part_number}` : ""]
              .filter(Boolean)
              .join(" | ")}
          </p>
          {partData.category ? (
            <span className="mt-1 inline-flex rounded-full bg-[var(--v3-sunk)] px-2 py-0.5 text-[10px] font-semibold text-[var(--v3-text-2)]">
              {partData.category}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 flex-row items-end justify-between gap-2 sm:flex-col sm:items-end">
          <p className={`text-[11px] font-bold ${canAdd ? "text-[var(--v3-ok)]" : "text-[var(--v3-text-3)]"}`}>{stock}</p>
          {priceBlock}
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="min-h-9 rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-3 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </article>
    );
  }

  /* TILES: denser than GRID. Same fields, tighter type and padding, so more
     products fit on screen without losing price, discount or stock. */
  if (layout === "tiles") {
    return (
      <article className="flex h-full flex-col overflow-hidden rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] transition hover:shadow-md">
        <button
          type="button"
          className="relative aspect-[4/3] w-full bg-[var(--v3-sunk)]"
          onClick={onOpen}
          aria-label={title}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            width={300}
            height={225}
            loading={loading}
            decoding="async"
            className="h-full w-full object-contain p-2"
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
          {typeof listing?.discountPercent === "number" && listing.discountPercent > 0 ? (
            <span className="absolute right-1.5 top-1.5 rounded-md bg-[#4b7d1c] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {Math.round(listing.discountPercent)}% OFF
            </span>
          ) : null}
        </button>
        <div className="flex flex-1 flex-col p-2.5">
          {partData.part_number ? (
            <p className="font-mono text-[10px] font-semibold text-[var(--v3-text-3)]">
              {partData.part_number}
            </p>
          ) : null}
          <button
            type="button"
            className="line-clamp-2 text-left text-[13px] font-bold leading-snug text-[var(--v3-text)] hover:text-[var(--v3-brand-ink)]"
            onClick={onOpen}
          >
            <SearchHighlight text={title} query={query} />
          </button>
          <p className="mt-1.5 text-[13px] font-extrabold text-[var(--v3-text)]">
            LIST {formatPaise(listingListPaise(listing))}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--v3-text-3)]">
            <span className="line-through">MRP {formatPaise(listing?.mrpPaise)}</span>
            <span className="text-[var(--v3-ok)]">DISC {discountText(listing)}</span>
          </div>
          <p className={`mt-1 text-[10px] font-bold ${canAdd ? "text-[var(--v3-ok)]" : "text-[var(--v3-text-3)]"}`}>
            {stock}
          </p>
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="mt-1.5 inline-flex min-h-9 w-full items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-2 text-[11px] font-bold text-white hover:bg-[#611029] disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </article>
    );
  }

  /* DETAILED: the browsing view. Larger image and the fullest set of fields the
     search contract actually returns.

     NOT shown, deliberately: vehicle compatibility, warranty, and product
     type/quality. None of those exist on `SearchHit` or `SearchListing`, and the
     brief says not to invent fields. They are available on the product detail
     modal, which the whole card opens, so nothing is lost - it is just not
     faked here. */
  if (layout === "detailed") {
    return (
      <article className="flex h-full flex-col overflow-hidden rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] transition hover:shadow-md">
        <div className="flex flex-col sm:flex-row">
          <button
            type="button"
            className="relative aspect-square w-full shrink-0 bg-[var(--v3-sunk)] sm:aspect-auto sm:h-44 sm:w-44"
            onClick={onOpen}
            aria-label={title}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              width={360}
              height={360}
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
          <div className="flex min-w-0 flex-1 flex-col p-4">
            {partData.brand ? (
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--v3-text-3)]">
                {partData.brand}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-0.5 text-left text-base font-bold leading-snug text-[var(--v3-text)] hover:text-[var(--v3-brand-ink)]"
              onClick={onOpen}
            >
              <SearchHighlight text={title} query={query} />
            </button>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase text-[var(--v3-text-3)]">{t("search.partNo")}</dt>
                <dd className="truncate font-mono font-semibold text-[var(--v3-text)]">
                  {partData.part_number || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase text-[var(--v3-text-3)]">HSN</dt>
                <dd className="truncate font-mono text-[var(--v3-text-2)]">{listing?.hsn || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase text-[var(--v3-text-3)]">GST</dt>
                <dd className="text-[var(--v3-text-2)]">
                  {listing?.gstRate != null ? `${listing.gstRate}%` : "—"}
                </dd>
              </div>
              {listing?.sku ? (
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase text-[var(--v3-text-3)]">SKU</dt>
                  <dd className="truncate font-mono text-[var(--v3-text-2)]">{listing.sku}</dd>
                </div>
              ) : null}
              {partData.category ? (
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase text-[var(--v3-text-3)]">{t("product.category")}</dt>
                  <dd className="truncate text-[var(--v3-text-2)]">{partData.category}</dd>
                </div>
              ) : null}
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase text-[var(--v3-text-3)]">{t("search.stockHeading")}</dt>
                <dd className={`font-bold ${canAdd ? "text-[var(--v3-ok)]" : "text-[var(--v3-text-3)]"}`}>
                  {stock}
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              {priceBlock}
              <p className="mt-0.5 text-[11px] text-[var(--v3-text-3)] line-through">
                {t("price.mrp")} {formatPaise(listing?.mrpPaise)}
              </p>
            </div>
            <button
              type="button"
              disabled={!canAdd || addingId === listing?.id}
              onClick={() => listing && onAddToCart(listing.id, title)}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-3 text-xs font-bold text-white hover:bg-[#611029] disabled:opacity-50"
            >
              {canAdd ? t("product.addToCart") : t("price.onRequest")}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] transition hover:shadow-md">
      <button type="button" className="relative aspect-square w-full bg-[var(--v3-sunk)]" onClick={onOpen} aria-label={title}>
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
          className="line-clamp-2 text-left text-sm font-bold leading-snug text-[var(--v3-text)] hover:text-[var(--v3-brand-ink)]"
          onClick={onOpen}
        >
          <SearchHighlight text={title} query={query} />
        </button>
        {partData.brand ? <p className="mt-1 text-xs font-semibold text-[var(--v3-text-2)]">{partData.brand}</p> : null}
        {partData.part_number ? (
          <p className="mt-0.5 text-[11px] text-[var(--v3-text-3)]">
            {t("search.partNo")} {partData.part_number}
          </p>
        ) : null}
        {partData.category ? (
          <span className="mt-2 w-fit rounded-full bg-[var(--v3-sunk)] px-2 py-0.5 text-[10px] font-semibold text-[var(--v3-text-2)]">
            {partData.category}
          </span>
        ) : null}
        <div className="mt-auto pt-3">
          <p className={`text-[11px] font-bold ${canAdd ? "text-[var(--v3-ok)]" : "text-[var(--v3-text-3)]"}`}>{stock}</p>
          <div className="mt-1">{priceBlock}</div>
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-3 text-xs font-bold text-white hover:bg-[#611029] disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </div>
    </article>
  );
}
