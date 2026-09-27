/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { validateGSTIN } from "@/lib/gst";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { GarageVehiclesPanel } from "@/components/garage-vehicles-panel";
import { useI18n } from "@/components/preferences-provider";

type ProfileData = {
  id: string;
  contactName: string;
  businessName: string;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  email: string;
  gstin: string;
  customerType: "b2b" | "b2c";
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingPreference: "self_pickup" | "transport" | "courier";
  transportName: string;
  transportPhone: string;
  transportGstin: string;
};

export default function ProfilePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form Fields
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPincode, setShippingPincode] = useState("");
  const [shippingPreference, setShippingPreference] = useState<"self_pickup" | "transport" | "courier">("courier");
  const [transportName, setTransportName] = useState("");
  const [transportPhone, setTransportPhone] = useState("");
  const [transportGstin, setTransportGstin] = useState("");

  const gstinValidation = gstin.trim() ? validateGSTIN(gstin) : null;

  const loadProfile = useCallback(async () => {
    try {
      setError("");
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("profile.loadFail"));

      setProfile(data);
      setContactName(data.contactName || "");
      setBusinessName(data.businessName || "");
      setGstin(data.gstin || "");
      setShippingAddressLine1(data.shippingAddressLine1 || "");
      setShippingAddressLine2(data.shippingAddressLine2 || "");
      setShippingCity(data.shippingCity || "");
      setShippingState(data.shippingState || "");
      setShippingPincode(data.shippingPincode || "");
      setShippingPreference(data.shippingPreference || "courier");
      setTransportName(data.transportName || "");
      setTransportPhone(data.transportPhone || "");
      setTransportGstin(data.transportGstin || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    if (gstin.trim() && gstinValidation && !gstinValidation.valid) {
      setError(t("profile.gstinInvalid"));
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          businessName,
          gstin: gstin.trim().toUpperCase(),
          shippingAddressLine1,
          shippingAddressLine2,
          shippingCity,
          shippingState,
          shippingPincode,
          shippingPreference,
          transportName,
          transportPhone,
          transportGstin: transportGstin.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("profile.updateFail"));

      setSuccess(t("profile.saved"));
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.saveFail"));
    } finally {
      setSaving(false);
    }
  }

  /* Single source for the account navigation, rendered as a rail on desktop
     and a tile grid on mobile. Previously the links were inlined once and the
     desktop variant did not exist at all. */
  const ACCOUNT_LINKS = [
    { href: "/orders", label: t("account.hubOrders") },
    { href: "/wishlist", label: t("account.hubWishlist") },
    { href: "#garage", label: t("account.hubGarage") },
    { href: "#profile-form", label: t("account.hubProfile") },
    { href: "/track-order", label: t("account.hubTrack") },
    { href: "/help-support", label: t("account.hubSupport") },
    { href: "/offers", label: t("account.hubOffers") },
    { href: "/privacy-policy", label: t("account.hubPolicies") },
    { href: "/account/change-password", label: t("account.passwordTitle") },
  ];

  return (
    <div className="storefront-mobile-pad sl-page flex min-h-screen flex-col text-[var(--sl-text)]">      <StorefrontHeader />
      <div className="hidden border-b border-[var(--sl-border)] bg-white px-4 py-2 md:block">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-3 text-xs font-semibold text-[var(--sl-text-soft)]">
          <Link href="/orders" className="hover:text-slate-950">
            {t("nav.orders")}
          </Link>
          <Link href="/cart" className="hover:text-slate-950">
            {t("nav.cart")}
          </Link>
          <Link href="/" className="rounded-full border border-[var(--sl-border-strong)] px-3 py-1.5 hover:bg-slate-100">
            {t("nav.orderParts")}
          </Link>
          <SignOutButton className="rounded-full border border-[var(--sl-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--sl-text-soft)] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-60" />
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-10">
        {/*
          V2 account dashboard: navigation rail + content.
          The rail is `hidden lg:block` and the mobile grid is `lg:hidden`, so
          exactly one navigation surface renders at any width. Previously the
          nav was `md:hidden` only, which left desktop users with no account
          navigation at all.
        */}
        <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <h1 id="account-hub-heading" className="sl-h2">
              {t("account.hubTitle")}
            </h1>
            <nav className="mt-4 flex flex-col gap-1" aria-label={t("account.hubTitle")}>
              {ACCOUNT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="sl-v2-focus sl-nav flex min-h-11 items-center rounded-[var(--sl-radius-sm)] px-3 text-[var(--sl-text-soft)] transition-colors hover:bg-[var(--sl-primary-soft)] hover:text-[var(--sl-primary)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-[var(--sl-border)] pt-4">
              <SignOutButton className="sl-v2-btn sl-v2-btn-ghost w-full !justify-start" />
            </div>
          </aside>

          <div className="min-w-0">
        <section className="mb-6 lg:hidden" aria-labelledby="account-hub-heading-m">
          <h1 id="account-hub-heading-m" className="sl-h2">
            {t("account.hubTitle")}
          </h1>
          <nav className="mt-3 grid grid-cols-2 gap-2">
            {ACCOUNT_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="sl-v2-focus sl-nav flex min-h-12 items-center rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white px-3 text-[var(--sl-text-soft)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3">
            <SignOutButton className="sl-v2-btn sl-v2-btn-ghost w-full" />
          </div>
        </section>

        <div className="mb-6 md:mt-2">
          <GarageVehiclesPanel />
        </div>

        <div id="profile-form" className="flex flex-col gap-2 border-b border-[var(--sl-border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-3xl md:text-2xl">
              {t("profile.title")}
            </h2>
            <p className="mt-1 text-xs text-[var(--sl-muted)]">
              {t("profile.subtitle")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {profile?.customerType === "b2b" ? t("profile.b2b") : t("profile.b2c")}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-[var(--sl-radius)] border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800"
          >
            <span className="font-bold text-rose-600">✕</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-6 flex items-start gap-2.5 rounded-[var(--sl-radius)] border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800"
          >
            <span className="font-bold text-emerald-600">✓</span>
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="h-40 animate-pulse rounded-[var(--sl-radius-lg)] bg-white border border-[var(--sl-border)]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* 1. Account Details */}
            <section className="rounded-[var(--sl-radius-lg)] border border-[var(--sl-border)] bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                {t("profile.identity")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--sl-muted)]">
                {t("profile.mobileHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.mobileVerified")}
                  </span>
                  <input
                    disabled
                    value={profile?.phoneNumber || t("profile.mobileFallback")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-slate-100/80 px-3.5 text-sm font-medium text-[var(--sl-muted)] cursor-not-allowed"
                  />
                  <p className="mt-1 text-[11px] font-medium text-emerald-600">
                    ✓ {t("profile.verifiedOtp")}
                  </p>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.contactPerson")} <span className="text-rose-500">*</span>
                  </span>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("profile.phName")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>
              </div>
            </section>

            {/* 2. Business / Workshop & GSTIN */}
            <section className="rounded-[var(--sl-radius-lg)] border border-[var(--sl-border)] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  {t("profile.businessTitle")}
                </h2>
                <span className="text-xs font-semibold text-[var(--sl-muted)]">
                  {t("profile.optionalB2c")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--sl-muted)]">
                {t("profile.gstHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.firmName")}
                  </span>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t("profile.phBusiness")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.gstinLabel")}
                  </span>
                  <input
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AAACR1234K1Z0"
                    className={`h-11 w-full font-mono rounded-[var(--sl-radius)] border bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 ${
                      gstin.trim() && gstinValidation
                        ? gstinValidation.valid
                          ? "border-emerald-500 text-emerald-950 focus:border-emerald-600 focus:ring-emerald-500/10"
                          : "border-rose-300 text-rose-950 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-[var(--sl-border)] focus:border-slate-950 focus:ring-slate-950/10"
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
                </div>
              </div>
            </section>

            {/* 3. Address & Logistics */}
            <section className="rounded-[var(--sl-radius-lg)] border border-[var(--sl-border)] bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                {t("profile.addressTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--sl-muted)]">
                {t("profile.addressHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.line1")}
                  </span>
                  <input
                    value={shippingAddressLine1}
                    onChange={(e) => setShippingAddressLine1(e.target.value)}
                    placeholder={t("profile.phPlot")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.line2")}
                  </span>
                  <input
                    value={shippingAddressLine2}
                    onChange={(e) => setShippingAddressLine2(e.target.value)}
                    placeholder={t("profile.phLandmark")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.city")}
                  </span>
                  <input
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder={t("profile.phCity")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.state")}
                  </span>
                  <input
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    placeholder={t("profile.phState")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                    {t("profile.pincode")}
                  </span>
                  <input
                    maxLength={6}
                    value={shippingPincode}
                    onChange={(e) => setShippingPincode(e.target.value)}
                    placeholder={t("profile.phPincode")}
                    className="h-11 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-[var(--sl-surface-sunk)]/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>
              </div>
            </section>

            {/* 4. Transport & Shipping Preference */}
            <section className="rounded-[var(--sl-radius-lg)] border border-[var(--sl-border)] bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                {t("profile.fulfillTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--sl-muted)]">
                {t("profile.fulfillHint")}
              </p>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 rounded-[var(--sl-radius)] border border-[var(--sl-border)] p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-[var(--sl-surface-sunk)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="courier"
                      checked={shippingPreference === "courier"}
                      onChange={() => setShippingPreference("courier")}
                    />
                    <span>{t("register.courier")}</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-[var(--sl-radius)] border border-[var(--sl-border)] p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-[var(--sl-surface-sunk)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="self_pickup"
                      checked={shippingPreference === "self_pickup"}
                      onChange={() => setShippingPreference("self_pickup")}
                    />
                    <span>{t("register.pickup")}</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-[var(--sl-radius)] border border-[var(--sl-border)] p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-[var(--sl-surface-sunk)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="transport"
                      checked={shippingPreference === "transport"}
                      onChange={() => setShippingPreference("transport")}
                    />
                    <span>{t("register.transport")}</span>
                  </label>
                </div>

                {shippingPreference === "transport" && (
                  <div className="rounded-[var(--sl-radius)] bg-[var(--sl-surface-sunk)] border border-[var(--sl-border)] p-4 space-y-4 animate-in fade-in">
                    <p className="text-xs font-bold text-slate-950">
                      {t("profile.transportSaved")}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                          {t("profile.transportName")} <span className="text-rose-500">*</span>
                        </span>
                        <input
                          required={shippingPreference === "transport"}
                          value={transportName}
                          onChange={(e) => setTransportName(e.target.value)}
                          placeholder={t("profile.phTransporter")}
                          className="h-10 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                          {t("profile.transportPhone")}
                        </span>
                        <input
                          value={transportPhone}
                          onChange={(e) => setTransportPhone(e.target.value)}
                          placeholder={t("profile.phTransportPhone")}
                          className="h-10 w-full rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-semibold text-[var(--sl-text-soft)]">
                          {t("profile.transportGstin")}
                        </span>
                        <input
                          maxLength={15}
                          value={transportGstin}
                          onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                          placeholder={t("profile.phTransportGstin")}
                          className="h-10 w-full font-mono rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-white px-3 text-xs font-medium outline-none focus:border-slate-950"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--sl-border)]">
              <Link
                href="/"
                className="sl-v2-btn sl-v2-btn-secondary"
              >
                {t("common.cancel")}
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="sl-v2-btn sl-v2-btn-primary"
              >
                {saving ? t("profile.saving") : t("profile.save")}
              </button>
            </div>
          </form>
        )}
          </div>
        </div>
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}

