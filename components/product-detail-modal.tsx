"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InclusivePrice } from "@/components/inclusive-price";
import {
  ErrorState,
  PanelSkeleton,
} from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import { ShortageRequest } from "@/components/product/shortage-request";
import { WhatsAppIcon } from "@/components/whatsapp-cta";
import type { MessageKey } from "@/lib/i18n";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";
import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

/**
 * Upper bound on the quantity stepper.
 *
 * This guards the INPUT only — it stops a held-down button generating a number
 * like 10,000 — and is deliberately unrelated to available stock. Capping the
 * stepper at stock is what previously made a shortage unexpressible.
 */
const MAX_QTY = 999;

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
  related?: Array<{
    id: string;
    partNumber: string;
    name: string;
    brand?: string | null;
  }>;
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

/* The V2 `InfoCard` helper and the `infoCards` array it consumed were removed
   with the card stack they served. The same fields (brand, category, OEM,
   references, compatibility) are now rows in the V3 specification sheet, built
   inline from the payload, so the two lists could not drift apart. */

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
  // Related-rail navigation stays inside the modal: picking a related part
  // swaps the lookup id without changing the parent's props. The override is
  // keyed to the parent's request so opening a different product drops any
  // stale rail selection via the render-phase reset below (the documented
  // React pattern for adjusting state when props change — no effect needed).
  const [override, setOverride] = useState<{ key: string; partId: string | null }>({
    key: "",
    partId: null,
  });
  const requestKey = `${open}-${partId ?? ""}-${sku ?? ""}`;
  if (override.key !== requestKey) {
    setOverride({ key: requestKey, partId: null });
  }
  const activeOverride = override.key === requestKey ? override.partId : null;
  const lookupPartId = activeOverride ?? partId ?? null;
  const lookupSku = activeOverride ? null : (sku ?? null);
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
    if (!lookupPartId && !lookupSku) return;
    const params = new URLSearchParams();
    if (lookupPartId) params.set("partId", lookupPartId);
    else if (lookupSku) params.set("sku", lookupSku);
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
  }, [open, lookupPartId, lookupSku, t]);

  const listing = selectPreferredStorefrontListing(payload?.listings);
  const priced = isAuthoritativeSellingPricePaise(
    listing?.listInclusivePaise,
    listing?.netInclusivePaise,
    listing?.pricePaise,
    listing?.pensolCashNetInclusivePaise,
    listing?.pensolCreditNetInclusivePaise,
  );
  const stock = listing?.stock ?? 0;
  /*
   * The cap exists to stop a stray long-press producing an absurd figure, not to
   * hide stock. It is applied to the INPUT, never to what gets recorded: a
   * customer may ask for more than we hold, and the shortfall is captured.
   */
  const canAdd = Boolean(listing) && listing?.status === "active" && stock > 0 && priced;
  /* How much of the request we can actually ship today. The remainder is not
     discarded: `ShortageRequest` records it as demand. */
  const shortageQty = Math.max(0, quantity - stock);
  /* The loaded part's id. Distinct from the `partId` PROP above, which is only
     a lookup hint and may be null when the modal was opened by SKU. */
  const loadedPartId = payload?.part?.id ?? null;
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
        /* Only what we can actually supply is added. The rest is preserved by
         `ShortageRequest` as a demand row rather than being silently dropped. */
      body: JSON.stringify({
        dealerListingId: listing.id,
        quantity: Math.min(quantity, listing.stock ?? 0),
      }),
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
  /* `infoCards` removed with the V2 card stack. The same three fields are now
     rows in the V3 specification sheet, built inline below. */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="sl-scrim z-50 flex items-center justify-center p-0 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-[100dvh] w-full max-w-[min(96vw,1360px)] min-w-0 flex-col overflow-hidden rounded-none bg-[var(--sl-surface)] shadow-[var(--sl-e-3)] sm:h-[min(88dvh,900px)] sm:max-h-[min(90dvh,900px)] sm:rounded-[var(--sl-r-lg)]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="sl-focus absolute right-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-[var(--sl-r)] border border-[var(--sl-rule-2)] bg-[var(--sl-surface)] text-[var(--sl-brand)] transition-colors hover:bg-[var(--sl-brand-soft)]"
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
            <div className="flex min-h-0 min-w-0 flex-col bg-[var(--sl-sunken)] p-3 sm:p-4">
              <div className="flex min-h-0 min-w-0 flex-1 gap-2 sm:gap-3">
                {!view360 && images.length > 1 ? (
                  <div className="hidden w-[clamp(4.25rem,8vw,5.75rem)] shrink-0 flex-col gap-2 overflow-y-auto md:flex">
                    {images.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setImageIndex(index)}
                        className={`aspect-square w-full shrink-0 overflow-hidden rounded-[var(--sl-r-xs)] border bg-[var(--sl-surface)] ${
                          index === imageIndex ? "border-[var(--sl-brand)] ring-1 ring-[var(--sl-brand)]/25" : "border-[var(--sl-rule)]"
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
                    className="relative flex min-h-[220px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[var(--sl-r)] bg-[var(--sl-surface)] md:min-h-0"
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
                        className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[var(--sl-r-xs)] bg-[var(--sl-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--sl-ink)] shadow"
                      >
                        <span className="text-[var(--sl-brand)]">360°</span>
                        {view360 ? t("product.exit360") : t("product.view360")}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label={t("product.enlarge", { name: payload.part.title })}
                      onClick={() => setEnlarged(true)}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[var(--sl-r-xs)] bg-[var(--sl-surface)] text-[var(--sl-ink-2)] shadow"
                    >
                      ↗
                    </button>

                    {!view360 && images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label={t("product.prevImage")}
                          onClick={() => cycle(-1)}
                          className="sl-focus absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 !text-[var(--sl-ink)] shadow-[var(--sl-e-2)] transition-colors hover:bg-[var(--sl-surface)]"
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
                          className="sl-focus absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 !text-[var(--sl-ink)] shadow-[var(--sl-e-2)] transition-colors hover:bg-[var(--sl-surface)]"
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
                          className="sl-focus absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 !text-[var(--sl-ink)] shadow-[var(--sl-e-2)] transition-colors hover:bg-[var(--sl-surface)]"
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
                          className="sl-focus absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 !text-[var(--sl-ink)] shadow-[var(--sl-e-2)] transition-colors hover:bg-[var(--sl-surface)]"
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
                      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-[var(--sl-r-xs)] border border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 px-2.5 py-1 text-[10px] font-semibold text-[var(--sl-ink-3)]">
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
                          className={`h-1.5 rounded-[var(--sl-r-xs)] ${
                            index === imageIndex ? "w-5 bg-[var(--sl-brand)]" : "w-1.5 bg-[var(--sl-rule-2)]"
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
                          className={`h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sl-r-xs)] border bg-[var(--sl-surface)] ${
                            index === imageIndex ? "border-[var(--sl-brand)]" : "border-[var(--sl-rule)]"
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

              {/* Assurances: three hairline-divided cells in ONE panel rather
                  than three separate rounded cards. Same three statements and
                  the same i18n keys as V2; only the container changes, so a
                  product that happens to have no image still shows them at a
                  consistent height. */}
              <ul className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-rule)]">
                {[
                  { title: t("product.genuineQuality"), hint: t("product.genuineQualityHint") },
                  { title: t("product.fastDispatch"), hint: t("product.fastDispatchHint") },
                  { title: t("product.easyReturns"), hint: t("product.easyReturnsHint") },
                ].map((item) => (
                  <li key={item.title} className="bg-[var(--sl-surface)] px-2 py-2.5 text-center">
                    <p className="sl-metric-label !text-[0.5625rem]">{item.title}</p>
                    <p className="sl-small mt-1 !text-[0.625rem] !leading-snug">
                      {item.hint}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* ==========================================================
                V3 RIGHT COLUMN — specification sheet, not a card stack.

                V2 ran one long vertical stack down this column: brand logo,
                badge, title, subtitle, prose, then a grid of three rounded
                info cards, then two more icon cards for OEM and references,
                then another for compatibility, then a price, then the purchase
                row. Eight separate boxes, each with its own border and shadow,
                competing for the same attention as the price and the Add to
                Cart button that actually decide the purchase.

                V3 groups by decision instead:

                  IDENTITY      what this part is
                  PURCHASE      what it costs and how to buy it, on a sunk
                                surface so the price block is unmistakable and
                                is never separated from the CTA by a scroll
                  SPECIFICATION one ruled two-column table of catalogue data,
                                label left, value right, every row divided by a
                                hairline. Part numbers, HSN and GST are set in
                                monospace so a column of them is comparable.

                All fields come from the same payload as before — nothing is
                added, renamed or invented. The quantity stepper, add-to-cart,
                wishlist and WhatsApp handlers are carried over untouched.
                ========================================================== */}
            <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden bg-[var(--sl-surface)]">
              {/* ---- IDENTITY ---- */}
              <div className="border-b border-[var(--sl-rule)] px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {payload.brandLogo ? (
                      <div className="relative h-9 w-32">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={payload.brandLogo}
                          alt={payload.part.brand || ""}
                          className="h-full w-full object-contain object-left"
                        />
                      </div>
                    ) : payload.part.brand ? (
                      <p className="sl-eyebrow sl-eyebrow-plain flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-[3px] bg-[var(--sl-brand)]"
                          aria-hidden
                        />
                        {payload.part.brand}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`sl-badge shrink-0 ${
                      stockUi.tone === "ok"
                        ? "sl-badge-ok"
                        : stockUi.tone === "warn"
                          ? "sl-badge-warn"
                          : "sl-badge-bad"
                    }`}
                  >
                    {stockUi.label}
                  </span>
                </div>

                <h2 id={titleId} className="sl-h2 mt-2.5 break-words">
                  {payload.part.title}
                </h2>
                {subtitle ? <p className="sl-body mt-1.5">{subtitle}</p> : null}
                {category ? (
                  <p className="sl-partno mt-1.5">{category}</p>
                ) : null}
              </div>

              {/* ---- PURCHASE: price, stock, quantity, CTA ----
                  Sunk surface and kept as one unit so a customer never has to
                  scroll between the price and the button that acts on it. */}
              <div className="border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)] px-4 py-4 sm:px-5">
                {listing ? (
                  listing.isPensol ? (
                    <p className="sl-price">
                      {listing.pricePaise > 0
                        ? `₹${(listing.pricePaise / 100).toLocaleString("en-IN")}`
                        : t("price.onRequest")}
                    </p>
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
                  <p className="sl-small mt-1.5 !text-[var(--sl-ok)]">
                    {t("product.fulfilledBy", { firm: listing.firmName })}
                  </p>
                ) : null}

                {error ? (
                  <p className="sl-small mt-2 font-medium !text-[var(--sl-bad)]" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2.5">
                  {/* Square stepper. V2 used a rounded pill with 48px controls
                      that pushed the Add to Cart button narrow on a 360px
                      modal. */}
                  <div className="flex items-center rounded-[var(--sl-r)] border border-[var(--sl-rule-2)] bg-[var(--sl-surface)]">
                    <button
                      type="button"
                      aria-label={t("product.decreaseQuantity")}
                      className="sl-focus flex h-11 w-10 shrink-0 items-center justify-center border-r border-[var(--sl-rule)] text-[var(--sl-ink)] transition-colors hover:bg-[var(--sl-page)]"
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
                    <span className="sl-num min-w-9 text-center text-[0.9375rem] font-bold text-[var(--sl-ink)]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={t("product.increaseQuantity")}
                      className="sl-focus flex h-11 w-10 shrink-0 items-center justify-center border-l border-[var(--sl-rule)] text-[var(--sl-ink)] transition-colors hover:bg-[var(--sl-page)]"
                      /* Deliberately NOT capped at `stock`.
                         This used to be `Math.min(stock, value + 1)`, which made
                         it impossible to ask for more than we hold — so a
                         customer wanting 50 with 10 in stock could never express
                         the 40-piece shortage, and procurement never learned
                         about it. The stepper now allows a larger figure and
                         `ShortageRequest` records the excess. */
                      onClick={() => setQuantity((value) => Math.min(MAX_QTY, value + 1))}
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
                    className="sl-btn sl-btn-primary min-w-0 flex-1"
                  >
                    <CartIcon className="h-4 w-4" />
                    {canAdd
                      ? t("product.addToCart")
                      : !priced
                        ? t("price.onRequest")
                        : t("product.outOfStock")}
                  </button>
                </div>

                {/* ---- SHORTAGE ----
                    Rendered only when the customer asked for more than we hold.
                    Shown for stock > 0 as well as stock === 0, because the 40
                    that cannot ship today is the same 40 in both cases and it is
                    the number procurement needs. */}
                {loadedPartId && shortageQty > 0 ? (
                  <ShortageRequest
                    partId={loadedPartId}
                    requestedQty={quantity}
                    availableQty={stock}
                  />
                ) : null}

                <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sl-btn sl-btn-secondary min-w-0"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
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
                    className="sl-btn sl-btn-secondary min-w-0"
                  >
                    <HeartIcon className="h-4 w-4" />
                    {t("product.addWishlist")}
                  </button>
                </div>
              </div>

              {/* ---- RELATED PRODUCTS ----
                  Server-selected rows sharing this part's category or brand
                  (visibility-gated, current product excluded). Hidden entirely
                  when there is nothing to show; picking an item swaps the
                  modal content without leaving the page. */}
              {payload.related && payload.related.length > 0 ? (
                <div className="border-t border-[var(--sl-rule)] px-4 py-4 sm:px-5">
                  <h3 className="text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--sl-ink-soft)]">
                    {t("product.relatedProducts")}
                  </h3>
                  <ul className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    {payload.related.map((item) => (
                      <li key={item.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setOverride({ key: requestKey, partId: item.id })}
                          className="block w-full min-w-0 rounded-lg border border-[var(--sl-rule)] px-3 py-2 text-left transition-colors hover:border-[#7a1233]"
                        >
                          <span className="block truncate text-[0.8125rem] font-medium text-[var(--sl-ink)]">
                            {item.name}
                          </span>
                          <span className="block truncate text-[0.75rem] text-[var(--sl-ink-soft)]">
                            {item.partNumber}
                            {item.brand ? ` · ${item.brand}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* ---- SPECIFICATION SHEET ---- */}
              <div className="px-4 py-4 sm:px-5">
                <dl className="divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
                  {payload.part.partNumber ? (
                    <SpecRow
                      label={t("product.partNo")}
                      value={payload.part.partNumber}
                      mono
                    />
                  ) : null}
                  {payload.part.brand ? (
                    <SpecRow label={t("product.brand")} value={payload.part.brand} />
                  ) : null}
                  {category ? (
                    <SpecRow label={t("product.category")} value={category} />
                  ) : null}
                  {listing?.gstRate != null ? (
                    <SpecRow label="GST" value={`${listing.gstRate}%`} mono />
                  ) : null}
                  {oemNumbers.length ? (
                    <SpecRow
                      label={t("product.oem")}
                      value={oemNumbers.join(", ")}
                      mono
                    />
                  ) : null}
                  {references.length ? (
                    <SpecRow
                      label={t("product.references")}
                      value={references.join(", ")}
                      mono
                    />
                  ) : null}
                  {compatibility.length ? (
                    <SpecRow
                      label={t("product.compatible")}
                      value={compatibility.join(", ")}
                    />
                  ) : null}
                </dl>

                {payload.part.description ? (
                  <p className="sl-body mt-4">{payload.part.description}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {enlarged ? (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--sl-graphite)]/90 p-6"
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

/** One row of the V3 specification sheet: label left, value right, hairline
    between rows. Catalogue numbers are set in monospace so a reader can
    compare them down a column; prose values are not. */
function SpecRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="sl-metric-label shrink-0 !text-[0.625rem]">{label}</dt>
      <dd
        className={`min-w-0 break-words text-right text-[0.8125rem] ${
          mono ? "sl-part !text-[var(--sl-ink)]" : "font-medium text-[var(--sl-ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
