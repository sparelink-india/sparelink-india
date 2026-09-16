/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { validateGSTIN } from "@/lib/gst";
import { SignOutButton } from "@/components/sign-out-button";

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

  async function loadProfile() {
    try {
      setError("");
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load customer profile.");

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
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    if (gstin.trim() && gstinValidation && !gstinValidation.valid) {
      setError("Please provide a valid 15-character GSTIN or leave blank for B2C.");
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
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");

      setSuccess("Profile and transport preferences updated successfully.");
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-950">
              SpareLink
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              India
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <Link href="/orders" className="hover:text-slate-950">
              My Orders
            </Link>
            <Link href="/cart" className="hover:text-slate-950">
              Cart
            </Link>
            <Link
              href="/"
              className="rounded-full border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              Order Parts
            </Link>
            <SignOutButton className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-60" />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Customer Account & Business Profile
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Manage your verified mobile identity, B2B tax info, and preferred regional transport channels.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {profile?.customerType === "b2b" ? "B2B Workshop / Trade Account" : "B2C Customer Account"}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800"
          >
            <span className="font-bold text-rose-600">✕</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800"
          >
            <span className="font-bold text-emerald-600">✓</span>
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="mt-8 space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-white border border-slate-200" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* 1. Account Details */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                1. Customer & Mobile Identity
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Your mobile number is the primary verified login identifier.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Verified Mobile Number
                  </span>
                  <input
                    disabled
                    value={profile?.phoneNumber || "Mobile Login"}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 text-sm font-medium text-slate-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-[11px] font-medium text-emerald-600">
                    ✓ Verified via Mobile OTP
                  </p>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Contact Person Name <span className="text-rose-500">*</span>
                  </span>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full Name"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>
              </div>
            </section>

            {/* 2. Business / Workshop & GSTIN */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                  2. Business & GSTIN Information
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  Optional for B2C
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Supplying a valid GSTIN enables B2B Tax Invoicing and Input Tax Credit (ITC).
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Firm / Workshop / Garage Name
                  </span>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Ramesh Motors & Auto Repairs"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Buyer GSTIN (15 Characters)
                  </span>
                  <input
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AAACR1234K1Z0"
                    className={`h-11 w-full font-mono rounded-xl border bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 ${
                      gstin.trim() && gstinValidation
                        ? gstinValidation.valid
                          ? "border-emerald-500 text-emerald-950 focus:border-emerald-600 focus:ring-emerald-500/10"
                          : "border-rose-300 text-rose-950 focus:border-rose-500 focus:ring-rose-500/10"
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
                </div>
              </div>
            </section>

            {/* 3. Address & Logistics */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                3. Workshop Address & Delivery Location
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Default address pre-filled during checkout and order placement.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Address Line 1
                  </span>
                  <input
                    value={shippingAddressLine1}
                    onChange={(e) => setShippingAddressLine1(e.target.value)}
                    placeholder="Plot / Street / Industrial Area"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Address Line 2 (Optional)
                  </span>
                  <input
                    value={shippingAddressLine2}
                    onChange={(e) => setShippingAddressLine2(e.target.value)}
                    placeholder="Landmark / Unit Number"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    City / District
                  </span>
                  <input
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="City"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    State
                  </span>
                  <input
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    placeholder="State"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">
                    Pincode
                  </span>
                  <input
                    maxLength={6}
                    value={shippingPincode}
                    onChange={(e) => setShippingPincode(e.target.value)}
                    placeholder="6-digit Pincode"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-medium outline-none focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                  />
                </div>
              </div>
            </section>

            {/* 4. Transport & Shipping Preference */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                4. Default Fulfillment & Transport Booking
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose between regional self-pickup or booking through your regular transport agency.
              </p>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="courier"
                      checked={shippingPreference === "courier"}
                      onChange={() => setShippingPreference("courier")}
                    />
                    <span>Standard Courier Dispatch</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="self_pickup"
                      checked={shippingPreference === "self_pickup"}
                      onChange={() => setShippingPreference("self_pickup")}
                    />
                    <span>Self Pickup (Fulfillment Center)</span>
                  </label>

                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3.5 text-xs font-bold text-slate-800 cursor-pointer has-checked:border-slate-950 has-checked:bg-slate-50">
                    <input
                      type="radio"
                      name="shippingPref"
                      value="transport"
                      checked={shippingPreference === "transport"}
                      onChange={() => setShippingPreference("transport")}
                    />
                    <span>Book through Transport</span>
                  </label>
                </div>

                {shippingPreference === "transport" && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-4 animate-in fade-in">
                    <p className="text-xs font-bold text-slate-950">
                      Saved Transport Company Details
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="mb-1 block text-xs font-semibold text-slate-700">
                          Transport / Transporter Name <span className="text-rose-500">*</span>
                        </span>
                        <input
                          required={shippingPreference === "transport"}
                          value={transportName}
                          onChange={(e) => setTransportName(e.target.value)}
                          placeholder="e.g. V-Trans / Jaipur Golden"
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

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Link
                href="/"
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="btn-press rounded-xl bg-slate-950 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving Changes..." : "Save Customer Profile"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

