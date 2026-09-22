"use client";

import { InclusivePrice } from "@/components/inclusive-price";
import { useI18n } from "@/components/preferences-provider";
import { SearchHighlight } from "@/components/search-highlight";
import type { SearchHit, SearchListing } from "@/components/search-experience";
import type { MessageKey } from "@/lib/i18n";
import { displayProductTitle } from "@/lib/product-detail-fields";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

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
  layout?: "grid" | "list";
  /** Card index in the current page; first few stay eager for first paint. */
  index?: number;
  onOpen: () => void;
  onAddToCart: (listingId: string, name: string) => void;
}) {
  const { t } = useI18n();
  const partData = hit.document ?? {};
  const listing = hit.listings?.[0];
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
      <p className="text-sm font-extrabold text-slate-950">
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
    <p className="text-sm font-extrabold text-slate-800">{t("price.onRequest")}</p>
  );

  if (layout === "list") {
    return (
      <article className="flex min-w-0 flex-col gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:flex-row sm:px-4">
        <button type="button" className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-50" onClick={onOpen}>
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
          <button type="button" className="block w-full text-left text-sm font-bold text-slate-950 hover:text-[#7a1233]" onClick={onOpen}>
            <SearchHighlight text={title} query={query} />
          </button>
          <p className="mt-1 text-xs text-slate-500">
            {[partData.brand, partData.part_number ? `${t("search.partNo")} ${partData.part_number}` : ""]
              .filter(Boolean)
              .join(" | ")}
          </p>
          {partData.category ? (
            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {partData.category}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 flex-row items-end justify-between gap-2 sm:flex-col sm:items-end">
          <p className={`text-[11px] font-bold ${canAdd ? "text-emerald-700" : "text-slate-500"}`}>{stock}</p>
          {priceBlock}
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="min-h-9 rounded-lg bg-[#7a1233] px-3 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button type="button" className="relative aspect-square w-full bg-slate-50" onClick={onOpen} aria-label={title}>
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
          className="line-clamp-2 text-left text-sm font-bold leading-snug text-slate-950 hover:text-[#7a1233]"
          onClick={onOpen}
        >
          <SearchHighlight text={title} query={query} />
        </button>
        {partData.brand ? <p className="mt-1 text-xs font-semibold text-slate-600">{partData.brand}</p> : null}
        {partData.part_number ? (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {t("search.partNo")} {partData.part_number}
          </p>
        ) : null}
        {partData.category ? (
          <span className="mt-2 w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {partData.category}
          </span>
        ) : null}
        <div className="mt-auto pt-3">
          <p className={`text-[11px] font-bold ${canAdd ? "text-emerald-700" : "text-slate-500"}`}>{stock}</p>
          <div className="mt-1">{priceBlock}</div>
          <button
            type="button"
            disabled={!canAdd || addingId === listing?.id}
            onClick={() => listing && onAddToCart(listing.id, title)}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#7a1233] px-3 text-xs font-bold text-white hover:bg-[#611029] disabled:opacity-50"
          >
            {canAdd ? t("product.addToCart") : t("price.onRequest")}
          </button>
        </div>
      </div>
    </article>
  );
}
