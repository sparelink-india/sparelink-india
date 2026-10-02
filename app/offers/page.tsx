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
  thumbUrl?: string | null;
  mediumUrl?: string | null;
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
    <div className="flex min-h-screen flex-col bg-[var(--v3-sunk)]">
      <StorefrontHeader />
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--v3-text)]">{t("offers.title")}</h1>
        {error ? <p className="mt-4 text-sm text-[var(--v3-bad)]">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-[var(--v3-ok)]">{message}</p> : null}
        {offers.length === 0 ? (
          <p className="mt-8 rounded-[var(--v3-r)] border border-dashed border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] p-10 text-center text-sm text-[var(--v3-text-2)]">
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
                <article key={`${offer.partId || offer.partNumber || index}`} className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-4">
                  <div className="aspect-[4/3] overflow-hidden rounded-[var(--v3-r)] bg-[var(--v3-sunk)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={offer.thumbUrl || offer.imageUrl || "/images/products/placeholder.svg"}
                      alt={offer.name || "Offer product"}
                      width={640}
                      height={480}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        const el = event.currentTarget as HTMLImageElement;
                        if (offer.imageUrl && el.src !== offer.imageUrl) {
                          el.src = offer.imageUrl;
                          return;
                        }
                        el.src = "/images/products/placeholder.svg";
                      }}
                    />
                  </div>
                  {offer.partNumber ? <p className="mt-3 font-mono text-xs text-[var(--v3-text-3)]">Part #{offer.partNumber}</p> : null}
                  <h2 className="mt-1 font-semibold">{offer.name || "Special offer product"}</h2>
                  {typeof regular === "number" && regular > 0 ? (
                    <p className="mt-1 text-sm text-[var(--v3-text-3)] line-through">₹{(regular / 100).toLocaleString("en-IN")}</p>
                  ) : null}
                  {typeof special === "number" && special > 0 ? (
                    <p className="text-sm font-semibold">₹{(special / 100).toLocaleString("en-IN")}</p>
                  ) : null}
                  {showDiscount ? (
                    <p className="text-xs font-semibold text-[var(--v3-ok)]">
                      {t("offers.save", { amount: ((regular! - special!) / 100).toLocaleString("en-IN") })}
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void addToCart(offer)}
                      className="rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-3 py-2 text-sm font-semibold text-white"
                    >
                      {t("product.addToCart")}
                    </button>
                    <Link
                      href={offer.partNumber ? `/?q=${encodeURIComponent(offer.partNumber)}` : "/"}
                      className="rounded-[var(--v3-r)] border px-3 py-2 text-sm font-semibold"
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
