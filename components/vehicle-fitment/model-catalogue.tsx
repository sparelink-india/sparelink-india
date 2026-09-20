"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { useI18n } from "@/components/preferences-provider";
import type { FitmentModel } from "@/lib/vehicle-fitment";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

type Listing = {
  id: string;
  dealerName: string;
  pricePaise: number;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  gstRate?: number | null;
  stock: number | null;
  sku?: string | null;
  imageUrl?: string | null;
};

type SearchHit = {
  document?: {
    id?: string;
    part_number?: string;
    name?: string;
    brand?: string;
    category?: string;
  };
  imageUrl?: string | null;
  listings?: Listing[];
};

function searchUrl(model: FitmentModel, fuel: string, variant: string, page: number) {
  const params = new URLSearchParams({
    make: model.makeSlug,
    model: model.modelSlug,
    page: String(page),
    perPage: "24",
  });
  if (fuel) params.set("fuel", fuel);
  if (variant) params.set("variant", variant);
  return `/api/search/parts?${params.toString()}`;
}

export function FitmentModelCatalogue({
  model,
  fuel = "",
  variant = "",
  page = 1,
}: {
  model: FitmentModel;
  fuel?: string;
  variant?: string;
  page?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const requestUrl = searchUrl(model, fuel, variant, page);
  const [payload, setPayload] = useState<{
    url: string;
    results: SearchHit[];
    found: number;
    error: string;
  } | null>(null);
  const [addingId, setAddingId] = useState("");
  const [detailTarget, setDetailTarget] = useState<{ partId?: string; sku?: string } | null>(null);
  const loading = payload?.url !== requestUrl;
  const results = payload?.url === requestUrl ? payload.results : [];
  const found = payload?.url === requestUrl ? payload.found : 0;
  const error = payload?.url === requestUrl ? payload.error : "";

  useEffect(() => {
    const controller = new AbortController();
    void fetch(requestUrl, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setPayload({
          url: requestUrl,
          results: Array.isArray(data?.results) ? data.results : [],
          found: typeof data?.found === "number" ? data.found : 0,
          error: "",
        });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setPayload({
          url: requestUrl,
          results: [],
          found: 0,
          error: t("search.failed"),
        });
      });
    return () => controller.abort();
  }, [requestUrl, t]);

  const fuels = [...new Set(model.variants.map((item) => item.fuel).filter(Boolean))];
  const path = `/vehicle-fitment/${model.makeSlug}/${model.modelSlug}`;

  function setFilter(next: { fuel?: string; variant?: string }) {
    const params = new URLSearchParams();
    if (next.fuel) params.set("fuel", next.fuel);
    if (next.variant) params.set("variant", next.variant);
    const href = params.toString() ? `${path}?${params.toString()}` : path;
    router.replace(href, { scroll: false });
  }

  async function addToCart(listingId: string) {
    setAddingId(listingId);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerListingId: listingId, quantity: 1 }),
      });
      if (response.status === 401) {
        router.push("/login");
      }
    } finally {
      setAddingId("");
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="aspect-[21/9] bg-slate-100 sm:aspect-[21/8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={model.photo || "/images/vehicles/placeholder.svg"}
            alt={model.photo ? model.model : `${model.model} photo unavailable`}
            width={1200}
            height={514}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            {model.make}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {model.model}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{t("fitment.compatibleParts")}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter({})}
          className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
            !fuel && !variant
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {t("fitment.filterAll")}
        </button>
        {fuels.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter({ fuel: item || "" })}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold capitalize ${
              fuel === item
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {item ? item.charAt(0).toUpperCase() + item.slice(1) : item}
          </button>
        ))}
        {model.variants.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter({ variant: item.label })}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
              variant === item.label
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-6 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">{t("search.searching")}</p>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-bold text-slate-950">
            {found === 1
              ? t("search.foundOne", { query: model.model })
              : t("search.found", { count: found, query: model.model })}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              return (
                <article
                  key={partData.id || partData.part_number || index}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex gap-4">
                    <button
                      type="button"
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                      onClick={() =>
                        setDetailTarget({
                          partId: partData.id,
                          sku: listing?.sku || partData.part_number,
                        })
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          hit.imageUrl ||
                          listing?.imageUrl ||
                          "/images/products/placeholder.svg"
                        }
                        alt={partData.name || t("product.partFallback")}
                        className="h-full w-full object-contain p-1"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-950">
                        {partData.name || t("product.partFallback")}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {[partData.brand, partData.part_number].filter(Boolean).join(" · ")}
                      </p>
                      {listing ? (
                        <div className="mt-2">
                          <InclusivePrice
                            pricePaise={listing.pricePaise}
                            listInclusivePaise={listing.listInclusivePaise}
                            netInclusivePaise={listing.netInclusivePaise}
                            discountPercent={listing.discountPercent}
                            gstRate={listing.gstRate}
                            align="left"
                          />
                          <button
                            type="button"
                            disabled={
                              addingId === listing.id ||
                              (listing.stock ?? 0) <= 0 ||
                              !isAuthoritativeSellingPricePaise(
                                listing.listInclusivePaise,
                                listing.netInclusivePaise,
                                listing.pricePaise,
                              )
                            }
                            onClick={() => void addToCart(listing.id)}
                            className="mt-2 min-h-10 rounded-lg bg-[#7a1233] px-3 text-xs font-bold text-white disabled:opacity-50"
                          >
                            {!isAuthoritativeSellingPricePaise(
                              listing.listInclusivePaise,
                              listing.netInclusivePaise,
                              listing.pricePaise,
                            )
                              ? t("price.onRequest")
                              : t("product.addToCart")}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">{t("product.noListing")}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <ProductDetailModal
        open={Boolean(detailTarget)}
        partId={detailTarget?.partId}
        sku={detailTarget?.sku}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
}
