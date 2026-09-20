"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { validateGSTIN } from "@/lib/gst";
import { BrandLogo } from "@/components/brand-logo";
import { StorefrontHeader } from "@/components/storefront-header";
import { SiteFooter } from "@/components/site-footer";
import { useI18n } from "@/components/preferences-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();

  // Registration Form State
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state] = useState("");
  const [pincode, setPincode] = useState("");
  const [deliveryPreference, setDeliveryPreference] = useState<"courier" | "self_pickup" | "transport">("courier");
  const [transportName, setTransportName] = useState("");
  const [transportPhone, setTransportPhone] = useState("");
  const [transportGstin, setTransportGstin] = useState("");
  // OTP Verification State
  const [step, setStep] = useState<"details" | "otp">("details");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const gstinValidation = gstin.trim() ? validateGSTIN(gstin) : null;

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!phoneNumber || !/^(?:\+91)?[6-9]\d{9}$/.test(phoneNumber.replace(/[\s-]/g, ""))) {
      setError(t("register.phoneInvalid"));
      return;
    }

    if (gstin.trim() && gstinValidation && !gstinValidation.valid) {
      setError(t("register.gstinInvalid"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/phone-number/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("register.otpSendFail"));
      }

      setStep("otp");
      setMessage(t("register.otpSent", { phone: phoneNumber }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("register.initFail"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/phone-number/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new Error(data.error || t("register.otpInvalid"));
      }

      // Persist entered customer profile details
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: fullName.trim(),
          businessName: businessName.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          shippingAddressLine1: addressLine1.trim() || undefined,
          shippingCity: city.trim() || undefined,
          shippingState: state.trim() || undefined,
          shippingPincode: pincode.trim() || undefined,
          shippingPreference: deliveryPreference,
          transportName: deliveryPreference === "transport" ? transportName.trim() : undefined,
          transportPhone: deliveryPreference === "transport" ? transportPhone.trim() : undefined,
          transportGstin: deliveryPreference === "transport" && transportGstin.trim() ? transportGstin.trim().toUpperCase() : undefined,
        }),
      }).catch(() => null);

      setMessage(t("register.verified"));
      setTimeout(() => {
        router.push("/");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("register.verifyFail"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
    <StorefrontHeader />
    <main className="px-4 py-12 sm:px-6">
      <div className="mx-auto mb-8 flex max-w-xl flex-col items-center text-center">
        <BrandLogo />
        <h1 className="sr-only">SpareLink India</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("register.kicker")}
        </p>
      </div>

      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800"
          >
            <span className="text-rose-600 font-bold">✕</span>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800"
          >
            <span className="text-emerald-600 font-bold">✓</span>
            <span>{message}</span>
          </div>
        )}

        {step === "details" ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">
                {t("register.heading")}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {t("register.hint")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  {t("register.fullName")} <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("register.phName")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  {t("register.mobile")} <span className="text-rose-500">*</span>
                </span>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919876543210"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  {t("register.business")}
                </span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t("register.phBusiness")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    {t("register.gstin")}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    15 Chars
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder={t("register.phGstin")}
                  className={`h-11 w-full font-mono rounded-xl border bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 ${
                    gstin.trim() && gstinValidation
                      ? gstinValidation.valid
                        ? "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/10 text-emerald-950"
                        : "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10 text-rose-950"
                      : "border-slate-200 focus:border-slate-950 focus:ring-slate-950/10"
                  }`}
                />
                {gstin.trim() && gstinValidation && (
                  <p
                    className={`mt-1.5 text-xs font-medium ${
                      gstinValidation.valid ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {gstinValidation.message}
                  </p>
                )}
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  {t("register.address")}
                </span>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder={t("register.phAddress")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  {t("register.city")}
                </span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("register.phCity")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  {t("register.pincode")}
                </span>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="380001"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                />
              </label>

              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                  {t("register.method")}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                    <input
                      type="radio"
                      name="deliveryPref"
                      value="courier"
                      checked={deliveryPreference === "courier"}
                      onChange={() => setDeliveryPreference("courier")}
                    />
                    <span>{t("register.courier")}</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                    <input
                      type="radio"
                      name="deliveryPref"
                      value="self_pickup"
                      checked={deliveryPreference === "self_pickup"}
                      onChange={() => setDeliveryPreference("self_pickup")}
                    />
                    <span>{t("register.pickup")}</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                    <input
                      type="radio"
                      name="deliveryPref"
                      value="transport"
                      checked={deliveryPreference === "transport"}
                      onChange={() => setDeliveryPreference("transport")}
                    />
                    <span>{t("register.transport")}</span>
                  </label>
                </div>

                {deliveryPreference === "transport" && (
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3 animate-in fade-in">
                    <p className="text-xs font-bold text-slate-900">
                      {t("register.transportTitle")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="mb-1 block text-xs font-semibold text-slate-700">
                          {t("register.transporter")} <span className="text-rose-500">*</span>
                        </span>
                        <input
                          required={deliveryPreference === "transport"}
                          value={transportName}
                          onChange={(e) => setTransportName(e.target.value)}
                          placeholder={t("register.phTransporter")}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-semibold text-slate-700">
                          {t("register.transportPhone")}
                        </span>
                        <input
                          value={transportPhone}
                          onChange={(e) => setTransportPhone(e.target.value)}
                          placeholder={t("register.phTransportPhone")}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-semibold text-slate-700">
                          {t("register.transportGstin")}
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-press flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("register.sending") : t("register.sendOtp")}
            </button>

            <div className="text-center pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {t("register.already")}{" "}
                <Link href="/login" className="font-bold text-slate-900 underline hover:text-slate-700">
                  {t("register.signIn")}
                </Link>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
                {t("register.otpTitle")}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("register.otpHint", { phone: phoneNumber })}
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">
                {t("register.otpLabel")}
              </span>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="h-12 w-full font-mono text-center text-xl tracking-widest rounded-xl border border-slate-300 bg-slate-50 px-4 outline-none focus:border-slate-950 focus:bg-white"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-press flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("register.verifying") : t("register.verify")}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("details");
                setCode("");
                setError("");
              }}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              {t("register.edit")}
            </button>
          </form>
        )}
      </div>
    </main>
    <SiteFooter />
    </div>
  );
}

