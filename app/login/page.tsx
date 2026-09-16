"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";

function normalizeIndianPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return value.trim();
}

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedPhoneNumber = normalizeIndianPhoneNumber(phoneNumber);
    if (!/^\+91[6-9]\d{9}$/.test(normalizedPhoneNumber)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setPhoneNumber(normalizedPhoneNumber);

    const response = await fetch("/api/auth/phone-number/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: normalizedPhoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Unable to send OTP.");
      return;
    }

    setStep("otp");
    setMessage("OTP sent. Check your mobile.");
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedPhoneNumber = normalizeIndianPhoneNumber(phoneNumber);

    const response = await fetch("/api/auth/phone-number/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: normalizedPhoneNumber, code }),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      setError(data.error || "Invalid OTP.");
      return;
    }

    setMessage("Login successful. Redirecting...");
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-xs font-semibold text-emerald-700 hover:underline">
          ← Catalog
        </Link>
        <h1 className="mt-3 text-2xl font-bold">SpareLink India</h1>
        <p className="mt-2 text-sm text-zinc-500">Buyer Login</p>

        {step === "phone" ? (
          <form onSubmit={sendOtp} className="mt-8 space-y-4">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+91XXXXXXXXXX"
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-zinc-950 font-medium text-white hover:bg-zinc-800"
            >
              Send OTP
            </button>

            <div className="pt-2 text-center text-xs text-zinc-500">
              New customer or workshop?{" "}
              <a href="/register" className="font-bold text-zinc-900 underline hover:text-zinc-700">
                Register Account
              </a>
            </div>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-8 space-y-4">
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter OTP"
              maxLength={6}
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-zinc-950 font-medium text-white hover:bg-zinc-800"
            >
              Verify OTP
            </button>
          </form>
        )}

        {message && (
          <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
    <SiteFooter />
    </div>
  );
}
