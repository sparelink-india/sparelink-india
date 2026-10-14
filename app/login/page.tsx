"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthShell } from "@/components/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";

/**
 * Login — Precision shell over the V3 composition. Authentication logic is
 * byte-identical to the previous version: same `/api/auth/username-login`
 * endpoint, same payload, same redirect handling. Only the presentation is new.
 */
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
    <div className="flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">
      <StorefrontHeader />
      <AuthShell
        eyebrow={t("auth.loginEyebrow")}
        heading={t("auth.loginHeading")}
        intro={t("auth.loginIntro")}
        bullets={[
          { title: t("auth.loginB1"), body: t("auth.loginB1Body") },
          { title: t("auth.loginB2"), body: t("auth.loginB2Body") },
          { title: t("auth.loginB3"), body: t("auth.loginB3Body") },
        ]}
        footerNote={
          <div className="sl-panel sl-panel-pad">
            <p className="sl-meta">
              {t("login.new")}{" "}
              <Link
                href="/register"
                className="sl-focus font-bold text-[var(--sl-brand-ink)] hover:underline"
              >
                {t("login.register")}
              </Link>
            </p>
            <div className="mt-3 border-t border-[var(--sl-rule)] pt-3">
              <p className="sl-meta">
                {t("login.dealerLink")}{" "}
                <Link
                  href="/login/dealer"
                  className="sl-focus font-bold text-[var(--sl-brand-ink)] hover:underline"
                >
                  {t("nav.dealer")}
                </Link>
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate={false}>
          <div>
            <label htmlFor="login-username" className="sl-label">
              {t("login.username")}
            </label>
            <input
              id="login-username"
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
            <label htmlFor="login-password" className="sl-label">
              {t("login.password")}
            </label>
            <input
              id="login-password"
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
            {busy ? t("product.adding") : t("login.submit")}
          </button>
        </form>

        <div className="mt-5">
          <GoogleSignInButton />
        </div>

        {message ? <AuthAlert tone="success">{message}</AuthAlert> : null}
        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

        <Link
          href="/"
          className="sl-focus sl-meta mt-5 inline-flex items-center gap-1.5 hover:text-[var(--sl-brand-ink)]"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {t("search.catalog")}
        </Link>
      </AuthShell>
      <SiteFooter />
    </div>
  );
}
