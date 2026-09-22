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
  const idempotencyKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `checkout-${Date.now()}`,
  );

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

    if (effectivePaymentMethod === "online_payment" && !hasOnlineCapableFirm) {
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
  const hasOnlineCapableFirm = Boolean(
    cart?.items.some(
      (item) => item.firmId && onlineCapableSet.has(item.firmId),
    ),
  );
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
          firmName: item.firmName || "Fulfillment firm",
          itemCount: 1,
          totalPaise: lineTotal,
        });
      }
    }
    return [...groups.values()];
  }, [cart?.items]);
  const effectivePaymentMethod =
    paymentMethod === "online_payment" && !hasOnlineCapableFirm
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
      className={`min-h-screen bg-slate-50/70 text-slate-900 ${
        cart && cart.items.length > 0
          ? "pb-[calc(var(--mobile-nav-height)+var(--safe-bottom)+4.75rem)] md:pb-0"
          : "storefront-mobile-pad"
      }`}
    >
      <StorefrontHeader cartCount={cart?.itemCount ?? 0} />

      <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <Link href="/cart" className="text-xs font-semibold text-[#7a1233] hover:underline">
            {t("cart.continue")}
          </Link>
          <SignOutButton />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 min-[360px]:text-2xl sm:text-3xl">
          {t("cart.checkout")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("cart.genuine")}
        </p>

        {loading && (
          <div className="mt-6 space-y-4 sm:mt-8">
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800 sm:p-4"
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
            <div className="min-w-0 flex-1 break-words">{error}</div>
          </div>
        )}

        {!loading && !error && (!cart || !cart.items.length) && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-xs sm:mt-8 sm:p-12">
            <p className="font-bold text-slate-900">{t("cart.emptyTitle")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("cart.emptyBody")}
            </p>
            <Link
              href="/"
              className="btn-press mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              {t("cart.find")}
            </Link>
          </div>
        )}

        {!loading && cart && cart.items.length > 0 && (
          <form
            id="checkout-form"
            onSubmit={placeOrder}
            className="mt-6 grid gap-5 sm:mt-8 lg:grid-cols-[1fr_360px] lg:gap-8"
          >
            {/* Delivery Address & Payment Method Form */}
            <div className="min-w-0 space-y-4 sm:space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    {t("checkout.addressTitle")}
                  </h2>
                  {addressPrefilled ? (
                    <span className="shrink-0 text-[11px] font-semibold text-emerald-700">
                      {t("checkout.prefilled")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.addressHint")}
                </p>

                <div className="mt-4 grid gap-3 min-[390px]:gap-4 sm:mt-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("register.fullName")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("checkout.phName")}
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.mobile10")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91XXXXXXXXXX"
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("profile.pincode")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 380001"
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.line1")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      autoComplete="address-line1"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder={t("checkout.phLine1")}
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.landmarkOptional")}
                    </span>
                    <input
                      autoComplete="address-line2"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder={t("checkout.phLandmark")}
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.cityDistrict")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t("checkout.phCity")}
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.state")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      autoComplete="address-level1"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder={t("checkout.phState")}
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>
                </div>
              </section>

              {/* Fulfillment & Transport Preference */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {t("checkout.fulfillTitle")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.fulfillHint")}
                </p>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 min-[390px]:grid-cols-3 min-[390px]:gap-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800 has-checked:border-slate-950 has-checked:bg-slate-50 sm:p-3.5">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="courier"
                        checked={shippingMethod === "courier"}
                        onChange={() => setShippingMethod("courier")}
                        className="shrink-0"
                      />
                      <span className="leading-snug">{t("register.courier")}</span>
                    </label>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800 has-checked:border-slate-950 has-checked:bg-slate-50 sm:p-3.5">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="self_pickup"
                        checked={shippingMethod === "self_pickup"}
                        onChange={() => setShippingMethod("self_pickup")}
                        className="shrink-0"
                      />
                      <span className="leading-snug">{t("register.pickup")}</span>
                    </label>

                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800 has-checked:border-slate-950 has-checked:bg-slate-50 sm:p-3.5">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="transport"
                        checked={shippingMethod === "transport"}
                        onChange={() => setShippingMethod("transport")}
                        className="shrink-0"
                      />
                      <span className="leading-snug">{t("register.transport")}</span>
                    </label>
                  </div>

                  {shippingMethod === "transport" && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 animate-in fade-in sm:p-4">
                      <p className="text-xs font-bold text-slate-900">
                        {t("checkout.transportDetails")}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="min-w-0">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            {t("checkout.transporterName")} <span className="text-rose-500">*</span>
                          </span>
                          <input
                            required={shippingMethod === "transport"}
                            value={transportName}
                            onChange={(e) => setTransportName(e.target.value)}
                            placeholder={t("checkout.phTransporter")}
                            className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950 sm:h-10"
                          />
                        </div>

                        <div className="min-w-0">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            {t("checkout.transportContact")}
                          </span>
                          <input
                            type="tel"
                            inputMode="tel"
                            value={transportPhone}
                            onChange={(e) => setTransportPhone(e.target.value)}
                            placeholder={t("checkout.phTransportPhone")}
                            className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950 sm:h-10"
                          />
                        </div>

                        <div className="min-w-0">
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            {t("checkout.transportGstin")}
                          </span>
                          <input
                            maxLength={15}
                            value={transportGstin}
                            onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                            placeholder={t("profile.phTransportGstin")}
                            className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs font-medium outline-none focus:border-slate-950 sm:h-10"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* B2B / GST Information */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    {t("checkout.gstTitle")}
                  </h2>
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {t("checkout.b2bBadge")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.gstHint")}
                </p>

                <div className="mt-4 grid gap-3 min-[390px]:gap-4 sm:mt-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("register.business")}
                    </span>
                    <input
                      value={businessNameInput}
                      onChange={(e) => setBusinessNameInput(e.target.value)}
                      placeholder={t("checkout.phBusiness")}
                      className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10 sm:px-3.5"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.buyerGstin")}
                    </span>
                    <input
                      value={gstinInput}
                      onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                      maxLength={15}
                      autoCapitalize="characters"
                      placeholder="e.g. 24AAACR1234K1Z0"
                      className={`h-11 w-full min-w-0 rounded-xl border bg-slate-50/50 px-3 font-mono text-sm font-medium outline-none transition-all focus:bg-white focus:ring-2 sm:px-3.5 ${
                        gstinInput.trim() && gstinValidation
                          ? gstinValidation.valid
                            ? "border-emerald-500 text-emerald-950 focus:border-emerald-600 focus:ring-emerald-500/10"
                            : "border-rose-300 text-rose-950 focus:border-rose-500 focus:ring-rose-500/10"
                          : "border-slate-200 focus:border-slate-950 focus:ring-slate-950/10"
                      }`}
                    />

                    {/* GST Validation Status Banner */}
                    {gstinInput.trim() && gstinValidation && (
                      <div
                        className={`mt-2 flex items-start gap-1.5 rounded-lg p-2 text-xs font-medium ${
                          gstinValidation.valid
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {gstinValidation.valid ? (
                          <>
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            <span className="min-w-0 break-words">
                              {gstinValidation.message} (State: {gstinValidation.stateName})
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
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

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {t("checkout.payTitle")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.payHint")}
                </p>

                {hasPensol ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
                    <p className="text-sm font-bold text-slate-900">{t("checkout.pensolPayTitle")}</p>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="pensolSettlement"
                        checked={pensolSettlement === "cash"}
                        onChange={() => setPensolSettlement("cash")}
                        className="mt-1 shrink-0"
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
                        className="mt-1 shrink-0"
                      />
                      <span className="min-w-0 text-sm leading-snug">
                        {t("checkout.pensolCredit")}
                      </span>
                    </label>
                    <p className="break-words text-xs text-slate-600">
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
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:bg-slate-50 has-checked:border-slate-950 has-checked:bg-slate-50/50 sm:gap-3.5 sm:p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash_on_delivery"
                      checked={effectivePaymentMethod === "cash_on_delivery"}
                      onChange={() => setPaymentMethod("cash_on_delivery")}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">
                        {t("checkout.cod")}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {t("checkout.codHint")}
                      </span>
                    </div>
                  </label>

                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:bg-slate-50 has-checked:border-slate-950 has-checked:bg-slate-50/50 sm:gap-3.5 sm:p-4">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={effectivePaymentMethod === "bank_transfer"}
                      onChange={() => setPaymentMethod("bank_transfer")}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">
                        {t("checkout.bank")}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {t("checkout.bankHint")}
                      </span>
                    </div>
                  </label>

                  {hasOnlineCapableFirm ? (
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:bg-slate-50 has-checked:border-slate-950 has-checked:bg-slate-50/50 sm:gap-3.5 sm:p-4">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="online_payment"
                        checked={effectivePaymentMethod === "online_payment"}
                        onChange={() => setPaymentMethod("online_payment")}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">
                          {t("checkout.online")}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                          {t("checkout.onlineHint")}
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 sm:p-4">
                      <span className="block text-sm font-bold text-slate-900">
                        {t("checkout.comingSoon")}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                        {t("checkout.onlineHint")}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Authoritative Order Summary Sidebar */}
            <aside aria-label="Order breakdown" className="min-w-0">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-20">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {t("checkout.summary")}
                </h2>

                {/* Line Items */}
                <div className="mt-4 divide-y divide-slate-100 border-b border-slate-100 pb-4 text-xs">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-slate-900">
                          {item.partName || t("checkout.sparePart")} × {item.quantity}
                        </p>
                        <p className="mt-0.5 break-words text-slate-400">
                          {isAuthoritativeSellingPricePaise(
                            item.listInclusivePaise,
                            item.netInclusivePaise,
                            item.pricePaise,
                          )
                            ? `${t("price.listRate")}: ₹${(((item.listInclusivePaise ?? item.pricePaise) * item.quantity) / 100).toLocaleString("en-IN")}`
                            : t("price.onRequest")}
                          {item.gstRate !== undefined && (
                            <span className="ml-1.5 font-medium text-emerald-700">
                              (GST {item.gstRate}%)
                            </span>
                          )}
                        </p>
                        {(item.discountPercent ?? 0) > 0 ? (
                          <p className="text-[11px] font-semibold text-[#7a1233]">
                            {t("price.inclTaxDiscount", { percent: String(item.discountPercent) })}
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 tabular-nums font-bold text-slate-900">
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
                  <div className="mt-3 space-y-1.5 border-b border-slate-100 pb-4 text-xs">
                    {firmBreakdown.map((group) => (
                      <div
                        key={group.firmName}
                        className="flex items-start justify-between gap-3 text-slate-600"
                      >
                        <span className="min-w-0 break-words">
                          {group.firmName}
                          <span className="ml-1 text-slate-400">
                            ({group.itemCount})
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-slate-900">
                          ₹{(group.totalPaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Financial Breakdown */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <span className="min-w-0">{t("checkout.subtotalPlain")}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-900">
                      ₹{(itemsSubtotalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                      <span>{t("checkout.gstTax")}</span>
                      <span className="rounded border border-emerald-200/60 bg-emerald-50 px-1 py-0.2 text-[10px] font-bold text-emerald-700">
                        {t("checkout.itemized")}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-emerald-700">
                      ₹{(gstPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <span className="min-w-0">{t("checkout.shippingHandle")}</span>
                    <span className="max-w-[55%] shrink-0 text-right tabular-nums font-semibold text-emerald-700">
                      {shippingPaise === 0
                        ? t("checkout.freeStd")
                        : `₹${(shippingPaise / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold text-slate-950">
                        {t("checkout.grand")}
                      </span>
                      <div className="min-w-0 text-right">
                        <span className="text-xl font-extrabold tabular-nums text-slate-950">
                          ₹{(grandTotalPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <p className="text-[10px] text-slate-400">
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
                  className="btn-press mt-6 hidden w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-center text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:flex"
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
      </div>
      <SiteFooter />
      {showMobileCheckoutCta && cart ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--mobile-nav-height)+var(--safe-bottom))] z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2.5 min-[360px]:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("checkout.grand")}
              </p>
              <p className="truncate text-lg font-extrabold tabular-nums text-slate-950">
                ₹{(grandTotalPaise / 100).toLocaleString("en-IN")}
              </p>
            </div>
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="btn-press inline-flex min-h-12 max-w-[58%] shrink-0 items-center justify-center rounded-xl bg-[#7a1233] px-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 min-[360px]:px-5"
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
