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

  return (
    <div className="storefront-mobile-pad min-h-screen bg-[var(--v3-sunk)] text-[var(--v3-text)]">
      <StorefrontHeader />
      {/*
        DESKTOP UTILITY BAR - Orders and "Order Parts" only.

        This bar used to carry its own /cart link and its own SignOutButton,
        duplicating the two controls the header above already renders, which is
        why /profile showed Cart twice and Sign out twice. Both duplicates are
        gone; the header is now the single source for those two actions.

        The mobile account hub below keeps its own SignOutButton deliberately.
        The header's Sign out is `hidden ... md:inline-flex`, so it does not
        exist below `md`, and this bar is `hidden md:block` too. Removing the
        mobile one as well would leave phone users with no way to sign out from
        this page, which is the one thing that must not break. As it stands,
        exactly one Sign out is visible at every viewport - the header's from
        `md` up, the hub's below it - and never two at once.

        The mobile bottom nav's Cart is untouched for the same class of reason:
        it is a shared component's primary navigation, not a duplicate of
        anything on this page.
      */}
      <div className="hidden border-b border-[var(--v3-rule)] bg-[var(--v3-panel)] px-4 py-2 md:block">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-3 text-xs font-semibold text-[var(--v3-text-2)]">
          <Link href="/orders" className="hover:text-[var(--v3-text)]">
            {t("nav.orders")}
          </Link>
          <Link href="/" className="rounded-full border border-[var(--v3-rule-strong)] px-3 py-1.5 hover:bg-[var(--v3-sunk)]">
            {t("nav.orderParts")}
          </Link>
        </div>
      </div>

      <main id="main-content" className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-10">
        <section className="mb-6 md:hidden" aria-labelledby="account-hub-heading">
          <h1 id="account-hub-heading" className="text-2xl font-bold text-[var(--v3-text)]">
            {t("account.hubTitle")}
          </h1>
          <nav className="mt-3 grid grid-cols-2 gap-2">
            {[
              { href: "/orders", label: t("account.hubOrders") },
              { href: "/wishlist", label: t("account.hubWishlist") },
              { href: "#garage", label: t("account.hubGarage") },
              { href: "#profile-form", label: t("account.hubProfile") },
              { href: "/track-order", label: t("account.hubTrack") },
              { href: "/help-support", label: t("account.hubSupport") },
              { href: "/offers", label: t("account.hubOffers") },
              { href: "/privacy-policy", label: t("account.hubPolicies") },
              { href: "/account/change-password", label: t("account.passwordTitle") },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="min-h-12 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 py-3 text-sm font-semibold text-[var(--v3-text)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3">
            {/* The one Sign out below `md`, and the only one at this width -
                the header's is hidden until `md`. See the note above. */}
            <SignOutButton className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] text-sm font-semibold text-[var(--v3-text-2)]" />
          </div>
        </section>

        <div className="mb-6 md:mt-2">
          <GarageVehiclesPanel />
        </div>

        <div id="profile-form" className="flex flex-col gap-2 border-b border-[var(--v3-rule)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--v3-text)] sm:text-3xl md:text-2xl">
              {t("profile.title")}
            </h2>
            <p className="mt-1 text-xs text-[var(--v3-text-3)]">
              {t("profile.subtitle")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--v3-ok-line)] bg-[var(--v3-ok-soft)] px-3 py-1 text-xs font-bold text-[var(--v3-ok)]">
            <span className="h-2 w-2 rounded-full bg-[var(--v3-ok-soft)]0" />
            {profile?.customerType === "b2b" ? t("profile.b2b") : t("profile.b2c")}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-[var(--v3-r)] border border-[var(--v3-bad-line)] bg-[var(--v3-bad-soft)] p-4 text-xs font-medium text-[var(--v3-bad)]"
          >
            <span className="font-bold text-[var(--v3-bad)]">✕</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-6 flex items-start gap-2.5 rounded-[var(--v3-r)] border border-[var(--v3-ok-line)] bg-[var(--v3-ok-soft)] p-4 text-xs font-medium text-[var(--v3-ok)]"
          >
            <span className="font-bold text-[var(--v3-ok)]">✓</span>
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="h-40 animate-pulse rounded-[var(--v3-r)] bg-[var(--v3-panel)] border border-[var(--v3-rule)]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* 1. Account Details */}
            <section className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-6 ">
              <h2 className="text-base font-bold text-[var(--v3-text)] sm:text-lg">
                {t("profile.identity")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--v3-text-3)]">
                {t("profile.mobileHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.mobileVerified")}
                  </span>
                  <input
                    disabled
                    value={profile?.phoneNumber || t("profile.mobileFallback")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium text-[var(--v3-text-3)] cursor-not-allowed"
                  />
                  <p className="mt-1 text-[11px] font-medium text-[var(--v3-ok)]">
                    ✓ {t("profile.verifiedOtp")}
                  </p>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.contactPerson")} <span className="text-[var(--v3-bad)]">*</span>
                  </span>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("profile.phName")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>
              </div>
            </section>

            {/* 2. Business / Workshop & GSTIN */}
            <section className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-6 ">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[var(--v3-text)] sm:text-lg">
                  {t("profile.businessTitle")}
                </h2>
                <span className="text-xs font-semibold text-[var(--v3-text-3)]">
                  {t("profile.optionalB2c")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--v3-text-3)]">
                {t("profile.gstHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.firmName")}
                  </span>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t("profile.phBusiness")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.gstinLabel")}
                  </span>
                  <input
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AAACR1234K1Z0"
                    className={`h-11 w-full font-mono rounded-[var(--v3-r)] border bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none bg-[var(--v3-panel)]  ${
                      gstin.trim() && gstinValidation
                        ? gstinValidation.valid
                          ? "border-[var(--v3-ok)] text-[var(--v3-ok)] v3-focus "
                          : "border-[var(--v3-bad-line)] text-[var(--v3-bad)] v3-focus "
                        : "border-[var(--v3-rule)] v3-focus "
                    }`} /> {gstin.trim() && gstinValidation && ( <p className={`mt-1.5 text-xs font-medium ${
                        gstinValidation.valid ? "text-[var(--v3-ok)]" : "text-[var(--v3-bad)]"
                      }`}
                    >
                      {gstinValidation.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 3. Address & Logistics */}
            <section className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-6 ">
              <h2 className="text-base font-bold text-[var(--v3-text)] sm:text-lg">
                {t("profile.addressTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--v3-text-3)]">
                {t("profile.addressHint")}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.line1")}
                  </span>
                  <input
                    value={shippingAddressLine1}
                    onChange={(e) => setShippingAddressLine1(e.target.value)}
                    placeholder={t("profile.phPlot")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.line2")}
                  </span>
                  <input
                    value={shippingAddressLine2}
                    onChange={(e) => setShippingAddressLine2(e.target.value)}
                    placeholder={t("profile.phLandmark")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.city")}
                  </span>
                  <input
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder={t("profile.phCity")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.state")}
                  </span>
                  <input
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    placeholder={t("profile.phState")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                    {t("profile.pincode")}
                  </span>
                  <input
                    maxLength={6}
                    value={shippingPincode}
                    onChange={(e) => setShippingPincode(e.target.value)}
                    placeholder={t("profile.phPincode")}
                    className="h-11 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3.5 text-sm font-medium outline-none v3-focus bg-[var(--v3-panel)] "
                  />
                </div>
              </div>
            </section>

            {/* 4. Transport & Shipping Preference */}
            <section className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-6 ">
              <h2 className="text-base font-bold text-[var(--v3-text)] sm:text-lg">
                {t("profile.fulfillTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--v3-text-3)]">
                {t("profile.fulfillHint")}
              </p>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 rounded-[var(--v3-r)] border border-[var(--v3-rule)] p-3.5 text-xs font-bold text-[var(--v3-text)] cursor-pointer has-checked:border-[var(--v3-brand)] has-checked:bg-[var(--v3-sunk)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="courier"
                      checked={shippingPreference === "courier"}
                      onChange={() => setShippingPreference("courier")}
                    />
                    <span>{t("register.courier")}</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-[var(--v3-r)] border border-[var(--v3-rule)] p-3.5 text-xs font-bold text-[var(--v3-text)] cursor-pointer has-checked:border-[var(--v3-brand)] has-checked:bg-[var(--v3-sunk)]">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="self_pickup"
                      checked={shippingPreference === "self_pickup"}
                      onChange={() => setShippingPreference("self_pickup")}
                    />
                    <span>{t("register.pickup")}</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-[var(--v3-r)] border border-[var(--v3-rule)] p-3.5 text-xs font-bold text-[var(--v3-text)] cursor-pointer has-checked:border-[var(--v3-brand)] has-checked:bg-[var(--v3-sunk)]">
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
                  <div className="rounded-[var(--v3-r)] bg-[var(--v3-sunk)] border border-[var(--v3-rule)] p-4 space-y-4 animate-in fade-in">
                    <p className="text-xs font-bold text-[var(--v3-text)]">
                      {t("profile.transportSaved")}
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                          {t("profile.transportName")} <span className="text-[var(--v3-bad)]">*</span>
                        </span>
                        <input
                          required={shippingPreference === "transport"}
                          value={transportName}
                          onChange={(e) => setTransportName(e.target.value)}
                          placeholder={t("profile.phTransporter")}
                          className="h-10 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-xs font-medium outline-none v3-focus"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                          {t("profile.transportPhone")}
                        </span>
                        <input
                          value={transportPhone}
                          onChange={(e) => setTransportPhone(e.target.value)}
                          placeholder={t("profile.phTransportPhone")}
                          className="h-10 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-xs font-medium outline-none v3-focus"
                        />
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-semibold text-[var(--v3-text-2)]">
                          {t("profile.transportGstin")}
                        </span>
                        <input
                          maxLength={15}
                          value={transportGstin}
                          onChange={(e) => setTransportGstin(e.target.value.toUpperCase())}
                          placeholder={t("profile.phTransportGstin")}
                          className="h-10 w-full font-mono rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 text-xs font-medium outline-none v3-focus"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--v3-rule)]">
              <Link
                href="/"
                className="rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] px-5 py-2.5 text-xs font-semibold text-[var(--v3-text-2)] hover:bg-[var(--v3-sunk)]"
              >
                {t("common.cancel")}
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="btn-press rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-6 py-2.5 text-xs font-bold text-white hover:bg-[var(--v3-brand-hover)] disabled:opacity-60"
              >
                {saving ? t("profile.saving") : t("profile.save")}
              </button>
            </div>
          </form>
        )}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}

