"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { StorefrontProductCard } from "@/components/storefront-product-card";
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
  status?: string;
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

function ResultSkeletons() {
  return (
    <>
      <div className="mt-6 space-y-3 md:hidden" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="flex animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <div className="h-28 w-28 shrink-0 bg-slate-200" />
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="mt-auto h-10 w-full rounded-xl bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 hidden gap-4 md:grid md:grid-cols-2" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex gap-4">
              <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-2/3 rounded bg-slate-200" />
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-8 w-28 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">Loading</p>
    </>
  );
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
  const [addedId, setAddedId] = useState("");
  const [selectedPart, setSelectedPart] = useState<{ id?: string; partNumber?: string } | null>(
    null,
  );
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
  const fitmentContext = [model.make, model.model, fuel || variant || null]
    .filter(Boolean)
    .join(" · ");

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
        return;
      }
      if (response.ok) {
        setAddedId(listingId);
        window.setTimeout(() => setAddedId(""), 2000);
      }
    } finally {
      setAddingId("");
    }
  }

  function openPart(partData: SearchHit["document"]) {
    setSelectedPart({ id: partData?.id, partNumber: partData?.part_number });
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
        <div className="p-3.5 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 sm:text-xs">
            {model.make}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950 sm:mt-1 sm:text-3xl">
            {model.model}
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:mt-2 sm:text-sm">
            {t("fitment.compatibleParts")}
          </p>
          {(fuel || variant) ? (
            <p className="mt-2 inline-flex max-w-full truncate rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              {[fuel, variant].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:mt-6 sm:flex-wrap sm:overflow-visible">
        <button
          type="button"
          onClick={() => setFilter({})}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
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
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold capitalize ${
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
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
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
        <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ResultSkeletons />
      ) : found === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
          <h2 className="text-lg font-bold text-slate-900">{t("search.noneTitle")}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("search.none", { query: fitmentContext })}
          </p>
          <button
            type="button"
            onClick={() => setFilter({})}
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#7a1233] px-5 text-xs font-bold text-white"
          >
            {t("fitment.filterAll")}
          </button>
        </div>
      ) : (
        <>
          <h2 className="mt-5 text-base font-bold text-slate-950 sm:mt-8 sm:text-lg">
            {found === 1
              ? t("search.foundOne", { query: fitmentContext })
              : t("search.found", { count: found, query: fitmentContext })}
          </h2>

          {/* Mobile compact cards */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:hidden">
            {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              const imageSrc =
                hit.imageUrl ||
                listing?.imageUrl ||
                "/images/products/placeholder.svg";
              return (
                <StorefrontProductCard
                  key={partData.id || partData.part_number || index}
                  compact
                  name={partData.name || t("product.partFallback")}
                  brand={partData.brand}
                  partNumber={partData.part_number}
                  imageUrl={imageSrc}
                  application={fitmentContext}
                  badge={partData.category || null}
                  listing={
                    listing
                      ? {
                          id: listing.id,
                          dealerName: listing.dealerName,
                          pricePaise: listing.pricePaise,
                          listInclusivePaise: listing.listInclusivePaise,
                          netInclusivePaise: listing.netInclusivePaise,
                          discountPercent: listing.discountPercent,
                          gstRate: listing.gstRate,
                          stock: listing.stock,
                          status: listing.status ?? "active",
                          imageUrl: listing.imageUrl,
                        }
                      : null
                  }
                  adding={addingId === listing?.id}
                  justAdded={addedId === listing?.id}
                  onOpen={() => openPart(partData)}
                  onAdd={listing ? () => void addToCart(listing.id) : undefined}
                />
              );
            })}
          </div>

          {/* Desktop / tablet — existing layout preserved */}
          <div className="mt-4 hidden gap-4 md:grid md:grid-cols-2">
            {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              return (
                <article
                  key={partData.id || partData.part_number || index}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4"
                  onClick={() => openPart(partData)}
                >
                  <div className="flex gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
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
                    </div>
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
                            onClick={(event) => {
                              event.stopPropagation();
                              void addToCart(listing.id);
                            }}
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

      {selectedPart ? (
        <ProductDetailModal
          partId={selectedPart.id}
          partNumber={selectedPart.partNumber}
          onClose={() => setSelectedPart(null)}
        />
      ) : null}
      <p className="mt-8 text-sm">
        <Link href={`/vehicle-fitment/${model.makeSlug}`} className="font-semibold text-[#7a1233]">
          ← {model.make}
        </Link>
      </p>
    </div>
  );
}
