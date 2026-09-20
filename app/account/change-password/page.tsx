"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError(t("account.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("account.fail"));
        return;
      }
      setMessage(t("account.updated"));
      router.push("/");
      router.refresh();
    } catch {
      setError(t("account.fail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <BrandLogo />
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">{t("account.passwordTitle")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("account.bootstrapHint")}
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={t("account.current")}
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t("account.new")}
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("account.confirm")}
              className="h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#7a1233] font-medium text-white hover:bg-[#611029] disabled:opacity-60"
            >
              {t("account.save")}
            </button>
          </form>
          {message ? <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p> : null}
          {error ? <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
