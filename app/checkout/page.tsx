"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { validateGSTIN } from "@/lib/gst";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
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
  }, [router]);

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
        headers: { "Content-Type": "application/json" },
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
  const effectivePaymentMethod =
    paymentMethod === "online_payment" && !hasOnlineCapableFirm
      ? "cash_on_delivery"
      : paymentMethod;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <StorefrontHeader cartCount={cart?.itemCount ?? 0} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/cart" className="text-xs font-semibold text-[#7a1233] hover:underline">
            {t("cart.continue")}
          </Link>
          <SignOutButton />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {t("cart.checkout")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("cart.genuine")}
        </p>

        {loading && (
          <div className="mt-8 space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-white border border-slate-200 p-6" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
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
            <div className="flex-1">{error}</div>
          </div>
        )}

        {!loading && !error && (!cart || !cart.items.length) && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <p className="font-bold text-slate-900">{t("cart.emptyTitle")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("cart.emptyBody")}
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              {t("cart.find")}
            </Link>
          </div>
        )}

        {!loading && cart && cart.items.length > 0 && (
          <form
            onSubmit={placeOrder}
            className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]"
          >
            {/* Delivery Address & Payment Method Form */}
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    {t("checkout.addressTitle")}
                  </h2>
                  {addressPrefilled ? (
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {t("checkout.prefilled")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.addressHint")}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("register.fullName")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t("checkout.phName")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.mobile10")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91XXXXXXXXXX"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("profile.pincode")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 380001"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.line1")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder={t("checkout.phLine1")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.landmarkOptional")}
                    </span>
                    <input
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder={t("checkout.phLandmark")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.cityDistrict")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t("checkout.phCity")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("checkout.state")} <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder={t("checkout.phState")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>
                </div>
              </section>

              {/* Fulfillment & Transport Preference */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {t("checkout.fulfillTitle")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.fulfillHint")}
                </p>

                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="courier"
                        checked={shippingMethod === "courier"}
                        onChange={() => setShippingMethod("courier")}
                      />
                      <span>{t("register.courier")}</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="self_pickup"
                        checked={shippingMethod === "self_pickup"}
                        onChange={() => setShippingMethod("self_pickup")}
                      />
                      <span>{t("register.pickup")}</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="transport"
                        checked={shippingMethod === "transport"}
                        onChange={() => setShippingMethod("transport")}
                      />
                      <span>{t("register.transport")}</span>
                    </label>
                  </div>

                  {shippingMethod === "transport" && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 animate-in fade-in">
                      <p className="text-xs font-bold text-slate-900">
                        {t("checkout.transportDetails")}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            {t("checkout.transporterName")} <span className="text-rose-500">*</span>
                          </span>
                          <input
                            required={shippingMethod === "transport"}
                            value={transportName}
                            onChange={(e) => setTransportName(e.target.value)}
                            placeholder={t("checkout.phTransporter")}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                          />
                        </div>

                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            {t("checkout.transportContact")}
                          </span>
                          <input
                            value={transportPhone}
                            onChange={(e) => setTransportPhone(e.target.value)}
                            placeholder={t("checkout.phTransportPhone")}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                          />
                        </div>

                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            {t("checkout.transportGstin")}
                          </span>
                          <input
                            maxLength={15}
                            value={transportGstin}
                            onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                            placeholder={t("profile.phTransportGstin")}
                            className="h-10 w-full font-mono rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* B2B / GST Information */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    {t("checkout.gstTitle")}
                  </h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {t("checkout.b2bBadge")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.gstHint")}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      {t("register.business")}
                    </span>
                    <input
                      value={businessNameInput}
                      onChange={(e) => setBusinessNameInput(e.target.value)}
                      placeholder={t("checkout.phBusiness")}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
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
                      placeholder="e.g. 24AAACR1234K1Z0"
                      className={`h-11 w-full font-mono rounded-xl border bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:bg-white focus:ring-2 ${
                        gstinInput.trim() && gstinValidation
                          ? gstinValidation.valid
                            ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/10 text-emerald-950"
                            : "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10 text-rose-950"
                          : "border-slate-200 focus:border-slate-950 focus:ring-slate-950/10"
                      }`}
                    />

                    {/* GST Validation Status Banner */}
                    {gstinInput.trim() && gstinValidation && (
                      <div
                        className={`mt-2 flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium ${
                          gstinValidation.valid
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {gstinValidation.valid ? (
                          <>
                            <svg className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            <span>
                              {gstinValidation.message} (State: {gstinValidation.stateName})
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span>{gstinValidation.message}</span>
                          </>
                        )}
                      </div>
                    )}
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {t("checkout.payTitle")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("checkout.payHint")}
                </p>

                {hasPensol ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <p className="text-sm font-bold text-slate-900">{t("checkout.pensolPayTitle")}</p>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="pensolSettlement"
                        checked={pensolSettlement === "cash"}
                        onChange={() => setPensolSettlement("cash")}
                      />
                      <span className="text-sm">
                        {t("checkout.pensolCash")}
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="pensolSettlement"
                        checked={pensolSettlement === "credit"}
                        onChange={() => setPensolSettlement("credit")}
                      />
                      <span className="text-sm">
                        {t("checkout.pensolCredit")}
                      </span>
                    </label>
                    <p className="text-xs text-slate-600">
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
                  <label className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-checked:border-slate-950 has-checked:bg-slate-50/50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash_on_delivery"
                      checked={effectivePaymentMethod === "cash_on_delivery"}
                      onChange={() => setPaymentMethod("cash_on_delivery")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-900">
                        {t("checkout.cod")}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t("checkout.codHint")}
                      </span>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-checked:border-slate-950 has-checked:bg-slate-50/50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={effectivePaymentMethod === "bank_transfer"}
                      onChange={() => setPaymentMethod("bank_transfer")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-900">
                        {t("checkout.bank")}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t("checkout.bankHint")}
                      </span>
                    </div>
                  </label>

                  {hasOnlineCapableFirm ? (
                    <label className="flex cursor-pointer items-start gap-3.5 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-checked:border-slate-950 has-checked:bg-slate-50/50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="online_payment"
                        checked={effectivePaymentMethod === "online_payment"}
                        onChange={() => setPaymentMethod("online_payment")}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-900">
                          {t("checkout.online")}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                        {t("checkout.onlineHint")}
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <span className="block text-sm font-bold text-slate-900">
                        {t("checkout.comingSoon")}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t("checkout.onlineHint")}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Authoritative Order Summary Sidebar */}
            <aside aria-label="Order breakdown">
              <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.partName || t("checkout.sparePart")} × {item.quantity}
                        </p>
                        <p className="mt-0.5 text-slate-400">
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
                      <span className="font-bold text-slate-900">
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

                {/* Financial Breakdown */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t("checkout.subtotalPlain")}</span>
                    <span className="font-semibold text-slate-900">
                      ₹{(itemsSubtotalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <span>{t("checkout.gstTax")}</span>
                      <span className="rounded bg-emerald-50 px-1 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                        {t("checkout.itemized")}
                      </span>
                    </span>
                    <span className="font-semibold text-emerald-700">
                      ₹{(gstPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t("checkout.shippingHandle")}</span>
                    <span className="font-semibold text-emerald-700">
                      {shippingPaise === 0
                        ? t("checkout.freeStd")
                        : `₹${(shippingPaise / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-slate-950">
                        {t("checkout.grand")}
                      </span>
                      <div className="text-right">
                        <span className="text-xl font-extrabold text-slate-950">
                          ₹{(grandTotalPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {t("checkout.inclusive")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-press mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-center text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                    <span>
                      {effectivePaymentMethod === "online_payment"
                        ? t("checkout.placeOnline")
                        : paymentMethod === "bank_transfer"
                          ? t("checkout.placeBank")
                          : t("checkout.placeCod")}
                    </span>
                  )}
                </button>
              </div>
            </aside>
          </form>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
