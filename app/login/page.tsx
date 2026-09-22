"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/username-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("login.fail"));
        return;
      }
      setMessage(t("login.ok"));
      router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/");
      router.refresh();
    } catch {
      setError(t("login.fail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <Link href="/" className="text-xs font-semibold text-[#7a1233] hover:underline">
            {t("search.catalog")}
          </Link>
          <div className="mt-4">
            <BrandLogo />
          </div>
          <h1 className="sr-only">SpareLink India</h1>
          <p className="mt-2 text-sm text-zinc-500">{t("login.passwordHint")}</p>

          <form onSubmit={handlePasswordLogin} className="mt-8 space-y-4">
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("login.username")}
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("login.password")}
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#7a1233] font-medium text-white hover:bg-[#611029] disabled:opacity-60"
            >
              {t("login.submit")}
            </button>
          </form>

          <div className="mt-6">
            <GoogleSignInButton />
          </div>

          <div className="pt-4 text-center text-xs text-zinc-500">
            {t("login.new")}{" "}
            <Link href="/register" className="font-bold text-zinc-900 underline hover:text-zinc-700">
              {t("login.register")}
            </Link>
            <span className="mx-1">·</span>
            <Link href="/login/dealer" className="font-bold text-zinc-900 underline hover:text-zinc-700">
              {t("login.dealerLink")}
            </Link>
          </div>

          {message ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
