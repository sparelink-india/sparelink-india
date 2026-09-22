/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { InclusivePrice } from "@/components/inclusive-price";
import { CatalogueProductImage } from "@/components/catalogue-product-image";
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
};

export default function WishlistPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadWishlist() {
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
  }

  useEffect(() => {
    void loadWishlist();
  }, []);

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
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("wishlist.title")}</h1>
        {loading ? <p className="mt-6 text-sm text-slate-500">{t("wishlist.loading")}</p> : null}
        {needsLogin ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-600">{t("wishlist.login")}</p>
            <Link href="/login" className="mt-4 inline-flex rounded-xl bg-[#7a1233] px-5 py-2.5 text-sm font-semibold text-white">
              {t("nav.login")}
            </Link>
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {!loading && !needsLogin && items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            {t("wishlist.empty")}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
          {items.map((item) => (
            <article key={item.id} className="flex gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:block sm:p-4">
              <div className="h-28 w-28 shrink-0 bg-slate-50 p-2 sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-xl sm:p-0">
                <CatalogueProductImage
                  src={item.partNumber ? `/images/products/${item.partNumber}.svg` : "/images/products/placeholder.svg"}
                  alt={item.partName || "Part"}
                  size="thumb"
                  className="h-full w-full"
                />
              </div>
              <div className="min-w-0 flex-1 p-3 sm:p-0 sm:pt-3">
              {item.partNumber ? <p className="font-mono text-xs text-slate-500">Part #{item.partNumber}</p> : null}
              <h2 className="mt-1 line-clamp-2 font-semibold">{item.partName || t("product.partFallback")}</h2>
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
                <p className="mt-1 text-sm text-slate-500">{t("product.priceCheckout")}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void addToCart(item)}
                  className="min-h-11 flex-1 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                >
                  {t("product.addToCart")}
                </button>
                <button
                  type="button"
                  onClick={() => void removeItem(item)}
                  className="min-h-11 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
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
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
