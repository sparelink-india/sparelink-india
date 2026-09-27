"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthAlert } from "@/components/auth-shell";
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
    <div className="sl-page flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex flex-1 items-center justify-center bg-[var(--sl-cream)] px-5 py-12 sm:px-8">
        <div className="w-full max-w-[30rem]">
          <div className="sl-v2-card p-6 sm:p-8">
            <p className="sl-label">{t("account.security")}</p>
            <h1 className="sl-h1 mt-2">{t("account.passwordTitle")}</h1>
            <p className="sl-body mt-2.5">{t("account.bootstrapHint")}</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="cp-current" className="sl-label block">
                  {t("account.current")}
                </label>
                <input
                  id="cp-current"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder={t("account.current")}
                  className="sl-v2-input mt-1.5"
                  aria-invalid={error ? true : undefined}
                  required
                />
              </div>

              {/* Divider marks where the new credential begins, so the three
                  fields read as two groups rather than one flat stack. */}
              <div className="border-t border-[var(--sl-border)] pt-4">
                <div>
                  <label htmlFor="cp-new" className="sl-label block">
                    {t("account.new")}
                  </label>
                  <input
                    id="cp-new"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={t("account.new")}
                    className="sl-v2-input mt-1.5"
                    required
                  />
                </div>
                <div className="mt-4">
                  <label htmlFor="cp-confirm" className="sl-label block">
                    {t("account.confirm")}
                  </label>
                  <input
                    id="cp-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={t("account.confirm")}
                    className="sl-v2-input mt-1.5"
                    aria-invalid={
                      confirmPassword.length > 0 && newPassword !== confirmPassword
                        ? true
                        : undefined
                    }
                    required
                  />
                  {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
                    <p role="alert" className="sl-small mt-1.5 !text-[var(--sl-danger)]">
                      {t("account.mismatch")}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="sl-v2-btn sl-v2-btn-primary w-full"
              >
                {busy ? t("product.adding") : t("account.save")}
              </button>
            </form>

            {message ? <AuthAlert tone="success">{message}</AuthAlert> : null}
            {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
