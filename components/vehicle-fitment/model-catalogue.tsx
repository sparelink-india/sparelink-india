"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { useI18n } from "@/components/preferences-provider";
import { VehicleModelImage } from "@/components/vehicle-fitment/vehicle-model-image";
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
      {/* ---- VEHICLE REFERENCE HEADER ----
          A 3:2 well on the left, the identity as a specification block on the
          right. Same well ratio as the model tiles on /vehicle-fitment/[make],
          so a vehicle looks identical wherever it appears in the catalogue. */}
      <div className="sl-panel">
        <div className="flex flex-col lg:flex-row">
          <div className="sl-panel-sunk relative aspect-[3/2] w-full shrink-0 overflow-hidden lg:w-[26rem]">
            {/* This is the only vehicle on the page and it sits above the fold,
                so it is the one image that is always preloaded. Everything else
                in the fitment catalogue is lazy. */}
            <VehicleModelImage
              model={model}
              priority
              sizes="(min-width: 1024px) 416px, 92vw"
              className="h-full w-full object-contain p-3"
            />
          </div>

          <dl className="flex min-w-0 flex-1 flex-col justify-center border-t border-[var(--sl-rule)] p-4 lg:border-l lg:border-t-0 lg:p-5">
            <div className="border-b border-[var(--sl-rule)] pb-3">
              <dt className="sl-metric-label flex items-center gap-2">
                <span
                  className="inline-block h-[3px] w-5 bg-[var(--sl-brand)]"
                  aria-hidden
                />
                {t("fitment.stepMake")}
              </dt>
              <dd className="sl-h3 mt-1.5">{model.make}</dd>
            </div>
            <div className="border-b border-[var(--sl-rule)] py-3">
              <dt className="sl-metric-label">{t("fitment.stepModel")}</dt>
              <dd>
                <h1 className="sl-display mt-1">{model.model}</h1>
              </dd>
            </div>
            <div className="pt-3">
              <dt className="sl-metric-label !text-[0.5625rem]">
                {t("fitment.compatibleParts")}
              </dt>
              <dd className="mt-1 flex items-baseline gap-2">
                {/* The count is whatever the search actually returned. It is
                    not shown while loading, so a transient 0 is never rendered
                    as "0 parts". */}
                {!loading ? (
                  <>
                    <span className="sl-num text-[1.5rem] font-extrabold leading-none text-[var(--sl-brand-ink)]">
                      {found}
                    </span>
                    <span className="sl-small">
                      {t("fitment.parts")}
                    </span>
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ---- RULED FILTER BAR ----
          One hairline-divided row, horizontally scrollable so a popular model
          with six variants does not wrap into three rows and push the parts
          list down. The active filter is marked by a burgundy left rule rather
          than a filled button. */}
      <div className="mt-4 border-y border-[var(--sl-rule)]">
        <div
          className="-mx-1 flex items-stretch overflow-x-auto px-1"
          role="group"
          aria-label={t("fitment.filters")}
        >
          <button
            type="button"
            onClick={() => setFilter({})}
            aria-pressed={!fuel && !variant}
            className={`sl-focus min-h-11 shrink-0 border-l-2 px-3 text-[0.8125rem] font-semibold transition-colors ${
              !fuel && !variant
                ? "border-[var(--sl-brand)] bg-[var(--sl-brand-soft)] text-[var(--sl-brand-ink)]"
                : "border-transparent text-[var(--sl-ink-2)] hover:bg-[var(--sl-sunken)]"
            }`}
          >
            {t("fitment.filterAll")}
          </button>
          {fuels.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter({ fuel: item || "" })}
              aria-pressed={fuel === item}
              className={`sl-focus min-h-11 shrink-0 border-l-2 px-3 text-[0.8125rem] font-semibold capitalize transition-colors ${
                fuel === item
                  ? "border-[var(--sl-brand)] bg-[var(--sl-brand-soft)] text-[var(--sl-brand-ink)]"
                  : "border-transparent text-[var(--sl-ink-2)] hover:bg-[var(--sl-sunken)]"
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
              aria-pressed={variant === item.label}
              className={`sl-focus min-h-11 shrink-0 border-l-2 px-3 text-[0.8125rem] font-semibold transition-colors ${
                variant === item.label
                  ? "border-[var(--sl-brand)] bg-[var(--sl-brand-soft)] text-[var(--sl-brand-ink)]"
                  : "border-transparent text-[var(--sl-ink-2)] hover:bg-[var(--sl-sunken)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p
          className="mt-4 border border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] px-3 py-2.5 text-[0.8125rem] font-semibold text-[var(--sl-bad)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        /* A shaped skeleton, not a bare "Searching..." sentence. It mirrors
           the two-column part grid below, so the layout does not jump when
           results arrive. */
        <div className="mt-6" role="status" aria-live="polite">
          <span className="sr-only">{t("search.searching")}</span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="sl-panel flex gap-3 p-3" aria-hidden="true">
                <div className="sl-skel h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="sl-skel h-3 w-full" />
                  <div className="sl-skel mt-2 h-3 w-2/3" />
                  <div className="sl-skel mt-3 h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 mt-5 flex items-baseline gap-3 border-b border-[var(--sl-rule)] pb-3">
            <span
              aria-hidden
              className="w-[3px] shrink-0 self-stretch bg-[var(--sl-brand)]"
            />
            <h2 className="sl-h2">
              {found === 1
                ? t("search.foundOne", { query: model.model })
                : t("search.found", { count: found, query: model.model })}
            </h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              return (
                <article
                  key={partData.id || partData.part_number || index}
                  className="sl-panel p-4 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
                >
                  <div className="flex gap-4">
                    <button
                      type="button"
                      className="sl-panel-sunk relative h-20 w-20 shrink-0 overflow-hidden sl-focus"
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
                      <h3 className="text-[0.9375rem] font-semibold leading-snug text-[var(--sl-ink)]">
                        {partData.name || t("product.partFallback")}
                      </h3>
                      <p className="sl-partno mt-1">
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
                            className="sl-btn sl-btn-primary sl-focus mt-2"
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
                        <p className="mt-2 text-xs text-[var(--sl-ink-3)]">{t("product.noListing")}</p>
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
