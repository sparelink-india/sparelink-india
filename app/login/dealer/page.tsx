"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";
import {
  DEALER_OTP,
  DEALER_OTP_EXTERNAL_CONFIG,
  GOOGLE_EXTERNAL_CONFIG,
  validateDealerId,
} from "@/lib/dealer-identity";
import { isGoogleOAuthConfigured } from "@/lib/auth-flags";

/**
 * /login/dealer - the dealer surface.
 *
 * THE THREE SURFACES. This route, /login and /admin each authenticate one
 * audience and post an `expectedRole`. The role gate in
 * `/api/auth/username-login` refuses anything else, and that refusal is the
 * behaviour - not a bug - behind the reported "This account cannot use this
 * login." An admin is not a dealer, and the fix for a person who needs both is
 * an explicit linked dealer record, never a wider check.
 *
 * THE FIELD IS A DEALER ID, NOT A USERNAME. `DEALER001`, permanently assigned
 * to the dealer. It is validated client-side for a clear message, but the
 * authoritative check is server-side in the login route, because a client
 * check is a convenience and never a control.
 *
 * GOOGLE AND WHATSAPP OTP ARE NOT RENDERED.
 * Both need credentials this environment does not have:
 *
 *   - Google requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
 *   - The WhatsApp OTP send needs a delivery gateway that is actually a
 *     WhatsApp channel; the project has a generic OTP webhook hook, which may
 *     or may not be one.
 *
 * Rendering either button now would produce a control a dealer can press and
 * cannot complete, which is worse than an honest absence. The architecture for
 * both is in `lib/dealer-identity.ts` and is unit-tested, so enabling either is
 * a configuration change. `googleConfigured` below is read from the server so
 * the moment the credentials land the button appears with no code edit.
 */
export default function DealerLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleConfigured = isGoogleOAuthConfigured();

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

  const idCheck = validateDealerId(identifier);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");

    /* A clear, specific message before the request, rather than a generic
       server refusal. The server still decides - this only saves a round trip
       and tells the dealer which field is wrong. */
    if (!idCheck.ok) {
      setError(
        idCheck.reason === "empty"
          ? t("dealer.idRequired")
          : t("dealer.idFormat"),
      );
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/username-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The NORMALISED id, so "dealer-001" and "DEALER001" are the same
        // dealer and cannot create a second record.
        body: JSON.stringify({
          username: idCheck.dealerId,
          password,
          expectedRole: "dealer",
        }),
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
          <Link href="/" className="text-xs font-semibold text-[var(--v3-brand-ink)] hover:underline">
            {t("search.catalog")}
          </Link>
          <div className="mt-4">
            <BrandLogo />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">{t("dealer.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("dealer.hint")}</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="dealer-id" className="block text-sm font-medium text-zinc-800">
                {t("dealer.idLabel")}
              </label>
              <input
                id="dealer-id"
                name="dealerId"
                type="text"
                autoComplete="username"
                autoCapitalize="characters"
                spellCheck={false}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={t("dealer.idPlaceholder")}
                aria-describedby="dealer-id-help"
                aria-invalid={identifier.length > 0 && !idCheck.ok}
                className="mt-1.5 h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
                required
              />
              <p id="dealer-id-help" className="mt-1.5 text-xs text-zinc-500">
                {t("dealer.idHelp")}
              </p>
            </div>

            <div>
              <label htmlFor="dealer-password" className="block text-sm font-medium text-zinc-800">
                {t("login.password")}
              </label>
              <input
                id="dealer-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-950"
                required
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#7a1233] font-medium text-white transition-colors hover:bg-[#611029] disabled:opacity-60"
            >
              {busy ? t("signInBusy") : t("dealer.submit")}
            </button>
          </form>

          {/* GOOGLE.
              Rendered only when the provider is actually configured, checked
              server-side. Wiring the button without credentials would send a
              dealer to a callback that cannot complete. */}
          {googleConfigured ? (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
                <span className="h-px flex-1 bg-zinc-200" />
                {t("common.or")}
                <span className="h-px flex-1 bg-zinc-200" />
              </div>
              {/* A plain anchor, deliberately, and the ESLint rule that objects
                  is disabled inline.

                  This is not a page navigation: it is a POST to the auth
                  provider to start an OAuth handshake, and a client-side
                  <Link> would try to prefetch and route it as a document.
                  The storefront has a GoogleSignIn component for the customer
                  surface; this is the dealer equivalent, pointing at the
                  provider start endpoint. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/auth/sign-in/social"
                data-provider="google"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 font-medium transition-colors hover:bg-zinc-50"
              >
                {t("dealer.continueGoogle")}
              </a>
            </>
          ) : null}

          {/* WHATSAPP OTP. Same rule: not rendered, because the send depends
              on a delivery gateway this codebase cannot verify is WhatsApp. */}
          {process.env.NEXT_PUBLIC_DEALER_OTP === "true" ? (
            <button
              type="button"
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 font-medium text-emerald-800 transition-colors hover:bg-emerald-50"
            >
              {t("dealer.loginOtp")}
              <span className="sr-only">
                {`${DEALER_OTP.length} ${t("dealer.otpDigits")}`}
              </span>
            </button>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-center text-xs text-zinc-500">
            {t("dealer.customer")}{" "}
            <Link
              href="/login"
              className="font-semibold text-zinc-900 underline hover:text-zinc-700"
            >
              {t("dealer.customerLogin")}
            </Link>
          </p>

          {/* The exact external configuration, in the page itself, so whoever
              deploys this knows what is outstanding without reading the
              source. Development-only: it names environment variables, which
              has no place in production UI. */}
          {process.env.NODE_ENV !== "production" ? (
            <details className="mt-6 rounded-xl bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-600">
              <summary className="cursor-pointer font-semibold">
                {t("dealer.pendingSetup")}
              </summary>
              <p className="mt-2 font-semibold">Google</p>
              <ul className="list-inside list-disc">
                {GOOGLE_EXTERNAL_CONFIG.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2 font-semibold">{t("dealer.otpSetup")}</p>
              <ul className="list-inside list-disc">
                {DEALER_OTP_EXTERNAL_CONFIG.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
