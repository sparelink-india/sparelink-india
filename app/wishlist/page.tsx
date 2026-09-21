/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { InclusivePrice } from "@/components/inclusive-price";
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl || "/images/products/placeholder.svg"}
                  alt={item.partName || "Part"}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).src = "/images/products/placeholder.svg";
                  }}
                />
              </div>
              {item.partNumber ? <p className="mt-3 font-mono text-xs text-slate-500">Part #{item.partNumber}</p> : null}
              <h2 className="mt-1 font-semibold">{item.partName || t("product.partFallback")}</h2>
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
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void addToCart(item)}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                >
                  {t("product.addToCart")}
                </button>
                <button
                  type="button"
                  onClick={() => void removeItem(item)}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                >
                  {t("cart.remove")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
