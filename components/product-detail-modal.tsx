"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { InclusivePrice } from "@/components/inclusive-price";
import {
  ErrorState,
  PanelSkeleton,
} from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppIcon } from "@/components/whatsapp-cta";
import type { MessageKey } from "@/lib/i18n";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

type Listing = {
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

type DetailPayload = {
  part: {
    id: string;
    title: string;
    partNumber: string;
    brand?: string | null;
    category?: string | null;
    subtitle?: string | null;
    description?: string | null;
  };
  brandLogo: string | null;
  images: string[];
  thumbUrls?: Array<string | null>;
  mediumUrls?: Array<string | null>;
  has360: boolean;
  cards: Array<{ label: string; value: string }>;
  oemNumbers?: string[];
  references?: string[];
  compatibility?: string[];
  specifications?: Array<{ label: string; value: string }>;
  listings: Listing[];
};

function HeartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6h15l-1.5 8.5H8L6 6Zm0 0L5 3H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.3" fill="currentColor" />
      <circle cx="18" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}

function stockState(
  listing: Listing | undefined,
  t: (key: MessageKey, vars?: Record<string, string>) => string,
) {
  if (!listing) return { label: t("product.noListing"), tone: "muted" as const };
  const stock = listing.stock ?? 0;
  if (listing.status !== "active" || stock <= 0) {
    return { label: t("product.outOfStock"), tone: "danger" as const };
  }
  if (stock <= 5) return { label: t("product.lowStock"), tone: "warn" as const };
  return { label: t("product.inStock", { count: String(stock) }), tone: "ok" as const };
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/80 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--sl-muted)]">
        {icon}
        {title}
      </p>
      <div className="mt-1 text-xs font-semibold leading-snug text-[var(--sl-text)]">{children}</div>
    </div>
  );
}

export function ProductDetailModal({
  open,
  partId,
  sku,
  onClose,
  onAddedToCart,
  onWishlistChange,
}: {
  open: boolean;
  partId?: string | null;
  sku?: string | null;
  onClose: () => void;
  onAddedToCart?: () => void;
  onWishlistChange?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [error, setError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [view360, setView360] = useState(false);
  const [frame, setFrame] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const dragRef = useRef<{ x: number; frame: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!partId && !sku) return;
    const params = new URLSearchParams();
    if (partId) params.set("partId", partId);
    else if (sku) params.set("sku", sku);
    const controller = new AbortController();
    void fetch(`/api/catalogue/product-detail?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as DetailPayload & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load product");
        setPayload(data);
        setImageIndex(0);
        setView360(false);
        setFrame(0);
        setQuantity(1);
        setError("");
        setEnlarged(false);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : t("product.addFail"));
      });
    return () => controller.abort();
  }, [open, partId, sku, t]);

  const listing = selectPreferredStorefrontListing(payload?.listings);
  const priced = isAuthoritativeSellingPricePaise(
    listing?.listInclusivePaise,
    listing?.netInclusivePaise,
    listing?.pricePaise,
    listing?.pensolCashNetInclusivePaise,
    listing?.pensolCreditNetInclusivePaise,
  );
  const stock = listing?.stock ?? 0;
  const canAdd = Boolean(listing) && listing?.status === "active" && stock > 0 && priced;
  const images = payload?.images?.length ? payload.images : ["/images/products/placeholder.svg"];
  const thumbUrls = payload?.thumbUrls?.length === images.length ? payload.thumbUrls : images.map(() => null);
  const mediumUrls =
    payload?.mediumUrls?.length === images.length ? payload.mediumUrls : images.map(() => null);
  const activeIndex = view360 ? frame : imageIndex;
  const mainOriginal = images[activeIndex] || images[0];
  const mainMedium = mediumUrls[activeIndex] || images[activeIndex] || images[0];
  const mainSrc = mainMedium || mainOriginal;
  const titleId = "product-detail-title";
  const stockUi = stockState(listing, t);
  const whatsappHref = useMemo(() => {
    if (!payload) return getWhatsAppChatUrl();
    return getWhatsAppChatUrl(
      `Hello Sparelink India, I want to enquire about ${payload.part.title} (Part No. ${payload.part.partNumber}).`,
    );
  }, [payload]);

  const cycle = useCallback(
    (delta: number) => {
      setImageIndex((current) => {
        if (images.length <= 1) return 0;
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  const cycleFrame = useCallback(
    (delta: number) => {
      setFrame((current) => {
        if (images.length <= 1) return 0;
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
        if (event.key === "Escape") {
        if (enlarged) {
          setEnlarged(false);
          return;
        }
        if (view360) {
          setView360(false);
          return;
        }
        onClose();
        return;
      }
      if (view360) {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          cycleFrame(event.key === "ArrowLeft" ? -1 : 1);
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycle(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycle(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, cycle, cycleFrame, view360, enlarged]);

  async function addToCart() {
    if (!listing || !canAdd) return;
    setAdding(true);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerListingId: listing.id, quantity }),
      });
      const data = (await response.json()) as { error?: string };
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(data.error || t("product.addFail"));
      onAddedToCart?.();
    } catch {
      setError(t("product.addFail"));
    } finally {
      setAdding(false);
    }
  }

  async function addWishlist() {
    if (!payload) return;
    setWishlistBusy(true);
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: payload.part.id }),
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error("wishlist");
      onWishlistChange?.();
    } catch {
      setError(t("wishlist.unavailable"));
    } finally {
      setWishlistBusy(false);
    }
  }

  if (!open) return null;

  const oemNumbers = payload?.oemNumbers ?? [];
  const references = payload?.references ?? [];
  const compatibility = payload?.compatibility ?? [];
  const specifications = payload?.specifications ?? [];
  const category = payload?.part.category || "";
  const subtitle =
    payload?.part.subtitle && payload.part.subtitle.toLowerCase() !== category.toLowerCase()
      ? payload.part.subtitle
      : specifications.length
        ? `(${specifications.map((item) => `${item.label}: ${item.value}`).join(", ")})`
        : null;
  const infoCards = payload
    ? [
        payload.part.partNumber ? { label: t("product.partNo"), value: payload.part.partNumber } : null,
        payload.part.brand ? { label: t("product.brand"), value: payload.part.brand } : null,
        category ? { label: t("product.category"), value: category } : null,
      ].filter((item): item is { label: string; value: string } => Boolean(item))
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,17,15,0.78)] p-0 backdrop-blur-[8px] sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-[100dvh] w-full max-w-[min(92vw,1420px)] min-w-0 flex-col overflow-hidden rounded-none bg-white shadow-[0_40px_90px_-30px_rgba(42,8,18,0.7)] ring-1 ring-brand-900/10 sm:h-[min(86dvh,880px)] sm:max-h-[min(88dvh,880px)] sm:rounded-[20px]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="sl-v2-focus-invert absolute right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--sl-border)] bg-white/95 text-[var(--sl-primary)] shadow-sm backdrop-blur transition-colors duration-200 hover:bg-[var(--sl-primary-soft)]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {!payload && !error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10" role="status" aria-busy="true">
            <PanelSkeleton rows={4} className="w-full max-w-sm" />
            <span className="sr-only">{t("common.loading")}</span>
          </div>
        ) : error && !payload ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <ErrorState title={t("common.error")} body={error} onRetry={() => window.location.reload()} />
          </div>
        ) : payload ? (
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1.27fr)_minmax(0,1fr)] md:overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-col bg-[var(--sl-surface-sunk)] p-3 sm:p-4">
              <div className="flex min-h-0 min-w-0 flex-1 gap-2 sm:gap-3">
                {!view360 && images.length > 1 ? (
                  <div className="hidden w-[clamp(4.25rem,8vw,5.75rem)] shrink-0 flex-col gap-2 overflow-y-auto md:flex">
                    {images.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setImageIndex(index)}
                        className={`aspect-square w-full shrink-0 overflow-hidden rounded-[var(--sl-radius)] border bg-white ${
                          index === imageIndex ? "border-[var(--sl-primary)] ring-1 ring-[var(--sl-primary)]/30" : "border-[var(--sl-border)]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrls[index] || mediumUrls[index] || "/images/products/placeholder.svg"}
                          alt=""
                          draggable={false}
                          loading={index === 0 ? "eager" : "lazy"}
                          decoding="async"
                          width={92}
                          height={92}
                          className="h-full w-full object-contain p-1"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <div
                    className="relative flex min-h-[220px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[var(--sl-radius-lg)] bg-white md:min-h-0"
                    onPointerDown={(event) => {
                      if (!view360) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragRef.current = { x: event.clientX, frame };
                    }}
                    onPointerMove={(event) => {
                      if (!view360) return;
                      const drag = dragRef.current;
                      if (!drag) return;
                      const delta = Math.trunc((event.clientX - drag.x) / 16);
                      if (!delta) return;
                      const next = (drag.frame + delta + images.length * 16) % images.length;
                      setFrame(next);
                    }}
                    onPointerUp={() => {
                      dragRef.current = null;
                    }}
                    onPointerLeave={() => {
                      dragRef.current = null;
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mainSrc}
                      alt={payload.part.title}
                      draggable={false}
                      loading="eager"
                      decoding="async"
                      className="h-full max-h-[42vh] w-full select-none object-contain p-6 md:max-h-none"
                      onError={(event) => {
                        const el = event.currentTarget as HTMLImageElement;
                        if (mainOriginal && el.src !== mainOriginal) {
                          el.src = mainOriginal;
                          return;
                        }
                        el.src = "/images/products/placeholder.svg";
                      }}
                    />

                    {payload.has360 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setView360((value) => !value);
                          setFrame(imageIndex);
                        }}
                        className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 shadow"
                      >
                        <span className="text-[var(--sl-primary)]">360°</span>
                        {view360 ? t("product.exit360") : t("product.view360")}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label={t("product.enlarge", { name: payload.part.title })}
                      onClick={() => setEnlarged(true)}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[var(--sl-radius)] bg-white text-[var(--sl-text-soft)] shadow"
                    >
                      ↗
                    </button>

                    {!view360 && images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label={t("product.prevImage")}
                          onClick={() => cycle(-1)}
                          className="sl-v2-focus absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white/95 !text-[var(--sl-text)] shadow-[var(--sl-shadow)] transition-colors hover:bg-white"
                        >
                          <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M15 6l-6 6 6 6" />
                        </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={t("product.nextImage")}
                          onClick={() => cycle(1)}
                          className="sl-v2-focus absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white/95 !text-[var(--sl-text)] shadow-[var(--sl-shadow)] transition-colors hover:bg-white"
                        >
                          <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                        </button>
                      </>
                    ) : null}

                    {view360 && images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label={t("product.prevImage")}
                          onClick={() => cycleFrame(-1)}
                          className="sl-v2-focus absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white/95 !text-[var(--sl-text)] shadow-[var(--sl-shadow)] transition-colors hover:bg-white"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M15 6l-6 6 6 6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={t("product.nextImage")}
                          onClick={() => cycleFrame(1)}
                          className="sl-v2-focus absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white/95 !text-[var(--sl-text)] shadow-[var(--sl-shadow)] transition-colors hover:bg-white"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </button>
                      </>
                    ) : null}

                    {view360 ? (
                      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-[var(--sl-muted)] shadow">
                        {frame + 1} / {images.length}
                      </span>
                    ) : null}
                  </div>

                  {!view360 && images.length > 1 ? (
                    <div className="mt-2 flex justify-center gap-1.5">
                      {images.map((src, index) => (
                        <button
                          key={`dot-${src}-${index}`}
                          type="button"
                          aria-label={`${index + 1}`}
                          onClick={() => setImageIndex(index)}
                          className={`h-1.5 rounded-full ${
                            index === imageIndex ? "w-5 bg-[var(--sl-primary)]" : "w-1.5 bg-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}

                  {!view360 && images.length > 1 ? (
                    <div className="mt-2 flex shrink-0 gap-2 overflow-x-auto pb-1 md:hidden">
                      {images.map((src, index) => (
                        <button
                          key={`m-${src}-${index}`}
                          type="button"
                          onClick={() => setImageIndex(index)}
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sl-radius)] border bg-white ${
                            index === imageIndex ? "border-[var(--sl-primary)]" : "border-[var(--sl-border)]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbUrls[index] || mediumUrls[index] || "/images/products/placeholder.svg"}
                            alt=""
                            draggable={false}
                            loading="lazy"
                            decoding="async"
                            width={56}
                            height={56}
                            className="h-full w-full object-contain p-1"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <ul className="mt-3 grid grid-cols-3 gap-2">
              <li className="sl-v2-card px-2 py-2.5 text-center">
                <p className="sl-label !text-[var(--sl-primary)]">
                  {t("product.genuineQuality")}
                </p>
                <p className="sl-small mt-1 !text-[0.625rem] leading-snug">
                  {t("product.genuineQualityHint")}
                </p>
              </li>
              <li className="sl-v2-card px-2 py-2.5 text-center">
                <p className="sl-label !text-[var(--sl-primary)]">
                  {t("product.fastDispatch")}
                </p>
                <p className="sl-small mt-1 !text-[0.625rem] leading-snug">
                  {t("product.fastDispatchHint")}
                </p>
              </li>
              <li className="sl-v2-card px-2 py-2.5 text-center">
                <p className="sl-label !text-[var(--sl-primary)]">
                  {t("product.easyReturns")}
                </p>
                <p className="sl-small mt-1 !text-[0.625rem] leading-snug">
                  {t("product.easyReturnsHint")}
                </p>
              </li>
            </ul>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  {payload.brandLogo ? (
                    <div className="relative h-12 w-40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={payload.brandLogo}
                        alt={payload.part.brand || ""}
                        className="h-full w-full object-contain object-left"
                      />
                    </div>
                  ) : payload.part.brand ? (
                    <p className="sl-h3 !text-[var(--sl-primary)]">{payload.part.brand}</p>
                  ) : null}
                </div>
                <span
              className={`sl-v2-badge shrink-0 ${
                stockUi.tone === "ok"
                  ? "sl-v2-badge-success"
                  : stockUi.tone === "warn"
                    ? "sl-v2-badge-brand"
                    : stockUi.tone === "danger"
                      ? "sl-v2-badge-danger"
                      : ""
              }`}
            >
                  {stockUi.label}
                </span>
              </div>

              <h2 id={titleId} className="sl-h1 mt-3 break-words !text-[clamp(1.1rem,2vw,1.375rem)] leading-snug tracking-tight text-slate-950">
                {payload.part.title}
              </h2>
              {subtitle ? <p className="sl-body mt-1.5">{subtitle}</p> : null}
              {category ? <p className="sl-nav mt-1.5 !text-[var(--sl-text-soft)]">{category}</p> : null}

              {payload.part.description ? (
                <>
                  <div className="my-4 h-px bg-[var(--sl-border)]" />
                  <p className="sl-body">{payload.part.description}</p>
                </>
              ) : null}

              {infoCards.length ? (
                <>
                  <div className="my-4 h-px bg-[var(--sl-border)]" />
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                    {infoCards.map((card) => (
                      <div key={card.label} className="sl-v2-card px-3 py-2.5">
                        <p className="sl-label !text-[0.625rem]">{card.label}</p>
                        <p className="sl-nav mt-1 break-words !text-[var(--sl-text)]">{card.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {oemNumbers.length || references.length ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {oemNumbers.length ? (
                    <InfoCard
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
                          <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      }
                      title={t("product.oem")}
                    >
                      {oemNumbers.map((value) => (
                        <p key={value}>{value}</p>
                      ))}
                    </InfoCard>
                  ) : null}
                  {references.length ? (
                    <InfoCard
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                          <path
                            d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18.07"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      }
                      title={t("product.references")}
                    >
                      {references.map((value) => (
                        <p key={value}>{value}</p>
                      ))}
                    </InfoCard>
                  ) : null}
                </div>
              ) : null}

              {compatibility.length ? (
                <div className="mt-2">
                  <InfoCard
                    icon={
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4 16h16M6 16V9l6-4 6 4v7"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinejoin="round"
                        />
                      </svg>
                    }
                    title={t("product.compatible")}
                  >
                    {compatibility.map((value) => (
                      <p key={value}>{value}</p>
                    ))}
                  </InfoCard>
                </div>
              ) : null}

              <div className="mt-4 border-t border-[var(--sl-border)] pt-3">
                {listing ? (
                  listing.isPensol ? (
                    <div className="text-sm font-bold text-[var(--sl-text)]">
                      {listing.pricePaise > 0
                        ? `₹${(listing.pricePaise / 100).toLocaleString("en-IN")}`
                        : t("price.onRequest")}
                    </div>
                  ) : (
                    <InclusivePrice
                      pricePaise={listing.pricePaise}
                      listInclusivePaise={listing.listInclusivePaise}
                      netInclusivePaise={listing.netInclusivePaise}
                      discountPercent={listing.discountPercent}
                      gstRate={listing.gstRate}
                      align="left"
                    />
                  )
                ) : (
                  <p className="sl-h3">{t("price.onRequest")}</p>
                )}
                {listing?.firmName ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    {t("product.fulfilledBy", { firm: listing.firmName })}
                  </p>
                ) : null}

                {error ? (
              <p className="sl-small mt-2 font-medium !text-[var(--sl-danger)]" role="alert">
                {error}
              </p>
            ) : null}

                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-[var(--sl-radius)] border border-[var(--sl-border)]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      className="sl-v2-focus flex h-12 w-11 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border-strong)] bg-white text-[var(--sl-text)] transition-colors hover:bg-[var(--sl-surface-sunk)]"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <span className="min-w-9 text-center sl-price !text-base tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      aria-label={t("product.increaseQuantity")}
                      className="sl-v2-focus flex h-12 w-11 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border-strong)] bg-white text-[var(--sl-text)] transition-colors hover:bg-[var(--sl-surface-sunk)]"
                      onClick={() => setQuantity((value) => Math.min(Math.max(stock, 1), value + 1))}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!canAdd || adding}
                    onClick={() => void addToCart()}
                    className="sl-v2-btn sl-v2-btn-primary min-w-0 flex-1"
                  >
                    <CartIcon className="h-4 w-4" />
                    {canAdd
                      ? t("product.addToCart")
                      : !priced
                        ? t("price.onRequest")
                        : t("product.outOfStock")}
                  </button>
                </div>

                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sl-v2-btn sl-v2-btn-secondary min-w-0"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                      {t("product.enquireWhatsApp")}
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    disabled={wishlistBusy}
                    aria-label={t("product.addWishlist")}
                    onClick={() => void addWishlist()}
                    className="sl-v2-btn sl-v2-btn-secondary min-w-0"
                  >
                    <HeartIcon className="h-4 w-4" />
                    {t("product.addWishlist")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {enlarged ? (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"
            onClick={() => setEnlarged(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mainOriginal || mainSrc}
              alt={payload?.part.title || ""}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
