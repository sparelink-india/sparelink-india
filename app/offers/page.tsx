"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("offers.title")}</h1>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {offers.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            {t("offers.empty")}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                <article key={`${offer.partId || offer.partNumber || index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={offer.imageUrl || "/images/products/placeholder.svg"}
                      alt={offer.name || "Offer product"}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).src = "/images/products/placeholder.svg";
                      }}
                    />
                  </div>
                  {offer.partNumber ? <p className="mt-3 font-mono text-xs text-slate-500">Part #{offer.partNumber}</p> : null}
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
                      className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {t("product.addToCart")}
                    </button>
                    <Link
                      href={offer.partNumber ? `/?q=${encodeURIComponent(offer.partNumber)}` : "/"}
                      className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    >
                      {t("offers.details")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
