"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";

export default function DealerLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session-flags", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated && data.role === "dealer") {
          router.replace(data.mustChangePassword ? "/account/change-password" : "/dealer");
        }
      })
      .catch(() => undefined);
  }, [router]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/username-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, expectedRole: "dealer" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("dealer.fail"));
        return;
      }
      router.push(typeof data.redirectTo === "string" ? data.redirectTo : "/dealer");
      router.refresh();
    } catch {
      setError(t("dealer.fail"));
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
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">{t("dealer.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("dealer.hint")}</p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
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
              {t("dealer.submit")}
            </button>
          </form>
          {error ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <p className="mt-4 text-center text-xs text-zinc-500">
            {t("dealer.customer")}{" "}
            <Link href="/login" className="font-semibold text-zinc-900 underline">
              {t("dealer.customerLogin")}
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
