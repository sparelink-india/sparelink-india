/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { useI18n } from "@/components/preferences-provider";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

type CartItem = {
  id: string;
  dealerListingId: string;
  quantity: number;
  pricePaise: number;
  partId: string;
  partNumber: string | null;
  partName: string | null;
  partBrand: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  dealerId: string | null;
  dealerName: string | null;
  firmId: string | null;
  firmName: string | null;
  firmCode: string | null;
  mrpPaise: number | null;
  stock: number | null;
  listingStatus: string;
  gstRate?: number;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  discountPaise?: number;
  itemSubtotalPaise?: number;
  itemGstPaise?: number;
  itemTotalPaise?: number;
};

type CartData = {
  id: string | null;
  items: CartItem[];
  subtotalPaise?: number;
  gstPaise?: number;
  shippingPaise?: number;
  totalPaise: number;
  itemCount: number;
  requiresLogin?: boolean;
};

export default function CartPage() {
  const { t } = useI18n();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
    name: string;
    partNumber?: string | null;
  } | null>(null);
  const [, startTransition] = useTransition();

  // Prevent background scroll when lightbox is open & listen for ESC key
  useEffect(() => {
    if (lightboxImage) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setLightboxImage(null);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [lightboxImage]);

  const loadCart = useCallback(async () => {
    try {
      setError("");
      const response = await fetch("/api/cart", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("cart.loadFail"));
      }

      setCart(data);
    } catch (cartError) {
      console.error(cartError);
      setError(
        cartError instanceof Error
          ? cartError.message
          : t("cart.loadFail"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  async function updateQuantity(cartItemId: string, newQuantity: number) {
    if (newQuantity < 1) return;
    if (updatingIds[cartItemId]) return;

    setError("");
    setActionMessage("");
    setUpdatingIds((prev) => ({ ...prev, [cartItemId]: true }));

    // Optimistic UI update
    const previousCart = cart;
    if (cart) {
      const updatedItems = cart.items.map((item) =>
        item.id === cartItemId ? { ...item, quantity: newQuantity } : item,
      );
      setCart({
        ...cart,
        items: updatedItems,
      });
    }

    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartItemId, quantity: newQuantity }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Rollback optimistic update
        setCart(previousCart);
        throw new Error(data.error || t("cart.updateFail"));
      }

      startTransition(() => {
        void loadCart();
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : t("cart.updateFailGeneric"),
      );
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [cartItemId]: false }));
    }
  }

  async function removeItem(cartItemId: string, itemName?: string | null) {
    if (updatingIds[cartItemId]) return;

    setError("");
    setActionMessage("");
    setUpdatingIds((prev) => ({ ...prev, [cartItemId]: true }));

    // Optimistic UI update
    const previousCart = cart;
    if (cart) {
      const updatedItems = cart.items.filter((item) => item.id !== cartItemId);
      setCart({
        ...cart,
        items: updatedItems,
      });
    }

    try {
      const response = await fetch(`/api/cart?cartItemId=${cartItemId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setCart(previousCart);
        throw new Error(data.error || t("cart.removeFail"));
      }

      setActionMessage(
        itemName ? t("cart.removedNamed", { name: itemName }) : t("cart.removed"),
      );

      startTransition(() => {
        void loadCart();
      });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : t("cart.removeFailGeneric"),
      );
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [cartItemId]: false }));
    }
  }

  const isCartEmpty = !cart || cart.items.length === 0;
  const hasUnpricedItems = Boolean(
    cart?.items.some(
      (item) =>
        !isAuthoritativeSellingPricePaise(
          item.listInclusivePaise,
          item.netInclusivePaise,
          item.pricePaise,
        ),
    ),
  );

  return (
    <div
      className={`flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)] ${
        !loading && !isCartEmpty && cart && !hasUnpricedItems
          ? "pb-[calc(var(--mobile-nav-height)+var(--safe-bottom)+4.75rem)] md:pb-0"
          : "storefront-mobile-pad"
      }`}
    >
      <StorefrontHeader cartCount={cart?.itemCount ?? 0} />

      {/* Main Content */}
      <main className="sl-container sl-page-main flex-1">
        {/* Title & Stats */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--sl-rule)] pb-5">
          <div>
            <h1 className="sl-h1">{t("cart.title")}</h1>
            <div className="mt-3 flex items-center gap-3">
              <Link href="/" className="text-xs font-semibold text-[var(--sl-brand-ink)] hover:underline">
                {t("cart.continue")}
              </Link>
              <SignOutButton />
            </div>
            <p className="mt-1 text-sm text-[var(--sl-ink-3)]">{t("cart.genuine")}</p>
          </div>
          {!loading && !isCartEmpty && (
            <span className="sl-badge sl-badge-neutral">
              {cart?.itemCount}{" "}
              {cart?.itemCount === 1 ? t("category.item") : t("category.items")}
            </span>
          )}
        </div>

        {/* Notifications */}
        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-[var(--sl-r)] border border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] p-4 text-sm text-[var(--sl-bad)] shadow-sm sl-fade-in"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sl-bad)]"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 font-medium">{error}</div>
            <button
              onClick={() => setError("")}
              className="text-xs font-semibold text-[var(--sl-bad)] hover:text-[var(--sl-bad)]"
              aria-label={t("common.dismiss")}
            >
              {t("common.dismiss")}
            </button>
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            className="mt-6 flex items-center justify-between rounded-[var(--sl-r)] border border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] p-4 text-sm text-[var(--sl-ok)] shadow-sm sl-fade-in"
          >
            <div className="flex items-center gap-2.5">
              <svg
                className="h-5 w-5 text-[var(--sl-ok)]"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{actionMessage}</span>
            </div>
            <button
              onClick={() => setActionMessage("")}
              className="text-xs font-semibold text-[var(--sl-ok)] hover:text-[var(--sl-ok)]"
              aria-label={t("common.dismiss")}
            >
              {t("common.dismiss")}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-8 space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="sl-skel h-24 w-full"
              >
                <div className="flex gap-4">
                  <div className="sl-skel h-24 w-28 !rounded-[var(--sl-r)]" />
                  <div className="flex-1 space-y-3">
                    <div className="sl-skel h-5 w-1/3" />
                    <div className="sl-skel h-4 w-1/4" />
                    <div className="sl-skel h-8 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && cart?.requiresLogin && (
          <div className="sl-panel mt-10 p-10 text-center sm:p-14">
            <h2 className="sl-h2">{t("cart.signInTitle")}</h2>
            <p className="sl-body mx-auto mt-2 max-w-sm">
              {t("cart.signInBody")}
            </p>
            <Link
              href="/login"
              className="sl-btn sl-btn-primary mt-7"
            >
              {t("cart.signIn")}
            </Link>
          </div>
        )}

        {/* Empty State */}
        {!loading && !cart?.requiresLogin && isCartEmpty && (
          <div className="mt-10 rounded-[var(--sl-r-lg)] border border-dashed border-[var(--sl-rule-strong)] bg-[var(--sl-surface)] p-12 text-center shadow-sm sm:p-16">
            <div className="sl-state-icon mx-auto h-20 w-20">
              <svg
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <h2 className="sl-h2 mt-5">
              {t("cart.emptyTitle")}
            </h2>
            <p className="sl-body mx-auto mt-2 max-w-sm">
              {t("cart.emptyBody")}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="sl-btn sl-btn-primary"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {t("cart.find")}
              </Link>
            </div>
          </div>
        )}

        {/* Cart Contents */}
        {!loading && !isCartEmpty && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* Cart Items List */}
            <section
              aria-label={t("cart.title")}
              className="space-y-4"
            >
              {cart.items.map((item) => {
                const isUpdating = Boolean(updatingIds[item.id]);
                // A missing inventory row means the server knows zero
                // sellable units (validateAvailableStock rejects any qty
                // against null stock), so the stepper must not offer "+".
                // The previous `?? 999` enabled increments the API rejects.
                const maxStock = item.stock ?? 0;
                const canIncrease = item.quantity < maxStock && !isUpdating;
                const canDecrease = item.quantity > 1 && !isUpdating;
                const isPriced = isAuthoritativeSellingPricePaise(
                  item.listInclusivePaise,
                  item.netInclusivePaise,
                  item.pricePaise,
                );
                const itemTotalPaise = item.itemTotalPaise ?? item.pricePaise * item.quantity;
                const itemTotalRupees = itemTotalPaise / 100;
                const listRupees = (item.listInclusivePaise ?? item.pricePaise) / 100;
                const unitPriceRupees = (item.netInclusivePaise ?? item.pricePaise) / 100;
                const mrpRupees = item.mrpPaise ? item.mrpPaise / 100 : null;

                return (
                  <article
                    key={item.id}
                    className={`sl-panel group relative overflow-hidden p-4 sm:p-5 ${
                      isUpdating ? "opacity-70 pointer-events-none" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                      {/* Product Image with Lightbox Trigger */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setLightboxImage({
                            src: item.imageUrl || "/images/products/placeholder.svg",
                            alt: item.partName || t("product.partFallback"),
                            name: item.partName || t("product.partFallback"),
                            partNumber: item.partNumber,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setLightboxImage({
                              src: item.imageUrl || "/images/products/placeholder.svg",
                              alt: item.partName || t("product.partFallback"),
                              name: item.partName || t("product.partFallback"),
                              partNumber: item.partNumber,
                            });
                          }
                        }}
                        aria-label={t("product.enlarge", {
                          name: item.partName || t("product.partFallback"),
                        })}
                        className="sl-focus relative aspect-[4/3] w-full shrink-0 cursor-zoom-in overflow-hidden rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-sunken)] sm:w-28"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumbUrl || item.imageUrl || "/images/products/placeholder.svg"}
                          alt={item.partName || t("product.partFallback")}
                          width={112}
                          height={84}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const element = e.currentTarget as HTMLImageElement;
                            const original = item.imageUrl;
                            if (original && element.src !== original) {
                              element.src = original;
                              return;
                            }
                            element.src = "/images/products/placeholder.svg";
                          }}
                        />
                        {item.partBrand && (
                          <span className="absolute bottom-1 left-1 rounded bg-[var(--sl-graphite-2)]/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white backdrop-blur-xs">
                            {item.partBrand}
                          </span>
                        )}
                      </div>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="sl-h3">
                              {item.partName || t("product.partFallback")}
                            </h2>
                            {item.partNumber && (
                              <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--sl-ink-3)]">
                                <span>{t("product.partHash", { number: item.partNumber ?? "" })}</span>
                              </p>
                            )}
                          </div>
                          {/* Subtotal (mobile view) */}
                          <div className="text-right sm:hidden">
                            <span className="text-base font-bold text-[var(--sl-ink)]">
                              ₹{itemTotalRupees.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* Distributor & Stock Meta */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {item.firmName && (
                            <span className="sl-badge sl-badge-ok inline-flex items-center gap-1">
                              <svg
                                className="h-3 w-3 text-[var(--sl-ok)]"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {t("product.fulfilledBy", { firm: item.firmName })}
                            </span>
                          )}

                          {item.stock !== null && (
                            <span
                              className={`sl-badge ${
                                item.stock > 10 ? "sl-badge-neutral" : "sl-badge-warn"
                              }`}
                            >
                              {item.stock > 10
                                ? t("product.inStock", { count: item.stock })
                                : t("cart.stockLeft", { count: item.stock })}
                            </span>
                          )}
                        </div>

                        {/* Controls & Pricing Bar */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--sl-rule)] pt-3.5">
                          {/* Unit price */}
                          <div className="flex flex-col">
                            {isPriced ? (
                              <>
                            <span className="sl-meta tabular-nums">
                              {t("price.listRate")} ₹{listRupees.toLocaleString("en-IN")} · {t("price.inclGst")}
                            </span>
                            <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-[var(--sl-ink)]">
                              ₹{unitPriceRupees.toLocaleString("en-IN")}
                            </span>
                            {mrpRupees && mrpRupees > unitPriceRupees && (
                              <span className="text-xs text-[var(--sl-ink-3)] line-through">
                                ₹{mrpRupees.toLocaleString("en-IN")}
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--sl-ink-3)]">
                {t("cart.unitNet")}
              </span>
                            </div>
                            {(item.discountPercent ?? 0) > 0 ? (
                              <span className="text-[11px] font-semibold text-[var(--sl-brand-ink)]">
                                {t("price.inclTaxDiscount", { percent: item.discountPercent ?? 0 })}
                              </span>
                            ) : null}
                              </>
                            ) : (
                              <span className="text-sm font-bold text-[var(--sl-ink)]">
                                {t("price.onRequest")}
                              </span>
                            )}
                          </div>

                          {/* Controls: [ - ] qty [ + ] and Delete */}
                          <div className="flex items-center gap-4">
                            {/* Quantity Controls */}
                            <div className="inline-flex items-center rounded-[var(--sl-r)] border border-[var(--sl-rule-strong)] bg-[var(--sl-sunken)]/70 p-0.5 shadow-xs">
                              <button
                                type="button"
                                onClick={() =>
                                  void updateQuantity(
                                    item.id,
                                    item.quantity - 1,
                                  )
                                }
                                disabled={!canDecrease}
                                aria-label={t("product.decreaseQuantity")}
                                className="sl-focus flex h-8 w-8 items-center justify-center rounded-[2px] text-[var(--sl-ink-2)] transition-colors hover:bg-[var(--sl-surface)] hover:text-[var(--sl-ink)] active:bg-[var(--sl-sunken-2)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M20 12H4"
                                  />
                                </svg>
                              </button>

                              <span
                                className="flex h-8 w-10 items-center justify-center font-mono text-sm font-bold text-[var(--sl-ink)] select-none"
                                aria-live="polite"
                              >
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  void updateQuantity(
                                    item.id,
                                    item.quantity + 1,
                                  )
                                }
                                disabled={!canIncrease}
                                aria-label={t("product.increaseQuantity")}
                                className="sl-focus flex h-8 w-8 items-center justify-center rounded-[2px] text-[var(--sl-ink-2)] transition-colors hover:bg-[var(--sl-surface)] hover:text-[var(--sl-ink)] active:bg-[var(--sl-sunken-2)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              </button>
                            </div>

                            {/* Subtotal (desktop view) */}
                            <div className="hidden min-w-[90px] text-right sm:block">
                              <span className="text-base font-bold text-[var(--sl-ink)]">
                                {isPriced
                                  ? `₹${itemTotalRupees.toLocaleString("en-IN")}`
                                  : t("price.onRequest")}
                              </span>
                            </div>

                            {/* Delete / Remove Button */}
                            <button
                              type="button"
                              onClick={() =>
                                void removeItem(item.id, item.partName)
                              }
                              disabled={isUpdating}
                              aria-label={t("cart.removeItem", { name: item.partName || t("product.partFallback") })}
                              className="inline-flex items-center gap-1.5 rounded-[2px] px-2.5 py-1.5 text-xs font-semibold text-[var(--sl-bad)] transition-colors hover:bg-[var(--sl-bad-soft)] hover:text-[var(--sl-bad)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              <span className="hidden sm:inline">{t("cart.remove")}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Order Summary Sidebar. Sticky on desktop so the total and the
                checkout action stay visible while the item list scrolls. */}
            <aside aria-label={t("cart.summary")}>
              <div className="sl-panel sticky top-[var(--v3-header-h)] p-5 sm:p-6">
                <h2 className="sl-h2 flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-[3px] bg-[var(--sl-brand)]"
                    aria-hidden
                  />
                  {t("cart.summary")}
                </h2>

                <dl className="mt-4 divide-y divide-[var(--sl-rule)] border-y border-[var(--sl-rule)]">
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="sl-metric-label !text-[0.625rem]">
                      {t("cart.subtotal", { count: cart.itemCount })}
                    </dt>
                    <dd className="sl-num shrink-0 text-[0.875rem] font-semibold text-[var(--sl-ink)]">
                      ₹
                      {(
                        (cart.subtotalPaise ??
                          cart.items.reduce(
                            (sum, i) => sum + i.pricePaise * i.quantity,
                            0,
                          )) /
                        100
                      ).toLocaleString("en-IN")}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="flex items-center gap-2">
                      <span className="sl-metric-label !text-[0.625rem]">
                        {t("cart.gst")}
                      </span>
                      <span className="sl-badge sl-badge-ok !text-[0.5rem]">
                        {t("cart.itemized")}
                      </span>
                    </dt>
                    <dd className="sl-num shrink-0 text-[0.875rem] font-semibold text-[var(--sl-ok)]">
                      ₹
                      {(
                        (cart.gstPaise ??
                          Math.max(
                            0,
                            cart.totalPaise -
                              (cart.subtotalPaise ??
                                cart.items.reduce(
                                  (sum, i) => sum + i.pricePaise * i.quantity,
                                  0,
                                )),
                          )) /
                        100
                      ).toLocaleString("en-IN")}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="sl-metric-label !text-[0.625rem]">
                      {t("cart.fulfill")}
                    </dt>
                    <dd className="sl-num shrink-0 text-[0.875rem] font-semibold text-[var(--sl-ink-2)]">
                      {(cart.shippingPaise ?? 0) === 0
                        ? t("cart.freeStandard")
                        : `₹${((cart.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                    </dd>
                  </div>
                </dl>

                {/* Payable total in its own sunk band: the only large figure
                    in the panel, so the eye lands on it first. */}
                <div className="mt-4 flex items-end justify-between gap-3 bg-[var(--sl-sunken)] px-3 py-3">
                  <div className="min-w-0">
                    <p className="sl-metric-label !text-[0.625rem]">
                      {t("cart.total")}
                    </p>
                    <p className="sl-meta mt-1 !text-[0.6875rem]">
                      {t("cart.includesGst")}
                    </p>
                  </div>
                  <p className="sl-num shrink-0 text-[1.5rem] font-extrabold leading-none tracking-tight text-[var(--sl-ink)]">
                    ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
                  </p>
                </div>

                {/* Checkout CTA */}
                {hasUnpricedItems ? (
                  <p className="mt-5 border border-[var(--sl-warn-line)] bg-[var(--sl-warn-soft)] px-3 py-2.5 text-center text-[0.8125rem] font-semibold text-[var(--sl-warn)]">
                    {t("price.onRequest")}
                  </p>
                ) : (
                <Link
                  href={cart.requiresLogin ? "/login" : "/checkout"}
                  className="sl-btn sl-btn-primary mt-6 hidden w-full md:inline-flex"
                >
                  <span>{t("cart.checkout")}</span>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </Link>
                )}

                {/*
                  Assurances. The previous version rendered `cart.genuine` TWICE
                  under two different icons (a padlock and a heart) and hardcoded
                  a third line in English, so the block read as three identical
                  claims. It is now one guarantee line plus a separate, translated
                  GST-invoicing line.
                */}
                <div className="mt-6 space-y-2.5 border-t border-[var(--sl-rule)] pt-5">
                  <p className="sl-meta flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--sl-ok)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{t("cart.genuine")}</span>
                  </p>
                  <p className="sl-meta flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--sl-ok)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a1.137 1.137 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{t("cart.gstInvoicing")}</span>
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Product Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("photo.viewingAria", { name: lightboxImage.name })}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxImage(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sl-overlay)] p-4 sm:p-6 backdrop-blur-sm sl-fade-in"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--sl-r-lg)] bg-[var(--sl-surface)] shadow-[var(--sl-e-3)] ring-1 ring-[var(--sl-brand-hover)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--sl-rule)] px-5 py-3.5 bg-[var(--sl-sunken)]/50">
              <div className="flex items-center gap-2">
                {lightboxImage.partNumber && (
                  <span className="rounded bg-[var(--sl-graphite-2)] px-2 py-0.5 font-mono text-xs font-bold text-white">
                    #{lightboxImage.partNumber}
                  </span>
                )}
                <h2 className="text-sm font-bold text-[var(--sl-ink)] truncate">
                  {lightboxImage.name}
                </h2>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label={t("common.close")}
                className="sl-focus flex h-8 w-8 items-center justify-center rounded-[2px] text-[var(--sl-ink-3)] transition-colors hover:bg-[var(--sl-sunken)] hover:text-[var(--sl-ink)] active:scale-95"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body / Image View */}
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-[var(--sl-sunken)] p-4 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-h-[60vh] w-full object-contain rounded-[2px] transition-transform"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/images/products/placeholder.svg";
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--sl-rule)] px-5 py-3 text-xs text-[var(--sl-ink-3)] bg-[var(--sl-surface)]">
              <span>{t("photo.certified")}</span>
              <span className="hidden sm:inline">{t("photo.closeHint")}</span>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
      {!loading && !isCartEmpty && cart && !hasUnpricedItems ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+var(--safe-bottom))] z-40 border-t border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 px-3 py-2 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="sl-metric-label !text-[0.5625rem]">{t("cart.total")}</p>
              <p className="sl-num truncate text-[1.125rem] font-extrabold text-[var(--sl-ink)]">
                ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
              </p>
            </div>
            <Link
              href={cart.requiresLogin ? "/login" : "/checkout"}
              className="sl-btn sl-btn-primary shrink-0 !min-h-12 px-5 !text-[0.875rem]"
            >
              {t("cart.checkout")}
            </Link>
          </div>
        </div>
      ) : null}
      <Suspense fallback={null}>
        <MobileBottomNav cartCount={cart?.itemCount ?? 0} />
      </Suspense>
    </div>
  );
}

