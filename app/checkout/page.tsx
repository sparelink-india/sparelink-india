"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { validateGSTIN } from "@/lib/gst";
import { SignOutButton } from "@/components/sign-out-button";

type CartItem = {
  id: string;
  quantity: number;
  pricePaise: number;
  partName: string | null;
  partNumber: string | null;
  gstRate?: number;
  itemSubtotalPaise?: number;
  itemGstPaise?: number;
  firmId?: string | null;
  firmName?: string | null;
};

type CartData = {
  id: string | null;
  items: CartItem[];
  subtotalPaise?: number;
  gstPaise?: number;
  shippingPaise?: number;
  totalPaise: number;
  itemCount?: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
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
        if (!cartRes.ok) throw new Error(cartData.error || "Unable to load cart.");
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
          }
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load checkout data.",
        );
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    if (gstinInput.trim() && gstinValidation && !gstinValidation.valid) {
      setError("Please provide a valid 15-digit GSTIN or leave it blank.");
      setSubmitting(false);
      return;
    }

    if (effectivePaymentMethod === "online_payment" && !hasOnlineCapableFirm) {
      setError(
        "Online payment is not available for these firms yet. Please choose Cash on Delivery.",
      );
      setSubmitting(false);
      return;
    }

    if (shippingMethod === "transport" && !transportName.trim()) {
      setError("Please provide the Transporter Name for booking.");
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
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to place order.");
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
          : "Unable to place order.",
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
  const grandTotalPaise = cart?.totalPaise ?? itemsSubtotalPaise + gstPaise + shippingPaise;
  const onlineCapableSet = new Set(onlineCapableFirmIds);
  const hasOnlineCapableFirm = Boolean(
    cart?.items.some(
      (item) => item.firmId && onlineCapableSet.has(item.firmId),
    ),
  );
  const hasComingSoonFirm = Boolean(
    cart?.items.some(
      (item) => item.firmId && !onlineCapableSet.has(item.firmId),
    ),
  );
  const effectivePaymentMethod =
    paymentMethod === "online_payment" && !hasOnlineCapableFirm
      ? "cash_on_delivery"
      : paymentMethod;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-950">
              SpareLink
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              India
            </span>
          </Link>
          <Link
            href="/cart"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950"
          >
            <span>←</span> Back to Cart
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Secure Checkout
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Verify your delivery address and review line-item taxes before placing order.
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
            <p className="font-bold text-slate-900">Your cart is empty.</p>
            <p className="mt-1 text-sm text-slate-500">
              Please add automotive parts to your cart before proceeding to checkout.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              Find Spare Parts
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
                    1. Delivery Address & Contact
                  </h2>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Pre-filled from Profile
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  GST compliant invoice and shipment dispatch will be directed to this address.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      Full Name / Contact Person <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Sharma"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      10-Digit Mobile Number <span className="text-rose-500">*</span>
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
                      6-Digit Postal Pincode <span className="text-rose-500">*</span>
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
                      Flat, House no., Building, Street <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Street / Industrial Area / Plot No."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      Area, Landmark (Optional)
                    </span>
                    <input
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="Nearby landmark or unit"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      City / District <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Ahmedabad"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      State <span className="text-rose-500">*</span>
                    </span>
                    <input
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Gujarat"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>
                </div>
              </section>

              {/* Fulfillment & Transport Preference */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  2. Fulfillment & Delivery Option
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Select your preferred regional shipping mode.
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
                      <span>Courier Dispatch</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="self_pickup"
                        checked={shippingMethod === "self_pickup"}
                        onChange={() => setShippingMethod("self_pickup")}
                      />
                      <span>Self Pickup</span>
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                      <input
                        type="radio"
                        name="shipMethod"
                        value="transport"
                        checked={shippingMethod === "transport"}
                        onChange={() => setShippingMethod("transport")}
                      />
                      <span>Book through Transport</span>
                    </label>
                  </div>

                  {shippingMethod === "transport" && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 animate-in fade-in">
                      <p className="text-xs font-bold text-slate-900">
                        Transport Agency Details
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            Transporter Name <span className="text-rose-500">*</span>
                          </span>
                          <input
                            required={shippingMethod === "transport"}
                            value={transportName}
                            onChange={(e) => setTransportName(e.target.value)}
                            placeholder="e.g. V-Trans Logistics"
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                          />
                        </div>

                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            Transport Contact Number
                          </span>
                          <input
                            value={transportPhone}
                            onChange={(e) => setTransportPhone(e.target.value)}
                            placeholder="e.g. 98XXXXXXXX"
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                          />
                        </div>

                        <div>
                          <span className="mb-1 block text-xs font-semibold text-slate-700">
                            Transport GSTIN (Optional)
                          </span>
                          <input
                            maxLength={15}
                            value={transportGstin}
                            onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                            placeholder="15-digit GSTIN"
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
                    3. Business / GST Details (Optional)
                  </h2>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    B2B Invoicing
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Provide your GSTIN to receive a GST Tax Invoice with Input Tax Credit (ITC).
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      Business / Trade / Workshop Name (Optional)
                    </span>
                    <input
                      value={businessNameInput}
                      onChange={(e) => setBusinessNameInput(e.target.value)}
                      placeholder="e.g. Metro Auto Repairs & Services"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none transition-all focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold text-slate-700">
                      Buyer GSTIN (Optional, 15 characters)
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
                  4. Payment Method
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Select how you would like to settle this order.
                </p>

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
                        Cash on Delivery (COD)
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Available for Ambaji Traders, Hind Motors, and India
                        Sales. Pay cash or via delivery agent UPI upon part
                        handover.
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
                        Direct Bank Transfer / UPI
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Transfer directly to firm bank account or business UPI ID and submit your UTR reference.
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
                          Online Payment
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Cashfree is available for Ambaji Traders. Pay that
                          allocation after the order is placed. Payment is
                          confirmed only after SpareLink verifies it with the
                          payment gateway.
                          {hasComingSoonFirm
                            ? " Hind Motors and India Sales online payment is coming soon — use COD or bank/UPI for those allocations."
                            : ""}
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <span className="block text-sm font-bold text-slate-900">
                        Online Payment — Coming Soon
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Cashfree is not available for Hind Motors or India Sales
                        yet. Please use Cash on Delivery, or bank/UPI transfer.
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
                  Order Summary
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
                          {item.partName || "Spare Part"} × {item.quantity}
                        </p>
                        <p className="mt-0.5 text-slate-400">
                          Base: ₹{((item.pricePaise * item.quantity) / 100).toLocaleString("en-IN")}
                          {item.gstRate !== undefined && (
                            <span className="ml-1.5 font-medium text-emerald-700">
                              (GST {item.gstRate}%)
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900">
                        ₹
                        {(
                          (item.pricePaise * item.quantity) /
                          100
                        ).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Financial Breakdown */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-slate-900">
                      ₹{(itemsSubtotalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <span>GST / Tax</span>
                      <span className="rounded bg-emerald-50 px-1 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                        Itemized
                      </span>
                    </span>
                    <span className="font-semibold text-emerald-700">
                      ₹{(gstPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>Shipping & Handling</span>
                    <span className="font-semibold text-emerald-700">
                      {shippingPaise === 0
                        ? "₹0 (Free Standard)"
                        : `₹${(shippingPaise / 100).toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-slate-950">
                        Grand Total
                      </span>
                      <div className="text-right">
                        <span className="text-xl font-extrabold text-slate-950">
                          ₹{(grandTotalPaise / 100).toLocaleString("en-IN")}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Inclusive of all taxes
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
                      <span>Placing order...</span>
                    </>
                  ) : (
                    <span>
                      {effectivePaymentMethod === "online_payment"
                        ? "Place order and pay online"
                        : paymentMethod === "bank_transfer"
                          ? "Proceed to Bank / UPI Transfer"
                          : "Place COD Order"}
                    </span>
                  )}
                </button>
              </div>
            </aside>
          </form>
        )}
      </div>
    </div>
  );
}
