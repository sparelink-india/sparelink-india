"use client";

/**
 * The LIST view for a catalogue listing.
 *
 * Extracted from `search-experience.tsx` so the search results page and the
 * category pages render the same dense table instead of two tables that drift
 * apart. It is the same markup that shipped before, unchanged: a fixed-layout
 * table with a 920px minimum width, which is why it is only ever used at
 * `md` and up. Below that the switcher stays available but this view falls back
 * to the card layouts, because a 920px table on a phone is exactly the
 * horizontal overflow the requirements forbid.
 */

import { useI18n } from "@/components/preferences-provider";
import { SearchHighlight } from "@/components/search-highlight";
import { displayProductTitle } from "@/lib/product-detail-fields";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";
import type { SearchHit, SearchListing } from "@/components/search-experience";

function formatPaise(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `₹${(value / 100).toLocaleString("en-IN")}`
    : "—";
}

function listPrice(listing: SearchListing | undefined) {
  const value = listing?.listInclusivePaise ?? listing?.pricePaise;
  return typeof value === "number" && value > 0 ? value : null;
}

function TableCartIcon({ className = "h-4 w-4" }: { className?: string }) {
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

export function CatalogueProductTable({
  results,
  query,
  addingId,
  onOpenProduct,
  onAddToCart,
}: {
  results: SearchHit[];
  query: string;
  addingId: string;
  onOpenProduct: (hit: SearchHit) => void;
  onAddToCart: (listingId: string, name: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto rounded-[var(--v3-r-lg)] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
        <thead className="bg-[var(--v3-brand)] text-sm font-bold text-white">
          <tr>
            <th className="w-[38%] px-3 py-2.5">{t("search.itemName")}</th>
            <th className="w-[13%] px-3 py-2.5">{t("search.partNoShort")}</th>
            <th className="w-[7%] px-3 py-2.5">GST</th>
            <th className="w-[11%] px-3 py-2.5">HSN</th>
            <th className="w-[10%] px-3 py-2.5">LIST</th>
            <th className="w-[10%] px-3 py-2.5">MRP</th>
            <th className="w-[7%] px-3 py-2.5">DISC</th>
            <th className="w-[10%] px-3 py-2.5 text-right">{t("search.actionColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((hit, index) => {
            const partData = hit.document ?? {};
            const listing = selectPreferredStorefrontListing(hit.listings);
            const title = displayProductTitle(
              partData.name || t("product.partFallback"),
              partData.part_number,
            );
            const image =
              hit.thumbUrl ||
              listing?.thumbUrl ||
              hit.imageUrl ||
              listing?.imageUrl ||
              "/images/products/placeholder.svg";
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
            return (
              <tr
                key={hit.document?.id || hit.document?.part_number || index}
                className="border-t border-[var(--v3-rule)] align-middle hover:bg-[var(--v3-sunk)]/70"
              >
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenProduct(hit)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-[var(--v3-brand)]"
                      aria-label={title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt=""
                        width={40}
                        height={40}
                        loading={index < 4 ? "eager" : "lazy"}
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
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm font-bold leading-tight text-[var(--v3-text)] hover:text-[var(--v3-brand-ink)]"
                      onClick={() => onOpenProduct(hit)}
                      title={title}
                    >
                      <SearchHighlight text={title} query={query} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--v3-text-2)]">
                  <span className="text-sm font-semibold text-slate-800">{partData.part_number || "—"}</span>
                </td>
                <td className="px-3 py-2 text-xs text-[var(--v3-text-2)]">
                  {listing?.gstRate != null ? `${listing.gstRate}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--v3-text-2)]">
                  {listing?.hsn || "—"}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                  {formatPaise(listPrice(listing))}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--v3-text-3)]">
                  {formatPaise(listing?.mrpPaise)}
                </td>
                <td className="px-3 py-2 text-sm font-semibold text-slate-800">
                  <span className="rounded-md bg-[var(--v3-brand)] px-1.5 py-0.5 text-xs font-bold text-white">
                    {typeof listing?.discountPercent === "number"
                      ? `${Math.round(listing.discountPercent)}%`
                      : "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={!canAdd || addingId === listing?.id}
                    onClick={() => listing && onAddToCart(listing.id, title)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[2px] bg-[var(--v3-brand)] px-3 text-xs font-bold text-white hover:bg-[var(--v3-brand-hover)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-[var(--v3-text-3)]"
                    aria-label={`${t("product.addToCart")}: ${title}`}
                  >
                    {canAdd ? (
                      <>
                        <TableCartIcon />
                        {t("product.addToCart")}
                      </>
                    ) : priced ? (
                      t("product.outOfStock")
                    ) : (
                      t("price.onRequest")
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
