"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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

    const response = await fetch("/api/auth/phone-number/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Unable to send OTP.");
      return;
    }

    setStep("otp");
    setMessage("OTP sent. Check the server console.");
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/phone-number/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code }),
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
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">SpareLink India</h1>
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
  );
}
