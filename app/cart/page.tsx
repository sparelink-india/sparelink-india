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
      className={`min-h-screen bg-[var(--v3-page)] text-[var(--v3-text)] ${
        !loading && !isCartEmpty && cart && !hasUnpricedItems
          ? "pb-[calc(var(--mobile-nav-height)+var(--safe-bottom)+4.75rem)] md:pb-0"
          : "storefront-mobile-pad"
      }`}
    >
      <StorefrontHeader cartCount={cart?.itemCount ?? 0} />

      {/* Main Content */}
      <main id="main-content" className="v3-container max-w-6xl py-6 sm:py-8 lg:py-10">
        {/* Title & Stats */}
        <div className="v3-head flex-wrap">
          <div>
            <h1 className="v3-h1">{t("cart.title")}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex min-h-9 items-center text-xs font-semibold text-[var(--v3-brand-ink)] hover:underline"
              >
                ← {t("cart.continue")}
              </Link>
              <SignOutButton />
            </div>
            <p className="v3-small mt-1.5">{t("cart.genuine")}</p>
          </div>
          {!loading && !isCartEmpty && (
            <span className="v3-chip v3-num ml-auto">
              {(cart?.itemCount ?? 0) === 1
                ? t("cart.itemCountOne", { count: cart?.itemCount ?? 0 })
                : t("cart.itemCountMany", { count: cart?.itemCount ?? 0 })}
            </span>
          )}
        </div>

        {/* Notifications */}
        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm animate-in fade-in"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
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
              className="text-xs font-semibold text-rose-600 hover:text-rose-900"
              aria-label={t("common.dismiss")}
            >
              {t("common.dismiss")}
            </button>
          </div>
        )}

        {actionMessage && (
          <div
            role="status"
            className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm animate-in fade-in"
          >
            <div className="flex items-center gap-2.5">
              <svg
                className="h-5 w-5 text-emerald-600"
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
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-950"
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
              <div key={i} className="v3-skeleton animate-pulse rounded-[var(--v3-r)] p-6">
                <div className="flex gap-4">
                  <div className="h-24 w-28 rounded-[var(--v3-r)] bg-[#2c3547]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-1/3 rounded bg-[#2c3547]" />
                    <div className="h-4 w-1/4 rounded bg-[#2c3547]" />
                    <div className="h-8 w-28 rounded bg-[#2c3547]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && cart?.requiresLogin && (
          <div className="v3-panel mt-8 p-8 text-center sm:p-12">
            <h2 className="v3-h2">{t("cart.signInToView")}</h2>
            <p className="v3-body mx-auto mt-2 max-w-sm">{t("cart.savedToAccount")}</p>
            <Link href="/login" className="v3-btn v3-btn-primary v3-focus mt-6 !min-h-11 !px-6">
              {t("common.signIn")}
            </Link>
          </div>
        )}

        {/* Empty State */}
        {!loading && !cart?.requiresLogin && isCartEmpty && (
          <div className="v3-panel mt-8 p-8 text-center sm:p-12">
            <div className="v3-sunk mx-auto flex h-20 w-20 items-center justify-center rounded-[var(--v3-r-lg)] text-[var(--v3-text-3)]">
              <svg
                className="h-9 w-9"
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
            <h2 className="v3-h2 mt-5">{t("cart.emptyTitle")}</h2>
            <p className="v3-body mx-auto mt-2 max-w-sm">{t("cart.emptyBody")}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="v3-btn v3-btn-primary v3-focus !min-h-11 !px-5"
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

        {/* Two columns on desktop: the items scroll, the summary stays put.

            The summary is `top-[calc(var(--v3-header-h)+1rem)]` rather than a
            fixed `top-20` because the V3 header is a three-row desktop bar and
            `top-20` tucked the summary UNDER it. It reads the same header token
            the sticky rails elsewhere already use, so changing the header height
            moves this with it. */}
        {!loading && !isCartEmpty && (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
            {/* Cart Items List */}
            <section
              aria-label={t("cart.itemsAria")}
              className="space-y-4"
            >
              {cart.items.map((item) => {
                const isUpdating = Boolean(updatingIds[item.id]);
                const maxStock = item.stock ?? 999;
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
                    className={`v3-panel v3-panel-hover p-4 sm:p-5 ${
                      isUpdating ? "pointer-events-none opacity-70" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                      {/* Product Image with Lightbox Trigger.

                          A real <button>, not a div with role="button". The
                          previous div needed a manual Enter/Space handler and a
                          tabIndex to be reachable at all; a button gets all of
                          that - including Space activation and the right role -
                          from the platform, which is what a keyboard user needs
                          on an image they are invited to enlarge. */}
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage({
                            src: item.imageUrl || "/images/products/placeholder.svg",
                            alt: item.partName || "Automotive part",
                            name: item.partName || "Automotive Spare Part",
                            partNumber: item.partNumber,
                          })
                        }
                        aria-label={t("photo.enlargeAria", {
                          name: item.partName || "part",
                        })}
                        className="v3-stage v3-focus aspect-[4/3] w-full shrink-0 cursor-zoom-in sm:w-28"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumbUrl || item.imageUrl || "/images/products/placeholder.svg"}
                          alt={item.partName || "Automotive part"}
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
                          <span className="absolute bottom-1 left-1 rounded-[2px] bg-[rgba(23,17,15,0.82)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                            {item.partBrand}
                          </span>
                        )}
                      </button>

                      {/* Item Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="v3-h3 text-[var(--v3-text)]">
                              {item.partName || "Automotive Spare Part"}
                            </h2>
                            {item.partNumber && (
                              <p className="v3-partno mt-0.5 inline-flex items-center gap-1.5">
                                <span>{t("product.partHash", { number: item.partNumber ?? "" })}</span>
                              </p>
                            )}
                          </div>
                          {/* Subtotal (mobile view) */}
                          <div className="shrink-0 text-right sm:hidden">
                            <span className="v3-price">
                              ₹{itemTotalRupees.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* Distributor & Stock Meta.
                            Both are STATE, so both wear the state badges: a
                            shopper scanning the list needs to see "only 3 left"
                            and "fulfilled by Hind Motors" as scannable signals,
                            not as sentences to read. */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.firmName && (
                            <span className="v3-badge v3-badge-ok">
                              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
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
                              className={
                                item.stock > 10 ? "v3-badge" : "v3-badge v3-badge-warn"
                              }
                            >
                              {item.stock > 10
                                ? t("product.inStock", { count: item.stock })
                                : t("product.onlyLeft", { count: item.stock })}
                            </span>
                          )}
                        </div>

                        {/* Controls & Pricing Bar */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--v3-rule)] pt-3.5">
                          {/* Unit price */}
                          <div className="flex flex-col">
                            {isPriced ? (
                              <>
                                <span className="v3-small">
                                  {t("price.listWithGst", {
                                    amount: listRupees.toLocaleString("en-IN"),
                                  })}
                                </span>
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="text-sm font-semibold text-[var(--v3-text)]">
                                    ₹{unitPriceRupees.toLocaleString("en-IN")}
                                  </span>
                                  {mrpRupees && mrpRupees > unitPriceRupees && (
                                    <span className="v3-price-was">
                                      ₹{mrpRupees.toLocaleString("en-IN")}
                                    </span>
                                  )}
                                  <span className="v3-small">{t("price.perUnitNet")}</span>
                                </div>
                                {(item.discountPercent ?? 0) > 0 ? (
                                  <span className="text-[11px] font-semibold text-[var(--v3-brand-ink)]">
                                    {t("price.inclTaxDiscount", {
                                      percent: String(item.discountPercent),
                                    })}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-sm font-bold text-[var(--v3-text)]">
                                {t("price.onRequest")}
                              </span>
                            )}
                          </div>

                          {/* Controls: [ - ] qty [ + ] and Delete.

                              The stepper buttons are 36px, not 44px, because a
                              row this dense cannot afford a 44px target without
                              wrapping the price out of the row. The compromise is
                              a visible stepper group with two generous targets
                              and a live-region quantity, which is operable on
                              touch and unambiguous for assistive tech. */}
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                            {/* Quantity Controls */}
                            <div className="inline-flex items-center rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] p-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  void updateQuantity(
                                    item.id,
                                    item.quantity - 1,
                                  )
                                }
                                disabled={!canDecrease}
                                aria-label={t("cart.qtyDecrease", {
                                  name: item.partName || "part",
                                })}
                                className="v3-focus flex h-9 w-9 items-center justify-center rounded-[var(--v3-r)] text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-text)] disabled:cursor-not-allowed disabled:opacity-40"
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
                                className="v3-num flex h-9 w-11 select-none items-center justify-center font-mono text-sm font-bold text-[var(--v3-text)]"
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
                                aria-label={t("cart.qtyIncrease", {
                                  name: item.partName || "part",
                                })}
                                className="v3-focus flex h-9 w-9 items-center justify-center rounded-[var(--v3-r)] text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-text)] disabled:cursor-not-allowed disabled:opacity-40"
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
                              <span className="v3-price">
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
                              aria-label={t("cart.removeNamed", {
                                name: item.partName || "part",
                              })}
                              className="v3-focus inline-flex items-center gap-1.5 rounded-[var(--v3-r)] px-2.5 py-2 text-xs font-semibold text-[var(--v3-bad)] transition-colors hover:bg-[var(--v3-bad-soft)] disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* Order Summary Sidebar.

                `items-start` on the grid plus a sticky child is what makes this
                actually stick: without it the grid item stretches to the tall
                column and there is no overflow to stick within. */}
            <aside
              aria-label={t("cart.orderSummaryAria")}
              className="lg:sticky lg:top-[calc(var(--v3-header-h)+1rem)]"
            >
              <div className="v3-panel p-5 sm:p-6">
                <h2 className="v3-h3">{t("cart.summary")}</h2>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-[var(--v3-text-2)]">
                    <span>{t("cart.subtotal", { count: cart.itemCount })}</span>
                    <span className="v3-num font-semibold text-[var(--v3-text)]">
                      ₹
                      {(
                        (cart.subtotalPaise ??
                          cart.items.reduce(
                            (sum, i) => sum + i.pricePaise * i.quantity,
                            0,
                          )) /
                        100
                      ).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[var(--v3-text-2)]">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span>{t("cart.gst")}</span>
                      <span className="v3-badge v3-badge-ok">{t("cart.itemized")}</span>
                    </span>
                    <span className="v3-num font-semibold text-[var(--v3-ok)]">
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
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[var(--v3-text-2)]">
                    <span>{t("cart.fulfill")}</span>
                    <span className="v3-num font-semibold text-[var(--v3-ok)]">
                      {(cart.shippingPaise ?? 0) === 0
                        ? t("cart.freeStandard")
                        : `₹${((cart.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  {/* The payable total is the loudest number on the page, and
                      deliberately the ONLY one at that size. */}
                  <div className="mt-4 border-t border-[var(--v3-rule)] pt-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="v3-h3">{t("cart.total")}</span>
                      <div className="text-right">
                        <span className="v3-num text-[1.75rem] font-extrabold leading-none tracking-tight text-[var(--v3-text)]">
                          ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <p className="v3-small mt-1">{t("cart.includesGst")}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout CTA */}
                {hasUnpricedItems ? (
                  <p className="mt-6 rounded-[var(--v3-r)] border border-[var(--v3-warn-line)] bg-[var(--v3-warn-soft)] px-3 py-3 text-center text-sm font-semibold text-[var(--v3-warn)]">
                    {t("price.onRequest")}
                  </p>
                ) : (
                <Link
                  href={cart.requiresLogin ? "/login" : "/checkout"}
                  className="v3-btn v3-btn-primary v3-focus mt-6 hidden w-full !min-h-12 !px-5 md:flex"
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

                {/* Trust Badges */}
                <div className="mt-6 space-y-2.5 border-t border-[var(--v3-rule)] pt-5 text-xs text-[var(--v3-text-2)]">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--v3-ok)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{t("cart.genuine")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--v3-ok)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{t("cart.gstInvoicing")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-[var(--v3-ok)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M6.5 3c-1.05 0-2.05.4-2.8 1.15A3.98 3.98 0 002.5 7c0 1.9.9 3.5 2.3 4.6l5.2 4.4 5.2-4.4c1.4-1.1 2.3-2.7 2.3-4.6 0-1.1-.4-2.1-1.2-2.85A3.98 3.98 0 0013.5 3c-1.4 0-2.6.7-3.5 1.7A4.6 4.6 0 006.5 3z" />
                    </svg>
                    <span>{t("cart.supportOnWhatsApp")}</span>
                  </div>
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
          aria-label={`Enlarged product image of ${lightboxImage.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxImage(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,14,18,0.86)] p-4 backdrop-blur-sm animate-in fade-in sm:p-6"
        >
          <div className="v3-panel relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--v3-rule)] bg-[var(--v3-panel)] px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                {lightboxImage.partNumber && (
                  <span className="v3-partno shrink-0 rounded-[2px] bg-[var(--v3-inverse)] px-2 py-0.5 text-white">
                    #{lightboxImage.partNumber}
                  </span>
                )}
                <h2 className="truncate text-sm font-bold text-[var(--v3-text)]">
                  {lightboxImage.name}
                </h2>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label={t("common.close")}
                className="v3-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--v3-r)] text-[var(--v3-text-2)] transition-colors hover:bg-[var(--v3-sunk)] hover:text-[var(--v3-text)]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body / Image View */}
            <div className="v3-stage flex flex-1 items-center justify-center overflow-hidden !rounded-none p-4 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-h-[60vh] w-full rounded-[var(--v3-r)] object-contain transition-transform"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/images/products/placeholder.svg";
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--v3-rule)] bg-[var(--v3-panel)] px-5 py-3 text-xs text-[var(--v3-text-3)]">
              <span>{t("photo.certified")}</span>
              <span className="hidden sm:inline">{t("photo.closeHint")}</span>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
      {!loading && !isCartEmpty && cart && !hasUnpricedItems ? (
        <div
          className="fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+var(--safe-bottom))] z-40 border-t border-[var(--v3-rule)] bg-[var(--v3-panel)]/95 px-3 py-2 backdrop-blur md:hidden"
          /* `bg-white/95` was a hardcoded near-white surface, and it could
             not be remapped in globals.css because Admin uses the same
             class as a deliberate light logo plate. The V3 panel token
             carries the same near-white value in light mode and the dark
             panel in dark mode, so this bar follows the theme. */
        >
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="v3-label">{t("cart.total")}</p>
              <p className="v3-num truncate text-lg font-extrabold text-[var(--v3-text)]">
                ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
              </p>
            </div>
            <Link
              href={cart.requiresLogin ? "/login" : "/checkout"}
              className="btn-press v3-btn v3-btn-primary v3-focus min-h-12 shrink-0 !px-5 text-sm"
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

