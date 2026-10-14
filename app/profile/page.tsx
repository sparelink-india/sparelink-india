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
import { Notice, Skeleton } from "@/components/page-states";
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
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">      <StorefrontHeader />
      <div className="hidden border-b border-[var(--sl-rule)] bg-[var(--sl-surface)] px-4 py-2 md:block">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-3">
          <Link href="/orders" className="sl-navlink sl-focus">
            {t("nav.orders")}
          </Link>
          <Link href="/cart" className="sl-navlink sl-focus">
            {t("nav.cart")}
          </Link>
          <Link href="/" className="sl-btn sl-btn-secondary sl-btn-sm">
            {t("nav.orderParts")}
          </Link>
          <SignOutButton className="sl-btn sl-btn-secondary sl-btn-sm sl-focus" />
        </div>
      </div>

      <main className="sl-container sl-container-prose-lg sl-page-main">
        {/* ---------- ACCOUNT REFERENCE LAYOUT ----------
            One navigation object at every breakpoint, then the content column
            at full width.

            V2 had two: a sticky 15rem sidebar on desktop and a 2-column grid of
            bordered boxes on mobile. The sidebar is a dashboard idiom, and 240px
            of page width to list five links left the actual account form
            squeezed into 65% of a 4xl container. */}
        <div className="flex min-w-0 flex-col">
          <nav
            className="border-y border-[var(--sl-rule)]"
            aria-label={t("account.hubTitle")}
          >
            <h1 id="account-hub-heading" className="sr-only">
              {t("account.hubTitle")}
            </h1>
            {/* Scrolls horizontally on a phone rather than wrapping to three
                rows, so the object below it never moves. */}
            <ul className="-mx-1 flex items-stretch overflow-x-auto px-1">
              {ACCOUNT_LINKS.map((item, index) => (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className="sl-focus flex min-h-12 items-center gap-2 border-b-2 border-transparent px-3 text-[0.8125rem] font-semibold text-[var(--sl-ink-2)] transition-colors hover:border-[var(--sl-brand)] hover:bg-[var(--sl-brand-soft)] hover:text-[var(--sl-brand-ink)]"
                  >
                    {/* Clause index, the same device as the policy contents
                        and the category menu. */}
                    <span className="sl-part text-[0.625rem] text-[var(--sl-ink-3)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="ml-auto hidden shrink-0 items-center pl-3 sm:flex">
                <SignOutButton className="sl-btn sl-btn-ghost sl-btn-sm" />
              </li>
            </ul>
          </nav>

          <div className="min-w-0">
        <section className="mt-6 sm:hidden" aria-label={t("account.hubTitle")}>
          <SignOutButton className="sl-btn sl-btn-ghost sl-btn-block" />
        </section>

        <div className="mb-6 md:mt-2">
          <GarageVehiclesPanel />
        </div>

        <div id="profile-form" className="flex flex-col gap-2 border-b border-[var(--sl-rule)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="sl-h2">
              {t("profile.title")}
            </h2>
            <p className="sl-hint">
              {t("profile.subtitle")}
            </p>
          </div>
          <span className="sl-badge sl-badge-ok self-start">
            <span className="h-2 w-2 rounded-[2px] bg-[var(--sl-ok)]" />
            {profile?.customerType === "b2b" ? t("profile.b2b") : t("profile.b2c")}
          </span>
        </div>

        {error && (
          <div className="mt-6">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        {success && (
          <div className="mt-6">
            <Notice tone="success">{success}</Notice>
          </div>
        )}

        {loading ? (
          <Skeleton className="mt-8 h-40 w-full" />
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* 1. Account Details */}
            <section className="sl-panel sl-panel-pad">
              <h2 className="sl-h2 flex items-center gap-2">
                {t("profile.identity")}
              </h2>
              <p className="sl-hint">
                {t("profile.mobileHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="pf-mobileverified" className="sl-label">
                    {t("profile.mobileVerified")}
                  </label>
                  <input
                    id="pf-mobileverified"
                    disabled
                    value={profile?.phoneNumber || t("profile.mobileFallback")}
                    className="sl-input"
                  />
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--sl-ok)]">
                    <svg
                      className="h-3.5 w-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    {t("profile.verifiedOtp")}
                  </p>
                </div>

                <div>
                  <label htmlFor="pf-contactperson" className="sl-label">
                    {t("profile.contactPerson")} <span className="text-[var(--sl-bad)]">*</span>
                  </label>
                  <input
                    id="pf-contactperson"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("profile.phName")}
                    className="sl-input"
                  />
                </div>
              </div>
            </section>

            {/* 2. Business / Workshop & GSTIN */}
            <section className="sl-panel sl-panel-pad">
              <div className="flex items-center justify-between">
                <h2 className="sl-h2 flex items-center gap-2">
                  {t("profile.businessTitle")}
                </h2>
                <span className="text-xs font-semibold text-[var(--sl-ink-3)]">
                  {t("profile.optionalB2c")}
                </span>
              </div>
              <p className="sl-hint">
                {t("profile.gstHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="pf-firmname" className="sl-label">
                    {t("profile.firmName")}
                  </label>
                  <input
                    id="pf-firmname"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t("profile.phBusiness")}
                    className="sl-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="pf-gstinlabel" className="sl-label">
                    {t("profile.gstinLabel")}
                  </label>
                  <input
                    id="pf-gstinlabel"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AAACR1234K1Z0"
                    className={`sl-input font-mono focus:ring-2 ${
                      gstin.trim() && gstinValidation
                        ? gstinValidation.valid
                          ? "border-[var(--sl-rule-strong)] text-[var(--sl-ok)] focus:border-[var(--sl-rule-strong)] focus:ring-[var(--sl-ok)]"
                          : "border-[var(--sl-bad-line)] text-[var(--sl-bad)] focus:border-[var(--sl-bad-line)] focus:ring-[var(--sl-bad)]"
                        : "border-[var(--sl-rule)]"
                    }`}
                  />
                  {gstin.trim() && gstinValidation && (
                    <p
                      className={`mt-1.5 text-xs font-medium ${
                        gstinValidation.valid ? "text-[var(--sl-ok)]" : "text-[var(--sl-bad)]"
                      }`}
                    >
                      {gstinValidation.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 3. Address & Logistics */}
            <section className="sl-panel sl-panel-pad">
              <h2 className="sl-h2 flex items-center gap-2">
                {t("profile.addressTitle")}
              </h2>
              <p className="sl-hint">
                {t("profile.addressHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="pf-line1" className="sl-label">
                    {t("profile.line1")}
                  </label>
                  <input
                    id="pf-line1"
                    value={shippingAddressLine1}
                    onChange={(e) => setShippingAddressLine1(e.target.value)}
                    placeholder={t("profile.phPlot")}
                    className="sl-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="pf-line2" className="sl-label">
                    {t("profile.line2")}
                  </label>
                  <input
                    id="pf-line2"
                    value={shippingAddressLine2}
                    onChange={(e) => setShippingAddressLine2(e.target.value)}
                    placeholder={t("profile.phLandmark")}
                    className="sl-input"
                  />
                </div>

                <div>
                  <label htmlFor="pf-city" className="sl-label">
                    {t("profile.city")}
                  </label>
                  <input
                    id="pf-city"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder={t("profile.phCity")}
                    className="sl-input"
                  />
                </div>

                <div>
                  <label htmlFor="pf-state" className="sl-label">
                    {t("profile.state")}
                  </label>
                  <input
                    id="pf-state"
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    placeholder={t("profile.phState")}
                    className="sl-input"
                  />
                </div>

                <div>
                  <label htmlFor="pf-pincode" className="sl-label">
                    {t("profile.pincode")}
                  </label>
                  <input
                    id="pf-pincode"
                    maxLength={6}
                    value={shippingPincode}
                    onChange={(e) => setShippingPincode(e.target.value)}
                    placeholder={t("profile.phPincode")}
                    className="sl-input"
                  />
                </div>
              </div>
            </section>

            {/* 4. Transport & Shipping Preference */}
            <section className="sl-panel sl-panel-pad">
              <h2 className="sl-h2 flex items-center gap-2">
                {t("profile.fulfillTitle")}
              </h2>
              <p className="sl-hint">
                {t("profile.fulfillHint")}
              </p>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="sl-focus flex items-center gap-2.5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3.5 text-xs font-bold text-[var(--sl-ink)] cursor-pointer transition-colors has-checked:border-[var(--sl-brand)] has-checked:bg-[var(--sl-brand-soft)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="courier"
                      checked={shippingPreference === "courier"}
                      onChange={() => setShippingPreference("courier")}
                      className="sl-check"
                    />
                    <span>{t("register.courier")}</span>
                  </label>

                  <label className="sl-focus flex items-center gap-2.5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3.5 text-xs font-bold text-[var(--sl-ink)] cursor-pointer transition-colors has-checked:border-[var(--sl-brand)] has-checked:bg-[var(--sl-brand-soft)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="self_pickup"
                      checked={shippingPreference === "self_pickup"}
                      onChange={() => setShippingPreference("self_pickup")}
                      className="sl-check"
                    />
                    <span>{t("register.pickup")}</span>
                  </label>

                  <label className="sl-focus flex items-center gap-2.5 rounded-[var(--sl-r)] border border-[var(--sl-rule)] p-3.5 text-xs font-bold text-[var(--sl-ink)] cursor-pointer transition-colors has-checked:border-[var(--sl-brand)] has-checked:bg-[var(--sl-brand-soft)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="transport"
                      checked={shippingPreference === "transport"}
                      onChange={() => setShippingPreference("transport")}
                      className="sl-check"
                    />
                    <span>{t("register.transport")}</span>
                  </label>
                </div>

                {shippingPreference === "transport" && (
                  <div className="rounded-[var(--sl-r)] bg-[var(--sl-sunken)] border border-[var(--sl-rule)] p-4 space-y-4 sl-fade-in">
                    <p className="text-xs font-bold text-[var(--sl-ink)]">
                      {t("profile.transportSaved")}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label htmlFor="pf-transportname" className="sl-label">
                          {t("profile.transportName")} <span className="text-[var(--sl-bad)]">*</span>
                        </label>
                        <input
                          id="pf-transportname"
                          required={shippingPreference === "transport"}
                          value={transportName}
                          onChange={(e) => setTransportName(e.target.value)}
                          placeholder={t("profile.phTransporter")}
                          className="sl-input"
                        />
                      </div>

                      <div>
                        <label htmlFor="pf-transportphone" className="sl-label">
                          {t("profile.transportPhone")}
                        </label>
                        <input
                          id="pf-transportphone"
                          value={transportPhone}
                          onChange={(e) => setTransportPhone(e.target.value)}
                          placeholder={t("profile.phTransportPhone")}
                          className="sl-input"
                        />
                      </div>

                      <div>
                        <label htmlFor="pf-transportgstin" className="sl-label">
                          {t("profile.transportGstin")}
                        </label>
                        <input
                          id="pf-transportgstin"
                          maxLength={15}
                          value={transportGstin}
                          onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                          placeholder={t("profile.phTransportGstin")}
                          className="sl-input font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-[var(--sl-rule)] pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/"
                className="sl-btn sl-btn-secondary"
              >
                {t("common.cancel")}
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="sl-btn sl-btn-primary"
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
