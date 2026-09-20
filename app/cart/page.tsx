/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
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

  async function loadCart() {
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
  }

  useEffect(() => {
    void loadCart();
  }, []);

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
      const newTotalPaise = updatedItems.reduce(
        (acc, item) => acc + item.pricePaise * item.quantity,
        0,
      );
      const newItemCount = updatedItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );
      setCart({
        ...cart,
        items: updatedItems,
        totalPaise: newTotalPaise,
        itemCount: newItemCount,
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
      const newTotalPaise = updatedItems.reduce(
        (acc, item) => acc + item.pricePaise * item.quantity,
        0,
      );
      const newItemCount = updatedItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );
      setCart({
        ...cart,
        items: updatedItems,
        totalPaise: newTotalPaise,
        itemCount: newItemCount,
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
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <StorefrontHeader cartCount={cart?.itemCount ?? 0} />

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        {/* Title & Stats */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("cart.title")}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <Link href="/" className="text-xs font-semibold text-[#7a1233] hover:underline">
                {t("cart.continue")}
              </Link>
              <SignOutButton />
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("cart.genuine")}</p>
          </div>
          {!loading && !isCartEmpty && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {cart?.itemCount} item{cart?.itemCount === 1 ? "" : "s"}
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
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="h-24 w-28 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 w-1/3 rounded bg-slate-200" />
                    <div className="h-4 w-1/4 rounded bg-slate-200" />
                    <div className="h-8 w-28 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && isCartEmpty && (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm sm:p-16">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
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
            <h2 className="mt-5 text-xl font-bold text-slate-900">
              {t("cart.emptyTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              {t("cart.emptyBody")}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
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
              aria-label="Cart items"
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
                    className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:p-5 ${
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
                            src: item.partNumber
                              ? `/images/products/${item.partNumber}.svg`
                              : "/images/products/placeholder.svg",
                            alt: item.partName || "Automotive part",
                            name: item.partName || "Automotive Spare Part",
                            partNumber: item.partNumber,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setLightboxImage({
                              src: item.partNumber
                                ? `/images/products/${item.partNumber}.svg`
                                : "/images/products/placeholder.svg",
                              alt: item.partName || "Automotive part",
                              name: item.partName || "Automotive Spare Part",
                              partNumber: item.partNumber,
                            });
                          }
                        }}
                        aria-label={`Enlarge image for ${item.partName || "part"}`}
                        className="relative aspect-[4/3] w-full shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-100 bg-slate-100 sm:w-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            item.partNumber
                              ? `/images/products/${item.partNumber}.svg`
                              : "/images/products/placeholder.svg"
                          }
                          alt={item.partName || "Automotive part"}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/images/products/placeholder.svg";
                          }}
                        />
                        {item.partBrand && (
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white backdrop-blur-xs">
                            {item.partBrand}
                          </span>
                        )}
                      </div>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                              {item.partName || "Automotive Spare Part"}
                            </h2>
                            {item.partNumber && (
                              <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-500">
                                <span>{t("product.partHash", { number: item.partNumber ?? "" })}</span>
                              </p>
                            )}
                          </div>
                          {/* Subtotal (mobile view) */}
                          <div className="text-right sm:hidden">
                            <span className="text-base font-bold text-slate-950">
                              ₹{itemTotalRupees.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* Distributor & Stock Meta */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          {item.firmName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 border border-emerald-200/60">
                              <svg
                                className="h-3 w-3 text-emerald-600"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Fulfilled by {item.firmName}
                            </span>
                          )}

                          {item.stock !== null && (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${
                                item.stock > 10
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {item.stock > 10
                                ? `${item.stock} in stock`
                                : `Only ${item.stock} left in stock`}
                            </span>
                          )}
                        </div>

                        {/* Controls & Pricing Bar */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3.5">
                          {/* Unit price */}
                          <div className="flex flex-col">
                            {isPriced ? (
                              <>
                            <span className="text-[11px] text-slate-500">
                              List ₹{listRupees.toLocaleString("en-IN")} · Incl. GST
                            </span>
                            <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              ₹{unitPriceRupees.toLocaleString("en-IN")}
                            </span>
                            {mrpRupees && mrpRupees > unitPriceRupees && (
                              <span className="text-xs text-slate-400 line-through">
                                ₹{mrpRupees.toLocaleString("en-IN")}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">/ unit net</span>
                            </div>
                            {(item.discountPercent ?? 0) > 0 ? (
                              <span className="text-[11px] font-semibold text-[#7a1233]">
                                {item.discountPercent}% Incl. Tax Discount
                              </span>
                            ) : null}
                              </>
                            ) : (
                              <span className="text-sm font-bold text-slate-800">
                                {t("price.onRequest")}
                              </span>
                            )}
                          </div>

                          {/* Controls: [ - ] qty [ + ] and Delete */}
                          <div className="flex items-center gap-4">
                            {/* Quantity Controls */}
                            <div className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50/70 p-0.5 shadow-xs">
                              <button
                                type="button"
                                onClick={() =>
                                  void updateQuantity(
                                    item.id,
                                    item.quantity - 1,
                                  )
                                }
                                disabled={!canDecrease}
                                aria-label={`Decrease quantity of ${item.partName || "item"}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white hover:text-slate-950 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                                className="flex h-8 w-10 items-center justify-center font-mono text-sm font-bold text-slate-900 select-none"
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
                                aria-label={`Increase quantity of ${item.partName || "item"}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white hover:text-slate-950 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
                              <span className="text-base font-bold text-slate-950">
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
                              aria-label={`Remove ${item.partName || "item"} from cart`}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* Order Summary Sidebar */}
            <aside aria-label="Order summary">
              <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  {t("cart.summary")}
                </h2>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t("cart.subtotal", { count: cart.itemCount })}</span>
                    <span className="font-semibold text-slate-900">
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

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <span>{t("cart.gst")}</span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                        Itemized
                      </span>
                    </span>
                    <span className="font-semibold text-emerald-700">
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

                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t("cart.fulfill")}</span>
                    <span className="font-semibold text-emerald-600">
                      {(cart.shippingPaise ?? 0) === 0
                        ? t("cart.freeStandard")
                        : `₹${((cart.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  <div className="border-t border-slate-200/80 pt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold text-slate-950">
                        {t("cart.total")}
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-slate-950">
                          ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {t("cart.includesGst")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout CTA */}
                {hasUnpricedItems ? (
                  <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm font-semibold text-amber-900">
                    {t("price.onRequest")}
                  </p>
                ) : (
                <Link
                  href={cart.requiresLogin ? "/login" : "/checkout"}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-center text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-slate-800 hover:shadow-lg active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
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
                <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-emerald-600 shrink-0"
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
                      className="h-4 w-4 text-emerald-600 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>GST Compliant Invoicing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 text-emerald-600 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M6.5 3c-1.05 0-2.05.4-2.8 1.15A3.98 3.98 0 002.5 7c0 1.9.9 3.5 2.3 4.6l5.2 4.4 5.2-4.4c1.4-1.1 2.3-2.7 2.3-4.6 0-1.1-.4-2.1-1.2-2.85A3.98 3.98 0 0013.5 3c-1.4 0-2.6.7-3.5 1.7A4.6 4.6 0 006.5 3z" />
                    </svg>
                    <span>{t("cart.genuine")}</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
              <div className="flex items-center gap-2">
                {lightboxImage.partNumber && (
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                    #{lightboxImage.partNumber}
                  </span>
                )}
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {lightboxImage.name}
                </h2>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label={t("common.close")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body / Image View */}
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-100 p-4 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-h-[60vh] w-full object-contain rounded-lg transition-transform"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/images/products/placeholder.svg";
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500 bg-white">
              <span>{t("photo.certified")}</span>
              <span className="hidden sm:inline">{t("photo.closeHint")}</span>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}

