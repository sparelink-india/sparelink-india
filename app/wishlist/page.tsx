/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { InclusivePrice } from "@/components/inclusive-price";
import {
  EmptyState,
  ErrorState,
  Notice,
  ProductGridSkeleton,
  StateIcons,
} from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";

type WishlistItem = {
  id: string;
  partId: string;
  partNumber: string | null;
  partName: string | null;
  listingId: string | null;
  pricePaise: number | null;
  listInclusivePaise?: number | null;
  netInclusivePaise?: number | null;
  discountPercent?: number | null;
  gstRate?: number | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
};

export default function WishlistPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadWishlist = useCallback(async () => {
    setError("");
    const response = await fetch("/api/wishlist", { cache: "no-store" });
    if (response.status === 401) {
      setNeedsLogin(true);
      setItems([]);
      setLoading(false);
      return;
    }
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || t("wishlist.loadFail"));
      setLoading(false);
      return;
    }
    setNeedsLogin(false);
    setItems(Array.isArray(data.items) ? data.items : []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  async function addToCart(item: WishlistItem) {
    if (!item.listingId) {
      setError(t("wishlist.unavailable"));
      return;
    }
    setError("");
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerListingId: item.listingId, quantity: 1 }),
    });
    const data = await response.json();
    if (response.status === 401) {
      setNeedsLogin(true);
      return;
    }
    if (!response.ok) {
      setError(data.error || t("product.addFail"));
      return;
    }
    setMessage(t("product.added", { name: item.partName || item.partNumber || "" }));
  }

  async function removeItem(item: WishlistItem) {
    const response = await fetch("/api/wishlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || t("wishlist.removeFail"));
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">
      <StorefrontHeader />
      <main className="sl-container sl-page-main flex-1">
        {/* Page header with a live count, so the state of the list is stated
            before the grid rather than inferred from it. */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--sl-rule)] pb-5">
          <div className="min-w-0">
            <p className="sl-eyebrow">{t("nav.account")}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h1 className="sl-display">{t("wishlist.title")}</h1>
              {items.length > 0 ? (
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="sl-num text-[1.25rem] font-extrabold leading-none text-[var(--sl-brand-ink)]">
                    {items.length}
                  </span>
                  <span className="sl-micro font-bold uppercase tracking-[var(--sl-track-caps)]">
                    {t("wishlist.title")}
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          {!loading && !needsLogin && items.length > 0 ? (
            <span className="sl-badge sl-badge-brand">
              {items.length} {items.length === 1 ? t("wishlist.item") : t("wishlist.items")}
            </span>
          ) : null}
        </div>

        {loading ? <ProductGridSkeleton count={4} /> : null}

        {needsLogin ? (
          <div className="mt-7">
            <EmptyState
              icon={StateIcons.wishlist}
              title={t("wishlist.loginTitle")}
              body={t("wishlist.login")}
              action={{ href: "/login", label: t("nav.login") }}
              secondaryAction={{ href: "/", label: t("search.catalog") }}
            />
          </div>
        ) : null}

        {error ? (
          <div className="mt-7">
            <ErrorState
              title={t("common.error")}
              body={error}
              onRetry={() => void loadWishlist()}
            />
          </div>
        ) : null}

        {message ? (
          <div className="mt-7">
            <Notice>{message}</Notice>
          </div>
        ) : null}

        {!loading && !needsLogin && items.length === 0 ? (
          <div className="mt-7">
            <EmptyState
              icon={StateIcons.wishlist}
              title={t("wishlist.emptyTitle")}
              body={t("wishlist.empty")}
              action={{ href: "/", label: t("search.catalog") }}
            />
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="sl-panel flex flex-col overflow-hidden transition-[box-shadow,transform] duration-150 ease-[var(--sl-ease)] hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)] focus-within:shadow-[var(--sl-e-3)]"
            >
              {/* Catalogue presentation: `object-contain` on a clean stage.
                  The previous version used `object-cover`, which cropped parts
                  out of frame. */}
              <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbUrl || item.imageUrl || "/images/products/placeholder.svg"}
                  alt={item.partName || "Part"}
                  width={640}
                  height={480}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain p-3"
                  onError={(event) => {
                    const el = event.currentTarget as HTMLImageElement;
                    if (item.imageUrl && el.src !== item.imageUrl) {
                      el.src = item.imageUrl;
                      return;
                    }
                    el.src = "/images/products/placeholder.svg";
                  }}
                />
              </div>

              <div className="flex flex-1 flex-col p-3.5">
                {item.partNumber ? (
                  <p className="sl-part sl-wrap-any">
                    <span className="sr-only">{t("partNo.srLabel")}</span>
                    {item.partNumber}
                  </p>
                ) : null}
                <h2 className="sl-clamp-2 mt-1 text-[0.9375rem] font-bold leading-snug text-[var(--sl-ink)]">
                  {item.partName || t("product.partFallback")}
                </h2>

                <div className="mt-2">
                  {item.pricePaise != null && item.pricePaise > 0 ? (
                    <InclusivePrice
                      align="left"
                      pricePaise={item.pricePaise}
                      listInclusivePaise={item.listInclusivePaise ?? item.pricePaise}
                      netInclusivePaise={item.netInclusivePaise ?? item.pricePaise}
                      discountPercent={item.discountPercent ?? 0}
                      gstRate={item.gstRate}
                    />
                  ) : (
                    <p className="sl-meta">{t("product.priceCheckout")}</p>
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-3.5">
                  <button
                    type="button"
                    onClick={() => void addToCart(item)}
                    disabled={!item.listingId}
                    className="sl-btn sl-btn-primary sl-btn-block"
                  >
                    {t("product.addToCart")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeItem(item)}
                    className="sl-btn sl-btn-ghost sl-btn-block hover:border-[var(--sl-bad-line)] hover:bg-[var(--sl-bad-soft)] hover:text-[var(--sl-bad)]"
                  >
                    {t("cart.remove")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
