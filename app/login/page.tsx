"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
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
  const [showPassword, setShowPassword] = useState(false);

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

  const promises = [
    t("trust.genuine"),
    t("trust.panIndia"),
    t("trust.support"),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--v3-page)]">
      <StorefrontHeader />
      <main id="main-content" className="flex flex-1 items-stretch justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* TWO PANELS ON DESKTOP, ONE COLUMN ON MOBILE.

            Left is the brand and a real automotive photograph; right is the
            form. The photograph is the EXISTING approved hero artwork
            (`hero-banner-full.webp`) - reused rather than commissioned, so this
            is a presentation change and not new brand imagery.

            The left panel is `hidden lg:flex`, so mobile gets the form alone with
            no wasted vertical space above the fold - the single most common
            failure of a two-panel auth layout on a 360px screen.

            It is also deliberately `aria-hidden`: it repeats three promises that
            the site states elsewhere and adds nothing a screen-reader user needs
            before typing a username. */}
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] shadow-[var(--v3-lift-hi)] lg:grid-cols-[1.05fr_1fr]">
          <div className="relative hidden overflow-hidden bg-[var(--v3-inverse)] lg:block" aria-hidden="true">
            <Image
              src="/images/hero/hero-banner-full.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 520px, 0px"
              className="object-cover opacity-70"
            />
            {/* A burgundy-to-transparent wash so the white promise text keeps its
                contrast over whatever part of the photograph sits behind it,
                without darkening the whole image into a black rectangle. */}
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(23,17,15,0.92)] via-[rgba(23,17,15,0.55)] to-[rgba(23,17,15,0.25)]" />
            <div className="relative flex h-full flex-col justify-end p-8">
              <p className="v3-label !text-white/70">{t("trust.title")}</p>
              <ul className="mt-3 space-y-2.5">
                {promises.map((promise) => (
                  <li key={promise} className="flex items-start gap-2.5 text-sm font-semibold text-white">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--v3-gold)]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{promise}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <Link
              href="/products"
              className="v3-focus inline-flex min-h-9 items-center text-xs font-semibold text-[var(--v3-brand-ink)] hover:underline"
            >
              ← {t("search.catalog")}
            </Link>

            <div className="mt-3">
              <BrandLogo />
            </div>

            {/* The single <h1> is the form's own purpose. The page previously
                had `<h1 className="sr-only">SpareLink India</h1>` alongside a
                visible heading pattern, which put the brand name and the page
                purpose in competition as top-level landmarks. */}
            <h1 className="v3-h2 mt-5">{t("login.passwordHint")}</h1>

            <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-username" className="v3-label">
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
                  className="v3-input mt-1.5"
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="v3-label">
                  {t("login.password")}
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t("login.password")}
                    className="v3-input !pr-24"
                    required
                  />
                  {/* A real <button> inside the field: the toggle's accessible
                      name states whether it will SHOW or HIDE, which is what a
                      screen-reader user needs - "toggle" would not say which way
                      the password is currently set. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? t("login.hidePassword") : t("login.showPassword")
                    }
                    aria-pressed={showPassword}
                    className="v3-focus absolute inset-y-0 right-1 flex min-w-[5.5rem] items-center justify-center rounded-[var(--v3-r)] text-[11px] font-bold uppercase tracking-wide text-[var(--v3-text-2)] hover:text-[var(--v3-text)]"
                  >
                    {showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="v3-btn v3-btn-primary v3-focus !min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("login.submit")}
              </button>
            </form>

            <div className="mt-6">
              <GoogleSignInButton />
            </div>

            {/* No Dealer Login link beside Register.

                A visitor who reaches /login is a customer or a retailer by
                definition - they followed a customer-facing prompt. Offering
                them a trade-portal login on the same screen made the two
                audiences indistinguishable, and it is the surface where the
                reported "This account cannot use this login." error is most
                likely to be met by an admin who signs in here first.

                The ROUTE is untouched. /login/dealer still resolves on direct
                navigation, and the dealer layout still redirects there. */}
            <div className="v3-rule-gold mt-6 border-t border-[var(--v3-rule)] pt-5 text-center text-xs text-[var(--v3-text-2)]">
              {t("login.new")}{" "}
              <Link
                href="/register"
                className="v3-focus font-bold text-[var(--v3-brand-ink)] underline"
              >
                {t("login.register")}
              </Link>
            </div>

            {message ? (
              <p
                role="status"
                className="mt-4 rounded-[var(--v3-r)] border border-[var(--v3-ok-line)] bg-[var(--v3-ok-soft)] p-3 text-sm text-[var(--v3-ok)]"
              >
                {message}
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-[var(--v3-r)] border border-[var(--v3-bad-line)] bg-[var(--v3-bad-soft)] p-3 text-sm text-[var(--v3-bad)]"
              >
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
