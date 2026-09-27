"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { EmptyState, Notice, StateIcons } from "@/components/page-states";
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
    <div className="sl-page flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="sl-container sl-container-wide sl-page-main flex-1">
        <StorefrontBreadcrumbs
          className="mb-4"
          crumbs={[
            { label: t("nav.home"), href: "/" },
            { label: t("nav.offers") },
          ]}
        />
        <h1 className="sl-type-page">{t("offers.title")}</h1>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {message ? <div className="mt-4"><Notice>{message}</Notice></div> : null}
        {offers.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={StateIcons.offers}
              title={t("offers.emptyTitle")}
              body={t("offers.empty")}
              action={{ href: "/", label: t("search.catalog") }}
              secondaryAction={{ href: "/offers", label: t("nav.brands") }}
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                <article key={`${offer.partId || offer.partNumber || index}`} className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex flex-col overflow-hidden">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--sl-surface-sunk)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={offer.thumbUrl || offer.imageUrl || "/images/products/placeholder.svg"}
                      alt={offer.name || "Offer product"}
                      width={640}
                      height={480}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain p-3"
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
                  <div className="flex flex-1 flex-col p-3.5">
                    {offer.partNumber ? (
                      <p className="sl-partno">
                        <span className="sr-only">Part number: </span>
                        {offer.partNumber}
                      </p>
                    ) : null}
                    <h2 className="sl-h3 mt-1 line-clamp-2">
                      {offer.name || t("offers.itemFallback")}
                    </h2>
                  {typeof regular === "number" && regular > 0 ? (
                    <p className="sl-price-strike mt-2">₹{(regular / 100).toLocaleString("en-IN")}</p>
                  ) : null}
                  {typeof special === "number" && special > 0 ? (
                    <p className="sl-price mt-0.5">₹{(special / 100).toLocaleString("en-IN")}</p>
                  ) : null}
                  {showDiscount ? (
                    <p className="sl-v2-badge sl-v2-badge-success mt-2 w-fit">
                      {t("offers.save", { amount: ((regular! - special!) / 100).toLocaleString("en-IN") })}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => void addToCart(offer)}
                      className="sl-v2-btn sl-v2-btn-primary w-full !min-h-11 !text-[0.8125rem]"
                    >
                      {t("product.addToCart")}
                    </button>
                    <Link
                      href={offer.partNumber ? `/?q=${encodeURIComponent(offer.partNumber)}` : "/"}
                      className="sl-v2-btn sl-v2-btn-secondary w-full !min-h-11 !text-[0.8125rem]"
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
    </div>
  );
}
