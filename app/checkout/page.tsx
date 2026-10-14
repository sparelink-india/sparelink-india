"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateGSTIN } from "@/lib/gst";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

type CartItem = {
  id: string;
  quantity: number;
  pricePaise: number;
  partName: string | null;
  partNumber: string | null;
  gstRate?: number;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  itemSubtotalPaise?: number;
  itemGstPaise?: number;
  itemTotalPaise?: number;
  firmId?: string | null;
  firmName?: string | null;
  isPensol?: boolean;
  pensolUnit?: string | null;
  pensolPackUnits?: number | null;
  pensolCashDiscountPaisePerUnit?: number;
  pensolCreditDiscountPaisePerUnit?: number;
  pensolCashNetInclusivePaise?: number;
  pensolCreditNetInclusivePaise?: number;
};

type CartData = {
  id: string | null;
  items: CartItem[];
  subtotalPaise?: number;
  gstPaise?: number;
  shippingPaise?: number;
  totalPaise: number;
  itemCount?: number;
  requiresLogin?: boolean;
  hasPensol?: boolean;
  pensolCashTotalPaise?: number;
  pensolCreditTotalPaise?: number;
};

/* Checkout progression labels, in completion order. Rendered as a static
   numbered rail: the checkout is one page, so these are not navigation.

   The ORDER is the real flow this page implements and is deliberately not
   rearranged. It is Customer -> Address -> Delivery -> Payment -> Review,
   because the payment method is chosen before the final review is submitted,
   and confirmation is the result of submitting rather than a step the customer
   walks through. Relabelling these to a prettier sequence would misdescribe
   what actually happens. */
const CHECKOUT_STEPS = [
  "checkout.stepCustomer",
  "checkout.stepAddress",
  "checkout.stepDelivery",
  "checkout.stepPayment",
  "checkout.stepReview",
] as const;

/**
 * V3 checkout progress rail.
 *
 * Replaces a 2/3/5-column grid of five separate bordered boxes. That grid had
 * two problems: at `sm` and `md` it wrapped into two and three rows, so the
 * "progression" read as a wrapped list rather than a sequence; and each step
 * was a closed box, so there was no visual thread running through the five of
 * them.
 *
 * V3 is a rail: numbered nodes joined by a 1px connector, so the five steps
 * read as one ordered thing. The node number is set in tabular monospace and
 * zero-padded, which is what makes it a document outline rather than a row of
 * circles.
 *
 * ON MOBILE the labels are replaced by the count ("3 / 5") plus the current
 * step, because five labelled nodes cannot fit a 375px screen without either
 * truncating every label or wrapping the rail.
 *
 * Nothing here is interactive. The whole checkout is one form on one page, so
 * the rail is an orientation aid, and it is marked up as an ordered list with
 * `aria-current="step"` on the node the customer is working through.
 */
function CheckoutRail({
  steps,
  label,
}: {
  /* MessageKey, not string: `t` only accepts keys from the dictionary, and
     widening to `string` silently loses that check for every future step. */
  steps: readonly MessageKey[];
  label: string;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={label} className="mt-5">
      {/* ---- mobile: compact indicator ---- */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="sl-metric-label flex items-center gap-2">
            <span
              className="inline-block h-[3px] w-5 bg-[var(--sl-brand)]"
              aria-hidden
            />
            {t(steps[0])}
          </p>
          <p className="sl-num shrink-0 text-[0.75rem] font-bold text-[var(--sl-ink-3)]">
            5 {t("checkout.stepsLabel")}
          </p>
        </div>
        {/* Five segments; all filled, because the page is one form and every
            step is on screen at once. The bar communicates scale, not
            completion — a partially filled bar would be a false claim. */}
        <ol className="mt-2 flex gap-1" aria-label={label}>
          {steps.map((step) => (
            <li
              key={step}
              className="h-1 flex-1 rounded-[1px] bg-[var(--sl-brand)]"
              aria-hidden
            >
              <span className="sr-only">{t(step)}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ---- desktop: the full rail ---- */}
      <ol className="hidden lg:flex lg:items-stretch">
        {steps.map((step, index) => {
          const isFirst = index === 0;
          return (
            <li
              key={step}
              aria-current={isFirst ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] text-[0.6875rem] font-bold tabular-nums ${
                    isFirst
                      ? "bg-[var(--sl-brand)] text-white"
                      : "border border-[var(--sl-rule-strong)] bg-[var(--sl-surface)] text-[var(--sl-ink-3)]"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={`sl-nav min-w-0 truncate ${
                    isFirst
                      ? "text-[var(--sl-ink)]"
                      : "text-[var(--sl-ink-3)]"
                  }`}
                >
                  {t(step)}
                </span>
              </span>
              {/* The connector. Skipped on the last node so the rail terminates
                  cleanly instead of trailing a stray rule. */}
              {index < steps.length - 1 ? (
                <span
                  className="mx-3 h-px min-w-4 flex-1 bg-[var(--sl-rule)]"
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [pensolSettlement, setPensolSettlement] = useState<"cash" | "credit">("cash");
  const [onlineCapableFirmIds, setOnlineCapableFirmIds] = useState<string[]>(
    [],
  );

  // Address & Profile Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // B2B / GST Fields
  const [gstinInput, setGstinInput] = useState("");
  const [businessNameInput, setBusinessNameInput] = useState("");

  // Fulfillment & Transport Fields
  const [shippingMethod, setShippingMethod] = useState<"self_pickup" | "transport" | "courier">("courier");
  const [transportName, setTransportName] = useState("");
  const [transportPhone, setTransportPhone] = useState("");
  const [transportGstin, setTransportGstin] = useState("");
  const [addressPrefilled, setAddressPrefilled] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [checkoutKey] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const values = new Uint32Array(4);
      crypto.getRandomValues(values);
      return `checkout-${Array.from(values, (value) => value.toString(16)).join("")}`;
    }
    return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
  const idempotencyKeyRef = useRef<string>(checkoutKey);

  const gstinValidation = gstinInput.trim()
    ? validateGSTIN(gstinInput)
    : null;

  useEffect(() => {
    async function loadData() {
      try {
        const [cartRes, profileRes, cashfreeRes] = await Promise.all([
          fetch("/api/cart", { cache: "no-store" }),
          fetch("/api/profile", { cache: "no-store" }).catch(() => null),
          fetch("/api/payments/cashfree/config", { cache: "no-store" }).catch(
            () => null,
          ),
        ]);

        const cartData = await cartRes.json();
        if (!cartRes.ok) throw new Error(cartData.error || t("cart.loadFail"));
        if (cartData.requiresLogin) {
          router.replace("/login");
          return;
        }
        setCart(cartData);

        if (cashfreeRes && cashfreeRes.ok) {
          const cashfreeData = await cashfreeRes.json();
          if (Array.isArray(cashfreeData.configuredFirmIds)) {
            setOnlineCapableFirmIds(cashfreeData.configuredFirmIds);
          }
        }

        if (profileRes && profileRes.ok) {
          const prof = await profileRes.json();
          if (prof) {
            if (prof.contactName) setFullName(prof.contactName);
            if (prof.phoneNumber) setPhone(prof.phoneNumber);
            if (prof.businessName) setBusinessNameInput(prof.businessName);
            if (prof.gstin) setGstinInput(prof.gstin);
            if (prof.shippingAddressLine1) setAddressLine1(prof.shippingAddressLine1);
            if (prof.shippingAddressLine2) setAddressLine2(prof.shippingAddressLine2);
            if (prof.shippingCity) setCity(prof.shippingCity);
            if (prof.shippingState) setState(prof.shippingState);
            if (prof.shippingPincode) setPincode(prof.shippingPincode);
            if (prof.shippingPreference) setShippingMethod(prof.shippingPreference);
            if (prof.transportName) setTransportName(prof.transportName);
            if (prof.transportPhone) setTransportPhone(prof.transportPhone);
            if (prof.transportGstin) setTransportGstin(prof.transportGstin);
            setAddressPrefilled(
              Boolean(
                prof.contactName ||
                  prof.phoneNumber ||
                  prof.shippingAddressLine1 ||
                  prof.shippingCity ||
                  prof.shippingState ||
                  prof.shippingPincode,
              ),
            );
          }
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("checkout.loadFail"),
        );
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [router, t]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 120);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    if (gstinInput.trim() && gstinValidation && !gstinValidation.valid) {
      setError(t("profile.gstinInvalid"));
      setSubmitting(false);
      return;
    }

    if (effectivePaymentMethod === "online_payment" && !cartSupportsOnlinePayment) {
      setError(
        t("checkout.onlineUnavailable"),
      );
      setSubmitting(false);
      return;
    }

    if (shippingMethod === "transport" && !transportName.trim()) {
      setError(t("checkout.transporterRequired"));
      setSubmitting(false);
      return;
    }

    const unpricedItem = cart?.items.find(
      (item) =>
        !isAuthoritativeSellingPricePaise(
          item.listInclusivePaise,
          item.netInclusivePaise,
          item.pricePaise,
        ),
    );
    if (unpricedItem) {
      setError(t("price.onRequest"));
      setSubmitting(false);
      return;
    }

    const shippingAddress = {
      name: fullName.trim(),
      phone: phone.trim(),
      pincode: pincode.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          shippingAddress,
          paymentMethod: effectivePaymentMethod,
          buyerGstin: gstinInput.trim().toUpperCase() || undefined,
          buyerBusinessName: businessNameInput.trim() || undefined,
          shippingMethod,
          transportName: shippingMethod === "transport" ? transportName.trim() : undefined,
          transportPhone: shippingMethod === "transport" ? transportPhone.trim() : undefined,
          transportGstin: shippingMethod === "transport" && transportGstin.trim() ? transportGstin.trim().toUpperCase() : undefined,
          pensolSettlement,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("checkout.placeFail"));
      if (
        effectivePaymentMethod === "online_payment" ||
        effectivePaymentMethod === "bank_transfer"
      ) {
        router.push(`/orders/${data.id}/payment`);
      } else {
        router.push(
          `/order-confirmation/${data.id}?number=${encodeURIComponent(data.orderNumber)}`,
        );
      }
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : t("checkout.placeFail"),
      );
      setSubmitting(false);
    }
  }

  const itemsSubtotalPaise =
    cart?.subtotalPaise ??
    (cart?.items.reduce(
      (acc, item) => acc + item.pricePaise * item.quantity,
      0,
    ) ?? 0);

  const gstPaise =
    cart?.gstPaise ??
    Math.max(0, (cart?.totalPaise ?? 0) - itemsSubtotalPaise);

  const shippingPaise = cart?.shippingPaise ?? 0;
  const hasPensol = Boolean(cart?.hasPensol || cart?.items.some((item) => item.isPensol));
  const grandTotalPaise =
    hasPensol
      ? pensolSettlement === "credit"
        ? cart?.pensolCreditTotalPaise ?? cart?.totalPaise ?? 0
        : cart?.pensolCashTotalPaise ?? cart?.totalPaise ?? 0
      : cart?.totalPaise ?? itemsSubtotalPaise + gstPaise + shippingPaise;
  const onlineCapableSet = new Set(onlineCapableFirmIds);
  const cartFirmIds = [
    ...new Set(
      (cart?.items ?? [])
        .map((item) => item.firmId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  /** Same rule as POST /api/orders: every cart firm must have Cashfree (no Easy Split). */
  const cartSupportsOnlinePayment =
    cartFirmIds.length > 0 &&
    cartFirmIds.every((firmId) => onlineCapableSet.has(firmId));
  const firmBreakdown = useMemo(() => {
    const groups = new Map<
      string,
      { firmName: string; itemCount: number; totalPaise: number }
    >();
    for (const item of cart?.items ?? []) {
      const key = item.firmId || item.firmName || "unassigned";
      const existing = groups.get(key);
      const lineTotal =
        item.itemTotalPaise ??
        (item.netInclusivePaise ?? item.pricePaise) * item.quantity;
      if (existing) {
        existing.itemCount += 1;
        existing.totalPaise += lineTotal;
      } else {
        groups.set(key, {
          firmName: item.firmName || t("checkout.fulfillmentFirm"),
          itemCount: 1,
          totalPaise: lineTotal,
        });
      }
    }
    return [...groups.values()];
  }, [cart?.items, t]);
  const effectivePaymentMethod =
    paymentMethod === "online_payment" && !cartSupportsOnlinePayment
      ? "cash_on_delivery"
      : paymentMethod;

  const placeOrderLabel =
    effectivePaymentMethod === "online_payment"
      ? t("checkout.placeOnline")
      : paymentMethod === "bank_transfer"
        ? t("checkout.placeBank")
        : t("checkout.placeCod");
  const showMobileCheckoutCta =
    !loading && Boolean(cart?.items.length) && !keyboardOpen;

  return (
    <div
      className={`flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)] ${
        cart && cart.items.length > 0
          ? "pb-[calc(var(--mobile-nav-height)+var(--safe-bottom)+4.75rem)] md:pb-0"
          : "storefront-mobile-pad"
      }`}
    >
      <StorefrontHeader cartCount={cart?.itemCount ?? 0} />

      {/* The checkout body is this page's <main>. It was a <div>, which
          left /checkout as the only customer route with no main landmark. */}
      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <Link href="/cart" className="text-xs font-semibold text-[var(--sl-brand-ink)] hover:underline">
            {t("cart.continue")}
          </Link>
          <SignOutButton />
        </div>
        {/*
          Checkout progression. These are numbered labels, not navigation:
          the whole form is on one page, so nothing here is clickable and no
          step is hidden. Numbering communicates the order of completion
          without implying a wizard the page does not have.
        */}
        <CheckoutRail steps={CHECKOUT_STEPS} label={t("checkout.stepsLabel")} />

        <h1 className="sl-h1">
          {t("cart.checkout")}
        </h1>
        <p className="mt-1 text-sm text-[var(--sl-ink-3)]">
          {t("cart.genuine")}
        </p>

        {loading && (
          <div className="mt-6 space-y-4 sm:mt-8">
            <div className="sl-panel p-4 sm:p-6" aria-busy="true" aria-live="polite">
              <div className="sl-skel h-6 w-2/5" />
              <div className="sl-skel mt-3 h-11 w-full" />
              <div className="sl-skel mt-3 h-11 w-full" />
              <div className="sl-skel mt-3 h-11 w-3/5" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-[var(--sl-r)] border border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] p-3 text-sm font-medium text-[var(--sl-bad)] sm:p-4"
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
            <div className="min-w-0 flex-1 break-words">{error}</div>
          </div>
        )}

        {!loading && !error && (!cart || !cart.items.length) && (
          <div className="mt-6 rounded-[var(--sl-r-lg)] border border-dashed border-[var(--sl-rule-strong)] bg-[var(--sl-surface)] p-8 text-center shadow-xs sm:mt-8 sm:p-12">
            <p className="font-bold text-[var(--sl-ink)]">{t("cart.emptyTitle")}</p>
            <p className="mt-1 text-sm text-[var(--sl-ink-3)]">
              {t("cart.emptyBody")}
            </p>
            <Link
              href="/"
              className="sl-btn sl-btn-primary sl-press mt-5 text-xs"
            >
              {t("cart.find")}
            </Link>
          </div>
        )}

        {!loading && cart && cart.items.length > 0 && (
          <form
            id="checkout-form"
            aria-busy={submitting}
            onSubmit={placeOrder}
            className="mt-6 grid gap-5 sm:mt-8 lg:grid-cols-[1fr_360px] lg:gap-8"
          >
            {/* Delivery Address & Payment Method Form */}
            <div className="min-w-0 space-y-4 sm:space-y-6">
              <section className="sl-panel p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="sl-h2 flex items-center gap-2.5 text-base sm:text-lg">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-[var(--sl-brand)] text-[0.6875rem] font-bold text-white tabular-nums">1</span>
                    {t("checkout.addressTitle")}
                  </h2>
                  {addressPrefilled ? (
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--sl-ok)]">
                      {t("checkout.prefilled")}
                    </span>
                  ) : null}
                </div>
                <p className="sl-hint">
                  {t("checkout.addressHint")}
                </p>

                <div className="mt-4 grid gap-3 min-[390px]:gap-4 sm:mt-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="sl-label">
                      {t("register.fullName")} <span className="text-[var(--sl-bad)]">*</span>
                    </span>
                    <input
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("checkout.phName")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="sl-label">
                      {t("checkout.mobile10")} <span className="text-[var(--sl-bad)]">*</span>
                    </span>
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91XXXXXXXXXX"
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="sl-label">
                      {t("profile.pincode")} <span className="text-[var(--sl-bad)]">*</span>
                    </span>
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder={t("profile.phPincode")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="sl-label">
                      {t("checkout.line1")} <span className="text-[var(--sl-bad)]">*</span>
                    </span>
                    <input
                      required
                      autoComplete="address-line1"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder={t("checkout.phLine1")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="sl-label">
                      {t("checkout.landmarkOptional")}
                    </span>
                    <input
                      autoComplete="address-line2"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder={t("checkout.phLandmark")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="sl-label">
                      {t("checkout.cityDistrict")} <span className="text-[var(--sl-bad)]">*</span>
                    </span>
                    <input
                      required
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t("checkout.phCity")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="sl-label">
                      {t("checkout.state")} <span className="text-[var(--sl-bad)]">*</span>
                    </span>
                    <input
                      required
                      autoComplete="address-level1"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder={t("checkout.phState")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>
                </div>
              </section>

              {/* Fulfillment & Transport Preference */}
              <section className="sl-panel p-4 sm:p-6">
                <h2 className="sl-h2 flex items-center gap-2.5 text-base sm:text-lg">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-[var(--sl-brand)] text-[0.6875rem] font-bold text-white tabular-nums">2</span>
                  {t("checkout.fulfillTitle")}
                </h2>
                <p className="sl-hint">
                  {t("checkout.fulfillHint")}
                </p>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 min-[390px]:grid-cols-3 min-[390px]:gap-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3 text-xs font-bold text-[var(--sl-ink)] has-checked:border-[var(--sl-brand-hover)] has-checked:bg-[var(--sl-brand-soft)]/60 sm:p-3.5">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="courier"
                        checked={shippingMethod === "courier"}
                        onChange={() => setShippingMethod("courier")}
                        className="sl-check shrink-0"
                      />
                      <span className="leading-snug">{t("register.courier")}</span>
                    </label>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3 text-xs font-bold text-[var(--sl-ink)] has-checked:border-[var(--sl-brand-hover)] has-checked:bg-[var(--sl-brand-soft)]/60 sm:p-3.5">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="self_pickup"
                        checked={shippingMethod === "self_pickup"}
                        onChange={() => setShippingMethod("self_pickup")}
                        className="sl-check shrink-0"
                      />
                      <span className="leading-snug">{t("register.pickup")}</span>
                    </label>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3 text-xs font-bold text-[var(--sl-ink)] has-checked:border-[var(--sl-brand-hover)] has-checked:bg-[var(--sl-brand-soft)]/60 sm:p-3.5">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="transport"
                        checked={shippingMethod === "transport"}
                        onChange={() => setShippingMethod("transport")}
                        className="sl-check shrink-0"
                      />
                      <span className="leading-snug">{t("register.transport")}</span>
                    </label>
                  </div>

                  {shippingMethod === "transport" && (
                    <div className="space-y-3 rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-sunken)] p-3 sl-fade-in sm:p-4">
                      <p className="text-xs font-bold text-[var(--sl-ink)]">
                        {t("checkout.transportDetails")}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="min-w-0">
                          <label
                            htmlFor="co-transport-name"
                            className="sl-label"
                          >
                            {t("checkout.transporterName")} <span className="text-[var(--sl-bad)]">*</span>
                          </label>
                          <input
                            id="co-transport-name"
                            name="transportName"
                            required={shippingMethod === "transport"}
                            value={transportName}
                            onChange={(e) => setTransportName(e.target.value)}
                            placeholder={t("checkout.phTransporter")}
                            className="sl-input h-11 w-full min-w-0 text-xs sm:h-10"
                          />
                        </div>

                        <div className="min-w-0">
                          <label
                            htmlFor="co-transport-phone"
                            className="sl-label"
                          >
                            {t("checkout.transportContact")}
                          </label>
                          <input
                            id="co-transport-phone"
                            name="transportPhone"
                            type="tel"
                            inputMode="tel"
                            value={transportPhone}
                            onChange={(e) => setTransportPhone(e.target.value)}
                            placeholder={t("checkout.phTransportPhone")}
                            className="sl-input h-11 w-full min-w-0 text-xs sm:h-10"
                          />
                        </div>

                        <div className="min-w-0">
                          <label
                            htmlFor="co-transport-gstin"
                            className="sl-label"
                          >
                            {t("checkout.transportGstin")}
                          </label>
                          <input
                            id="co-transport-gstin"
                            name="transportGstin"
                            maxLength={15}
                            value={transportGstin}
                            onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                            placeholder={t("profile.phTransportGstin")}
                            className="sl-input h-11 w-full min-w-0 px-3 font-mono text-xs sm:h-10"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* B2B / GST Information */}
              <section className="sl-panel p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="sl-h2 flex items-center gap-2.5 text-base sm:text-lg">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-[var(--sl-brand)] text-[0.6875rem] font-bold text-white tabular-nums">3</span>
                    {t("checkout.gstTitle")}
                  </h2>
                  <span className="shrink-0 rounded bg-[var(--sl-sunken)] px-2 py-0.5 text-[10px]  tracking-wider text-[var(--sl-ink-2)]">
                    {t("checkout.b2bBadge")}
                  </span>
                </div>
                <p className="sl-hint">
                  {t("checkout.gstHint")}
                </p>

                <div className="mt-4 grid gap-3 min-[390px]:gap-4 sm:mt-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="sl-label">
                      {t("register.business")}
                    </span>
                    <input
                      value={businessNameInput}
                      onChange={(e) => setBusinessNameInput(e.target.value)}
                      placeholder={t("checkout.phBusiness")}
                      className="sl-input h-11 w-full min-w-0 sm:px-3.5"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="sl-label">
                      {t("checkout.buyerGstin")}
                    </span>
                    <input
                      value={gstinInput}
                      onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                      maxLength={15}
                      autoCapitalize="characters"
                      placeholder={t("register.phGstin")}
                      className={`sl-input h-11 w-full min-w-0 px-3 font-mono sm:px-3.5 ${
                        gstinInput.trim() && gstinValidation
                          ? gstinValidation.valid
                            ? "border-[var(--sl-ok)] text-[var(--sl-ok)]"
                            : "border-[var(--sl-bad-line)] text-[var(--sl-bad)]"
                          : ""
                      }`}
                    />

                    {/* GST Validation Status Banner */}
                    {gstinInput.trim() && gstinValidation && (
                      <div
                        className={`mt-2 flex items-start gap-1.5 rounded-[2px] p-2 text-xs font-medium ${
                          gstinValidation.valid
                            ? "border border-[var(--sl-rule-strong)] bg-[var(--sl-ok-soft)] text-[var(--sl-ok)]"
                            : "border border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] text-[var(--sl-bad)]"
                        }`}
                      >
                        {gstinValidation.valid ? (
                          <>
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sl-ok)]" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            <span className="min-w-0 break-words">
                              {gstinValidation.message} · {t("checkout.state")}: {gstinValidation.stateName}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sl-bad)]" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span className="min-w-0 break-words">{gstinValidation.message}</span>
                          </>
                        )}
                      </div>
                    )}
                  </label>
                </div>
              </section>

              <section className="sl-panel p-4 sm:p-6">
                <h2 className="sl-h2 flex items-center gap-2.5 text-base sm:text-lg">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] bg-[var(--sl-brand)] text-[0.6875rem] font-bold text-white tabular-nums">4</span>
                  {t("checkout.payTitle")}
                </h2>
                <p className="sl-hint">
                  {t("checkout.payHint")}
                </p>

                {hasPensol ? (
                  <div className="mt-4 space-y-3 rounded-[var(--sl-r)] border border-[var(--sl-rule-strong)] bg-[var(--sl-warn-soft)] p-3 sm:p-4">
                    <p className="text-sm font-bold text-[var(--sl-ink)]">{t("checkout.pensolPayTitle")}</p>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="pensolSettlement"
                        checked={pensolSettlement === "cash"}
                        onChange={() => setPensolSettlement("cash")}
                        className="sl-check mt-1 shrink-0"
                      />
                      <span className="min-w-0 text-sm leading-snug">
                        {t("checkout.pensolCash")}
                      </span>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="pensolSettlement"
                        checked={pensolSettlement === "credit"}
                        onChange={() => setPensolSettlement("credit")}
                        className="sl-check mt-1 shrink-0"
                      />
                      <span className="min-w-0 text-sm leading-snug">
                        {t("checkout.pensolCredit")}
                      </span>
                    </label>
                    <p className="break-words text-xs text-[var(--sl-ink-2)]">
                      {cart?.items
                        .filter((item) => item.isPensol)
                        .map((item) => {
                          const unit = (item.pensolUnit || "unit").toUpperCase();
                          const amount =
                            pensolSettlement === "credit"
                              ? item.pensolCreditDiscountPaisePerUnit ?? 0
                              : item.pensolCashDiscountPaisePerUnit ?? 0;
                          return `${item.partName || "Pensol"}: ₹${(amount / 100).toLocaleString("en-IN")} / ${unit}`;
                        })
                        .join(" · ")}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3.5 transition-colors hover:bg-[var(--sl-sunken)] has-checked:border-[var(--sl-brand-hover)] has-checked:bg-[var(--sl-brand-soft)]/60 sm:gap-3.5 sm:p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash_on_delivery"
                      checked={effectivePaymentMethod === "cash_on_delivery"}
                      onChange={() => setPaymentMethod("cash_on_delivery")}
                      className="sl-check mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-[var(--sl-ink)]">
                        {t("checkout.cod")}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--sl-ink-3)]">
                        {t("checkout.codHint")}
                      </span>
                    </div>
                  </label>

                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3.5 transition-colors hover:bg-[var(--sl-sunken)] has-checked:border-[var(--sl-brand-hover)] has-checked:bg-[var(--sl-brand-soft)]/60 sm:gap-3.5 sm:p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={effectivePaymentMethod === "bank_transfer"}
                      onChange={() => setPaymentMethod("bank_transfer")}
                      className="sl-check mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-[var(--sl-ink)]">
                        {t("checkout.bank")}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--sl-ink-3)]">
                        {t("checkout.bankHint")}
                      </span>
                    </div>
                  </label>

                  {cartSupportsOnlinePayment ? (
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3.5 transition-colors hover:bg-[var(--sl-sunken)] has-checked:border-[var(--sl-brand-hover)] has-checked:bg-[var(--sl-brand-soft)]/60 sm:gap-3.5 sm:p-4">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="online_payment"
                        checked={effectivePaymentMethod === "online_payment"}
                        onChange={() => setPaymentMethod("online_payment")}
                        className="sl-check mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-[var(--sl-ink)]">
                          {t("checkout.online")}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-[var(--sl-ink-3)]">
                          {t("checkout.onlineHint")}
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="rounded-[var(--sl-r)] border border-dashed border-[var(--sl-rule-strong)] bg-[var(--sl-sunken)] p-3.5 sm:p-4">
                      <span className="block text-sm font-bold text-[var(--sl-ink)]">
                        {t("checkout.comingSoon")}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--sl-ink-3)]">
                        {t("checkout.onlineUnavailable")}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Authoritative Order Summary Sidebar */}
            <aside aria-label={t("checkout.summary")} className="min-w-0 lg:sticky lg:top-24">
              <div className="rounded-[var(--sl-r-lg)] border border-[var(--sl-rule)] bg-[var(--sl-surface)] p-4 shadow-sm sm:p-6 lg:sticky lg:top-20">
                <h2 className="sl-h2 text-base sm:text-lg">
                  {t("checkout.summary")}
                </h2>

                {/* Line Items */}
                <div className="mt-4 divide-y divide-[var(--sl-rule)] border-b border-[var(--sl-rule)] pb-4 text-xs">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-[var(--sl-ink)]">
                          {item.partName || t("checkout.sparePart")} × {item.quantity}
                        </p>
                        <p className="mt-0.5 break-words text-[var(--sl-ink-3)]">
                          {isAuthoritativeSellingPricePaise(
                            item.listInclusivePaise,
                            item.netInclusivePaise,
                            item.pricePaise,
                          )
                            ? `${t("price.listRate")}: ₹${(((item.listInclusivePaise ?? item.pricePaise) * item.quantity) / 100).toLocaleString("en-IN")}`
                            : t("price.onRequest")}
                          {item.gstRate !== undefined && (
                            <span className="ml-1.5 font-medium text-[var(--sl-ok)]">
                              (GST {item.gstRate}%)
                            </span>
                          )}
                        </p>
                        {(item.discountPercent ?? 0) > 0 ? (
                          <p className="text-[11px] font-semibold text-[var(--sl-brand-ink)]">
                            {t("price.inclTaxDiscount", { percent: String(item.discountPercent) })}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 tabular-nums font-bold text-[var(--sl-ink)]">
                        {isAuthoritativeSellingPricePaise(
                          item.listInclusivePaise,
                          item.netInclusivePaise,
                          item.pricePaise,
                        )
                          ? `₹${(
                              ((item.isPensol
                                ? ((pensolSettlement === "credit"
                                    ? item.pensolCreditNetInclusivePaise
                                    : item.pensolCashNetInclusivePaise) ??
                                    item.netInclusivePaise ??
                                    item.pricePaise) * item.quantity
                                : item.itemTotalPaise ??
                                  (item.netInclusivePaise ?? item.pricePaise) *
                                    item.quantity) ) /
                              100
                            ).toLocaleString("en-IN")}`
                          : t("price.onRequest")}
                      </span>
                    </div>
                  ))}
                </div>

                {firmBreakdown.length > 1 ? (
                  <div className="mt-3 space-y-1.5 border-b border-[var(--sl-rule)] pb-4 text-xs">
                    {firmBreakdown.map((group) => (
                      <div
                        key={group.firmName}
                        className="flex items-start justify-between gap-3 text-[var(--sl-ink-2)]"
                      >
                        <span className="min-w-0 break-words">
                          {group.firmName}
                          <span className="ml-1 text-[var(--sl-ink-3)]">
                            ({group.itemCount})
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-[var(--sl-ink)]">
                          ₹{(group.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Financial Breakdown */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3 text-[var(--sl-ink-2)]">
                    <span className="min-w-0">{t("checkout.subtotalPlain")}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-[var(--sl-ink)]">
                      ₹{(itemsSubtotalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[var(--sl-ink-2)]">
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                      <span>{t("checkout.gstTax")}</span>
                      <span className="rounded border border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] px-1 py-0.2 text-[10px] font-bold text-[var(--sl-ok)]">
                        {t("checkout.itemized")}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-[var(--sl-ok)]">
                      ₹{(gstPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-[var(--sl-ink-2)]">
                    <span className="min-w-0">{t("checkout.shippingHandle")}</span>
                    <span className="max-w-[55%] shrink-0 text-right tabular-nums font-semibold text-[var(--sl-ok)]">
                      {shippingPaise === 0
                        ? t("checkout.freeStd")
                        : `₹${(shippingPaise / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  <div className="border-t border-[var(--sl-rule)] pt-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold text-[var(--sl-ink)]">
                        {t("checkout.grand")}
                      </span>
                      <div className="min-w-0 text-right">
                        <span className="text-xl font-extrabold tabular-nums text-[var(--sl-ink)]">
                          ₹{(grandTotalPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <p className="text-[10px] text-[var(--sl-ink-3)]">
                          {t("checkout.inclusive")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action — desktop / tablet; mobile uses sticky bar */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="sl-btn sl-btn-primary sl-btn-block sl-press mt-6 hidden md:flex disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>{t("checkout.placing")}</span>
                    </>
                  ) : (
                    <span>{placeOrderLabel}</span>
                  )}
                </button>
              </div>
            </aside>
          </form>
        )}
      </main>
            <SiteFooter />
      {showMobileCheckoutCta && cart ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+var(--safe-bottom))] z-40 border-t border-[var(--sl-rule)] bg-[var(--sl-surface)]/95 px-3 py-2 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2.5 min-[360px]:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sl-ink-3)]">
                {t("checkout.grand")}
              </p>
              <p className="truncate text-lg font-extrabold tabular-nums text-[var(--sl-ink)]">
                ₹{(grandTotalPaise / 100).toLocaleString("en-IN")}
              </p>
            </div>
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="sl-btn sl-btn-primary sl-press min-h-12 max-w-[58%] shrink-0 px-3.5 text-sm font-bold disabled:opacity-60 min-[360px]:px-5"
            >
              <span className="truncate">
                {submitting ? t("checkout.placing") : placeOrderLabel}
              </span>
            </button>
          </div>
        </div>
      ) : null}
      <Suspense fallback={null}>
        <MobileBottomNav cartCount={cart?.itemCount ?? 0} />
      </Suspense>
    </div>
  );
}
