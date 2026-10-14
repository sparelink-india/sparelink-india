"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthShell } from "@/components/auth-shell";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";

/**
 * Dealer Login — same shell as customer login but with a distinct B2B
 * register: the copy names the bulk-ordering functionality that actually
 * exists, and no claim is made that isn't substantiated.
 *
 * Authentication is unchanged: same endpoint, same `expectedRole: "dealer"`
 * payload, same session-flags pre-check, same redirects.
 */
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
    <div className="flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">
      <StorefrontHeader />
      <AuthShell
        variant="dealer"
        eyebrow={t("auth.dealerEyebrow")}
        heading={t("dealer.title")}
        intro={t("dealer.hint")}
        bullets={[
          { title: t("auth.dealerB1"), body: t("auth.dealerB1Body") },
          { title: t("auth.dealerB2"), body: t("auth.dealerB2Body") },
          { title: t("auth.dealerB3"), body: t("auth.dealerB3Body") },
        ]}
        footerNote={
          <p className="sl-meta text-center text-[var(--sl-graphite-ink-2)]">
            {t("dealer.customer")}{" "}
            <Link
              href="/login"
              className="sl-focus font-bold text-[var(--v3-gold)] hover:underline"
            >
              {t("dealer.customerLogin")}
            </Link>
          </p>
        }
      >
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="dealer-username" className="sl-label">
              {t("login.username")}
            </label>
            <input
              id="dealer-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("login.username")}
              className="sl-input"
              required
            />
          </div>

          <div>
            <label htmlFor="dealer-password" className="sl-label">
              {t("login.password")}
            </label>
            <input
              id="dealer-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("login.password")}
              className="sl-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="sl-btn sl-btn-primary sl-btn-block"
          >
            {busy ? t("product.adding") : t("dealer.submit")}
          </button>
        </form>

        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
      </AuthShell>
      <SiteFooter />
    </div>
  );
}
