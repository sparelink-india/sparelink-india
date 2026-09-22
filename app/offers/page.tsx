"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { CatalogueProductImage } from "@/components/catalogue-product-image";
import { useI18n } from "@/components/preferences-provider";

type Offer = {
  partId?: string;
  partNumber?: string;
  name?: string;
  imageUrl?: string | null;
  regularPricePaise?: number | null;
  offerPricePaise?: number | null;
  listingId?: string | null;
};

export default function OffersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/offers", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setOffers(Array.isArray(data.offers) ? data.offers : []))
      .catch(() => setOffers([]));
  }, []);

  async function addToCart(offer: Offer) {
    if (!offer.listingId) {
      setError(t("offers.unlinked"));
      return;
    }
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerListingId: offer.listingId, quantity: 1 }),
    });
    const data = await response.json();
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setError(data.error || t("product.addFail"));
      return;
    }
    setMessage(t("offers.added"));
  }

  return (
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("offers.title")}</h1>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {offers.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            {t("offers.empty")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
            {offers.map((offer, index) => {
              const regular = offer.regularPricePaise;
              const special = offer.offerPricePaise;
              const showDiscount =
                typeof regular === "number" &&
                typeof special === "number" &&
                regular > 0 &&
                special > 0 &&
                special < regular;
              return (
                <article key={`${offer.partId || offer.partNumber || index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="aspect-[16/10] bg-slate-50 p-3">
                    <CatalogueProductImage
                      src={
                        offer.imageUrl ||
                        (offer.partNumber
                          ? `/images/products/${offer.partNumber}.svg`
                          : "/images/products/placeholder.svg")
                      }
                      alt={offer.name || "Offer product"}
                      size="thumb"
                      className="h-full w-full"
                    />
                  </div>
                  <div className="p-4">
                  {offer.partNumber ? <p className="font-mono text-xs text-slate-500">Part #{offer.partNumber}</p> : null}
                  <h2 className="mt-1 font-semibold">{offer.name || "Special offer product"}</h2>
                  {typeof regular === "number" && regular > 0 ? (
                    <p className="mt-1 text-sm text-slate-500 line-through">₹{(regular / 100).toLocaleString("en-IN")}</p>
                  ) : null}
                  {typeof special === "number" && special > 0 ? (
                    <p className="text-sm font-semibold">₹{(special / 100).toLocaleString("en-IN")}</p>
                  ) : null}
                  {showDiscount ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      {t("offers.save", { amount: ((regular! - special!) / 100).toLocaleString("en-IN") })}
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void addToCart(offer)}
                      className="min-h-11 flex-1 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {t("product.addToCart")}
                    </button>
                    <Link
                      href={offer.partNumber ? `/?q=${encodeURIComponent(offer.partNumber)}` : "/"}
                      className="inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-semibold"
                    >
                      {t("offers.details")}
                    </Link>
                  </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
