"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InclusivePrice } from "@/components/inclusive-price";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppIcon } from "@/components/whatsapp-cta";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { pushRecentlyViewed } from "@/lib/recently-viewed";
import { CatalogueProductImage } from "@/components/catalogue-product-image";

export type ProductDetailListing = {
  id: string;
  dealerName: string;
  firmName?: string | null;
  sku?: string | null;
  pricePaise: number;
  mrpPaise?: number | null;
  status: string;
  stock: number | null;
  gstRate?: number | null;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  isPensol?: boolean;
  pensolCashNetInclusivePaise?: number | null;
  pensolCreditNetInclusivePaise?: number | null;
};

export type ProductDetailPayload = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string;
  oemNumbers: string[];
  referenceNumbers: string[];
  application: string;
  compatibilityLines: string[];
  vehicles: { make: string; model: string; variant: string | null }[];
  features: string[];
  specificationRows: { label: string; value: string }[];
  moreInformation: {
    sourceUrl: string;
    source: string;
    fulfilledBy: string;
    subcategory: string;
  };
  imageUrls: string[];
  listings: ProductDetailListing[];
};

type TabId = "features" | "specs" | "fitment" | "more";

function rupees(paise: number) {
  return (paise / 100).toLocaleString("en-IN");
}

function listingPriced(listing: ProductDetailListing) {
  return isAuthoritativeSellingPricePaise(
    listing.listInclusivePaise,
    listing.netInclusivePaise,
    listing.pricePaise,
    listing.pensolCashNetInclusivePaise,
    listing.pensolCreditNetInclusivePaise,
  );
}

export function ProductDetailModal({
  partId,
  partNumber,
  onClose,
  onCartChange,
  onWishlistChange,
}: {
  partId?: string;
  partNumber?: string;
  onClose: () => void;
  onCartChange?: (delta: number) => void;
  onWishlistChange?: (delta: number) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [detail, setDetail] = useState<ProductDetailPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [tab, setTab] = useState<TabId>("features");
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);
  const [wishSaved, setWishSaved] = useState(false);
  const [fitmentOpen, setFitmentOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (partId) params.set("partId", partId);
    else if (partNumber) params.set("partNumber", partNumber);
    else return;
    const controller = new AbortController();
    void fetch(`/api/catalogue/product-detail?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as ProductDetailPayload & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load product");
        setDetail(data);
        setImageIndex(0);
        setQty(1);
        setError("");
        pushRecentlyViewed({
          id: data.id,
          partNumber: data.partNumber,
          name: data.name,
          brand: data.brand,
          imageUrl: data.imageUrls?.[0] ?? null,
        });
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Unable to load product");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [partId, partNumber]);

  const images = detail?.imageUrls?.length
    ? detail.imageUrls
    : ["/images/products/placeholder.svg"];
  const listing = detail?.listings?.[0] ?? null;
  const stock = listing?.stock ?? 0;
  const priced = listing ? listingPriced(listing) : false;
  const inStock = Boolean(listing && listing.status === "active" && stock > 0);
  const canBuy = Boolean(listing && inStock && priced);
  const maxQty = Math.max(1, stock || 1);

  const setImage = useCallback(
    (next: number) => {
      setZoomed(false);
      setImageIndex((next + images.length) % images.length);
    },
    [images.length],
  );

  async function addToCart() {
    if (!listing || !canBuy) return;
    setAdding(true);
    setMessage("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerListingId: listing.id, quantity: qty }),
      });
      const data = (await response.json()) as { error?: string };
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.error || t("product.addFail"));
      setAdded(true);
      onCartChange?.(qty);
      setMessage(t("product.added", { name: detail?.name || t("product.partFallback") }));
      setTimeout(() => setAdded(false), 2500);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t("product.addFail"));
    } finally {
      setAdding(false);
    }
  }

  async function addWishlist() {
    if (!detail?.id) return;
    setWishBusy(true);
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: detail.id }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error("Wishlist failed");
      if (!wishSaved) onWishlistChange?.(1);
      setWishSaved(true);
    } catch {
      setMessage("Unable to update wishlist.");
    } finally {
      setWishBusy(false);
    }
  }

  const waHref = detail
    ? getWhatsAppChatUrl(
        [
          `Hello Sparelink India, I want to enquire about ${detail.brand || "this part"} ${detail.name} (Part No. ${detail.partNumber}).`,
          detail.moreInformation?.sourceUrl ? `Product: ${detail.moreInformation.sourceUrl}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
    : null;
  const titleId = "product-detail-title";
  const fitment = detail?.compatibilityLines ?? [];
  const visibleFitment = fitmentOpen ? fitment : fitment.slice(0, 8);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start">
            <span className="inline-flex shrink-0 items-center rounded-xl bg-[#7a1233] px-4 py-2 font-mono text-xl font-extrabold tracking-wide text-white sm:text-2xl">
              {detail?.partNumber || partNumber || "—"}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-extrabold leading-tight text-slate-950 sm:text-2xl lg:text-3xl">
                {loading ? "Loading product…" : detail?.name || t("product.partFallback")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {[detail?.category, detail?.subcategory].filter(Boolean).join(" / ") || "—"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {detail?.brand ? (
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Brand</p>
                  <p className="text-sm font-extrabold text-[#7a1233]">{detail.brand}</p>
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  <span className={`h-2 w-2 rounded-full ${inStock && priced ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {inStock && priced ? "In Stock" : priced ? t("product.outOfStock") : t("price.onRequest")}
                </p>
                <p className="text-xs text-slate-500">
                  {inStock && priced ? "Ready to Dispatch" : priced ? "Stock not available" : "Price on request"}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="p-6 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : (
            <>
              <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:p-6">
                <div className="flex gap-3">
                  {images.length > 1 ? (
                    <div className="hidden w-16 shrink-0 flex-col gap-2 sm:flex">
                      {images.map((src, index) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setImage(index)}
                          className={`overflow-hidden rounded-lg border-2 bg-slate-50 ${
                            index === imageIndex ? "border-[#7a1233]" : "border-transparent"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" className="h-14 w-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="relative min-h-[280px] flex-1 rounded-xl bg-[#f4f6f8] sm:min-h-[420px]">
                    <CatalogueProductImage
                      src={images[imageIndex]}
                      alt={detail?.name || ""}
                      size="medium"
                      className="mx-auto h-full max-h-[52vh] w-full"
                      imgClassName={`mx-auto h-full max-h-[52vh] w-full object-contain p-4 ${zoomed ? "scale-125" : ""}`}
                    />
                    {images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-lg shadow"
                          onClick={() => setImage(imageIndex - 1)}
                          aria-label="Previous image"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white/90 text-lg shadow"
                          onClick={() => setImage(imageIndex + 1)}
                          aria-label="Next image"
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                      {imageIndex + 1} / {images.length}
                    </span>
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setZoomed((value) => !value)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow"
                      >
                        Zoom
                      </button>
                      <button
                        type="button"
                        disabled
                        title="360° images are not available for this product"
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-400"
                      >
                        360° View
                      </button>
                      <a
                        href={images[imageIndex]}
                        download
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow"
                      >
                        Download Image
                      </a>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-extrabold text-slate-950">Product Description</h3>
                  <div className="mt-3 max-h-40 overflow-y-auto text-sm leading-relaxed text-slate-700 sm:max-h-48 sm:text-base">
                    {detail?.description || "Information not available"}
                  </div>
                  <div className="mt-5 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:grid-cols-3">
                    <InfoCell label="Brand" value={detail?.brand} />
                    <InfoCell label="Part No." value={detail?.partNumber} />
                    <InfoCell label="Category" value={detail?.category} />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <ListCard title="OEM Part No." values={detail?.oemNumbers ?? []} />
                    <ListCard title="Reference Nos." values={detail?.referenceNumbers ?? []} />
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">Compatibility</h4>
                    {visibleFitment.length ? (
                      <ul className="mt-3 space-y-1.5">
                        {visibleFitment.map((line) => (
                          <li key={line} className="flex gap-2 text-sm text-slate-700">
                            <span className="font-bold text-emerald-600">✓</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Information not available</p>
                    )}
                    {fitment.length > 8 ? (
                      <button
                        type="button"
                        className="mt-3 text-sm font-semibold text-[#7a1233]"
                        onClick={() => setFitmentOpen((value) => !value)}
                      >
                        {fitmentOpen ? "Show less" : "View all"}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">MRP</p>
                      <p className="text-sm font-bold text-slate-800">
                        {listing?.mrpPaise ? `₹${rupees(listing.mrpPaise)}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">Our Price</p>
                      {listing && priced ? (
                        <InclusivePrice
                          pricePaise={listing.pricePaise}
                          listInclusivePaise={listing.listInclusivePaise}
                          netInclusivePaise={listing.netInclusivePaise}
                          discountPercent={listing.discountPercent}
                          gstRate={listing.gstRate}
                          align="left"
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-800">{t("price.onRequest")}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase text-slate-500">Stock Status</p>
                      <p className="text-sm font-bold text-slate-800">
                        {inStock ? t("product.inStock", { count: stock }) : t("product.outOfStock")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 max-md:hidden">
                    <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200">
                      <button
                        type="button"
                        className="h-12 w-12 text-lg font-bold"
                        onClick={() => setQty((value) => Math.max(1, value - 1))}
                      >
                        −
                      </button>
                      <span className="min-w-10 text-center text-base font-bold">{qty}</span>
                      <button
                        type="button"
                        className="h-12 w-12 text-lg font-bold"
                        onClick={() => setQty((value) => Math.min(maxQty, value + 1))}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={!canBuy || adding}
                      onClick={() => void addToCart()}
                      className="min-h-12 flex-1 rounded-xl bg-[#7a1233] px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {adding ? "Adding..." : added ? "Added to Cart!" : t("product.addToCart")}
                    </button>
                  </div>
                  <div className="mobile-sticky-cta mt-4 md:hidden">
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                      <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200">
                        <button
                          type="button"
                          className="touch-target text-lg font-bold"
                          onClick={() => setQty((value) => Math.max(1, value - 1))}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-10 text-center text-base font-bold">{qty}</span>
                        <button
                          type="button"
                          className="touch-target text-lg font-bold"
                          onClick={() => setQty((value) => Math.min(maxQty, value + 1))}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={!canBuy || adding}
                        onClick={() => void addToCart()}
                        className="min-h-12 flex-1 rounded-xl bg-[#7a1233] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {adding ? "Adding..." : added ? "Added!" : t("product.addToCart")}
                      </button>
                    </div>
                  </div>
                  {!canBuy ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {!listing
                        ? t("product.noListing")
                        : !priced
                          ? t("price.onRequest")
                          : t("product.outOfStock")}
                    </p>
                  ) : null}
                  {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] text-sm font-bold text-slate-900"
                      >
                        <WhatsAppIcon className="h-5 w-5" />
                        Enquire on WhatsApp
                      </a>
                    ) : (
                      <span className="inline-flex min-h-12 items-center justify-center rounded-xl border text-sm text-slate-400">
                        WhatsApp is not configured
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={wishBusy}
                      onClick={() => void addWishlist()}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
                    >
                      ♡ {wishSaved ? "Saved to Wishlist" : "Add to Wishlist"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4 lg:px-6">
                <div className="flex flex-wrap gap-2 border-b border-slate-200">
                  {(
                    [
                      ["features", "Key Features"],
                      ["specs", "Specifications"],
                      ["fitment", "Fitment"],
                      ["more", "More Information"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`border-b-2 px-3 py-2 text-sm font-bold ${
                        tab === id ? "border-[#7a1233] text-[#7a1233]" : "border-transparent text-slate-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="min-h-24 py-4 text-sm text-slate-700">
                  {tab === "features" ? (
                    detail?.features?.length ? (
                      <ul className="space-y-1">
                        {detail.features.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Information not available</p>
                    )
                  ) : null}
                  {tab === "specs" ? (
                    detail?.specificationRows?.length ? (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        {detail.specificationRows.map((row) => (
                          <div key={row.label}>
                            <dt className="text-xs font-bold uppercase text-slate-500">{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p>Information not available</p>
                    )
                  ) : null}
                  {tab === "fitment" ? (
                    fitment.length ? (
                      <ul className="space-y-1">
                        {fitment.map((line) => (
                          <li key={line}>✓ {line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Information not available</p>
                    )
                  ) : null}
                  {tab === "more" ? (
                    detail?.moreInformation &&
                    Object.values(detail.moreInformation).some(Boolean) ? (
                      <dl className="space-y-2">
                        {detail.moreInformation.subcategory ? (
                          <div>
                            <dt className="text-xs font-bold uppercase text-slate-500">Subcategory</dt>
                            <dd>{detail.moreInformation.subcategory}</dd>
                          </div>
                        ) : null}
                        {detail.moreInformation.fulfilledBy ? (
                          <div>
                            <dt className="text-xs font-bold uppercase text-slate-500">Fulfilled by</dt>
                            <dd>{detail.moreInformation.fulfilledBy}</dd>
                          </div>
                        ) : null}
                        {detail.moreInformation.sourceUrl ? (
                          <div>
                            <dt className="text-xs font-bold uppercase text-slate-500">Source</dt>
                            <dd>
                              <a className="text-[#7a1233] underline" href={detail.moreInformation.sourceUrl}>
                                {detail.moreInformation.sourceUrl}
                              </a>
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : (
                      <p>Information not available</p>
                    )
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 py-4 sm:grid-cols-4">
                  <Service title="Genuine Quality" body="Trusted brand parts from our authorised lines" />
                  <Service title="Fast Dispatch" body="Pan India Delivery" />
                  <Service title="Easy Returns" body="Hassle Free" />
                  <Service title="Dedicated Support" body="We're Here to Help" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value || "—"}</p>
    </div>
  );
}

function ListCard({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-800">{title}</h4>
      {values.length ? (
        <ul className="mt-2 space-y-1 text-sm font-medium text-slate-800">
          {values.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Not available</p>
      )}
    </div>
  );
}

function Service({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-extrabold text-slate-950">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{body}</p>
    </div>
  );
}
