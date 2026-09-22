"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { InclusivePrice } from "@/components/inclusive-price";
import { ProductDetailModal } from "@/components/product-detail-modal";
import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n/messages";
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
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  sku?: string | null;
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
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  listings?: Listing[];
};

export type CategoryBrowseQuery = {
  storefrontSlug?: string;
  categoryName?: string | null;
  nameContains?: string | null;
  otherType?: "cables" | "filters" | null;
  segment?: string | null;
};

export type CategoryCrumb = { label: string; href: string; key?: MessageKey };

function buildSearchUrl(browse: CategoryBrowseQuery, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    perPage: "24",
  });
  if (browse.storefrontSlug) params.set("category", browse.storefrontSlug);
  if (browse.categoryName) params.set("categoryName", browse.categoryName);
  if (browse.nameContains) params.set("nameContains", browse.nameContains);
  if (browse.otherType) params.set("otherType", browse.otherType);
  if (browse.segment) params.set("segment", browse.segment);
  return `/api/search/parts?${params.toString()}`;
}

export function CategoryResults({
  path,
  title,
  titleKey,
  description,
  descriptionKey,
  image,
  browse,
  crumbs,
}: {
  path: string;
  title: string;
  titleKey?: MessageKey;
  description?: string;
  descriptionKey?: MessageKey;
  image?: string | null;
  browse: CategoryBrowseQuery;
  crumbs: CategoryCrumb[];
}) {
  const { t } = useI18n();
  const heading = titleKey ? t(titleKey) : title;
  const summary = descriptionKey ? t(descriptionKey) : description;
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedPage = Number(searchParams.get("page") || "1");
  const activePage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const [payload, setPayload] = useState<{
    url: string;
    results: SearchHit[];
    found: number;
    error: string;
  } | null>(null);
  const [addingId, setAddingId] = useState("");
  const [detailTarget, setDetailTarget] = useState<{ partId?: string; sku?: string } | null>(null);
  const pagedUrl = buildSearchUrl(browse, activePage);
  const loading = payload?.url !== pagedUrl;
  const results = payload?.url === pagedUrl ? payload.results : [];
  const found = payload?.url === pagedUrl ? payload.found : 0;
  const error = payload?.url === pagedUrl ? payload.error : "";
  const totalPages = Math.max(1, Math.ceil(found / 24));

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [path, activePage]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(pagedUrl, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setPayload({
          url: pagedUrl,
          results: Array.isArray(data?.results) ? data.results : [],
          found: typeof data?.found === "number" ? data.found : 0,
          error: "",
        });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setPayload({
          url: pagedUrl,
          results: [],
          found: 0,
          error: t("search.failed"),
        });
      });
    return () => controller.abort();
  }, [pagedUrl, t]);

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

  function goToPage(nextPage: number) {
    router.replace(nextPage > 1 ? `${path}?page=${nextPage}` : path);
  }

  return (
    <div>
      <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.href}-${index}`}>
            {index > 0 ? " / " : null}
            {index === crumbs.length - 1 ? (
              <span className="text-slate-800">{crumb.key ? t(crumb.key) : crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:underline">
                {crumb.key ? t(crumb.key) : crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-4 p-5">
          {image ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={heading}
                width={128}
                height={128}
                className="h-full w-full object-contain p-1.5"
              />
            </div>
          ) : null}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{heading}</h1>
            {summary ? <p className="mt-1 text-sm text-slate-600">{summary}</p> : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">{t("search.searching")}</p>
      ) : found === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-bold text-slate-900">{t("category.empty")}</h2>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-10 items-center rounded-xl bg-[#7a1233] px-5 text-xs font-bold text-white"
          >
            {t("category.searchAll")}
          </Link>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-bold text-slate-950">
            {found === 1
              ? t("search.foundOne", { query: heading })
              : t("search.found", { count: found, query: heading })}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {results.map((hit, index) => {
              const partData = hit.document ?? {};
              const listing = hit.listings?.[0];
              return (
                <article
                  key={partData.id || partData.part_number || index}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <button
                      type="button"
                      className="h-[160px] w-[160px] shrink-0 overflow-hidden rounded-xl bg-slate-100 min-[430px]:h-[168px] min-[430px]:w-[168px] md:h-[240px] md:w-[250px]"
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
                          hit.thumbUrl ||
                          listing?.thumbUrl ||
                          hit.imageUrl ||
                          listing?.imageUrl ||
                          "/images/products/placeholder.svg"
                        }
                        alt={partData.name || t("product.partFallback")}
                        width={250}
                        height={240}
                        loading={index < 4 ? "eager" : "lazy"}
                        decoding="async"
                        className="h-full w-full object-contain p-2"
                        onError={(event) => {
                          const el = event.currentTarget as HTMLImageElement;
                          const original = hit.imageUrl || listing?.imageUrl;
                          if (original && el.src !== original) {
                            el.src = original;
                            return;
                          }
                          el.src = "/images/products/placeholder.svg";
                        }}
                      />
                    </button>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="line-clamp-3 break-words font-bold leading-snug text-slate-950">
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
                              : (listing.stock ?? 0) <= 0
                                ? t("product.outOfStock")
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
          {totalPages > 1 ? (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => goToPage(activePage - 1)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold disabled:opacity-40"
              >
                {t("search.prev")}
              </button>
              <p className="text-sm text-slate-600">
                {t("search.page", { page: activePage, pages: totalPages })}
              </p>
              <button
                type="button"
                disabled={activePage >= totalPages}
                onClick={() => goToPage(activePage + 1)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold disabled:opacity-40"
              >
                {t("search.next")}
              </button>
            </div>
          ) : null}
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
