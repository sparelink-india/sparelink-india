"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { Notice } from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { getTelHref } from "@/lib/support-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

/**
 * V2 Support hub.
 *
 * Composition: hero + instant channels \u2192 self-service categories \u2192 FAQ
 * \u2192 escalation form. The form's endpoint, payload, rate-limit handling and
 * field constraints are unchanged; only the presentation and grouping are new.
 *
 * No support statistics, response-time promises or agent counts are shown,
 * because the project holds no data to substantiate them.
 */

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2.5 6.5L12 13l9.5-6.5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h6M9 16h4" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z" />
      <circle cx="6.5" cy="18.5" r="1.8" />
      <circle cx="17" cy="18.5" r="1.8" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}

export default function HelpSupportPage() {
  const { t } = useI18n();
  const whatsappHref = getWhatsAppChatUrl();
  const telHref = getTelHref(PUBLIC_SUPPORT_PHONE);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const response = await fetch("/api/support/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, email, orderId, subject, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) {
          setError(typeof data.error === "string" ? data.error : t("help.tooMany"));
          return;
        }
        if (response.status === 400 && typeof data.error === "string") {
          setError(data.error);
          return;
        }
        setError(t("help.unavailable"));
        return;
      }
      setStatus(t("help.sent"));
      setName("");
      setMobile("");
      setEmail("");
      setOrderId("");
      setSubject("");
      setMessage("");
    } catch {
      setError(t("help.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  /* Self-service categories. Each links to a real route or policy page that
     already exists \u2014 nothing here is a dead end. */
  const categories = [
    { icon: <DocIcon />, title: t("help.catOrders"), body: t("nav.track"), href: "/track-order" },
    { icon: <TruckIcon />, title: t("help.catDelivery"), body: t("legal.shipping"), href: "/shipping-policy" },
    { icon: <ReturnIcon />, title: t("help.catReturns"), body: t("legal.returns"), href: "/returns-refunds" },
    { icon: <CardIcon />, title: t("help.catPayment"), body: t("help.catPaymentBody"), href: "/terms-and-conditions" },
    { icon: <UserIcon />, title: t("help.catAccount"), body: t("help.catAccountBody"), href: "/profile" },
    { icon: <DocIcon />, title: t("help.catPolicies"), body: t("legal.privacy"), href: "/privacy-policy" },
  ];

  return (
    <div className="sl-page flex min-h-screen flex-col">
      <StorefrontHeader />

      <main className="sl-container sl-container-wide sl-page-main flex-1">
        {/* ---------- SUPPORT HERO ---------- */}
        <div className="relative overflow-hidden rounded-[var(--sl-radius-lg)] bg-[var(--sl-primary-dark)] px-5 py-9 text-white sm:px-10 sm:py-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 12% 0%, rgba(226,196,140,0.18) 0%, transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative max-w-2xl">
            <p className="sl-label !text-[var(--sl-gold-soft)]">{t("nav.help")}</p>
            <h1 className="sl-h1 mt-2 !text-white">{t("help.title")}</h1>
            <p className="sl-body mt-2.5 !text-white/75">{t("contact.intro")}</p>
          </div>
        </div>

        {/* ---------- INSTANT CHANNELS ---------- */}
        <section className="sl-band" aria-label={t("help.title")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <WhatsAppCta
              href={whatsappHref}
              label={t("wa.label")}
              className="sl-v2-card sl-v2-card-hover flex min-h-14 items-center justify-center px-4 py-3 font-semibold"
            />
            {telHref ? (
              <a href={telHref} className="sl-v2-btn sl-v2-btn-secondary">
                <PhoneIcon />
                {t("help.call")}
              </a>
            ) : null}
            <a href={`mailto:${PUBLIC_DISPLAY_EMAIL}`} className="sl-v2-btn sl-v2-btn-secondary">
              <MailIcon />
              {t("help.emailUs")}
            </a>
          </div>
        </section>

        {/* ---------- SELF-SERVICE CATEGORIES ---------- */}
        <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="help-categories">
          <h2 id="help-categories" className="sl-h2">
            {t("help.faqs")}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.title}
                href={category.href}
                className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex items-start gap-3.5 p-5"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
                  {category.icon}
                </span>
                <span className="min-w-0">
                  <span className="sl-h3 block transition-colors group-hover:text-[var(--sl-primary)]">
                    {category.title}
                  </span>
                  <span className="sl-small mt-1 block">{category.body}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="help-faq">
          <h2 id="help-faq" className="sl-h2">
            {t("help.faqTitle")}
          </h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {(
              [
                ["help.faq1q", "help.faq1a"],
                ["help.faq2q", "help.faq2a"],
                ["help.faq3q", "help.faq3a"],
              ] as const
            ).map(([q, a]) => (
              <article key={q} className="sl-v2-card p-5">
                <h3 className="sl-h3">{t(q)}</h3>
                <p className="sl-body mt-2 text-[0.875rem]">{t(a)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- ESCALATION FORM ----------
            The form is grouped: who you are, which order, what happened.
            This is the only place a support request is created. */}
        <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="help-form">
          <div className="max-w-2xl">
            <h2 id="help-form" className="sl-h2">
              {t("help.submit")}
            </h2>
            <p className="sl-body mt-2">{t("help.contactEscalation")}</p>
          </div>

          <form onSubmit={handleSubmit} className="sl-v2-card mt-5 space-y-5 p-5 sm:p-6">
            <fieldset>
              <legend className="sl-label">{t("help.groupYou")}</legend>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="hs-name" className="sl-label mb-1.5 block">
                    {t("help.name")}
                  </label>
                  <input
                    id="hs-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="sl-v2-input"
                    required
                    maxLength={120}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="hs-mobile" className="sl-label mb-1.5 block">
                    {t("help.mobile")}
                  </label>
                  <input
                    id="hs-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    className="sl-v2-input"
                    required
                    maxLength={30}
                    autoComplete="tel"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="hs-email" className="sl-label mb-1.5 block">
                    {t("help.email")}
                  </label>
                  <input
                    id="hs-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="sl-v2-input"
                    required
                    maxLength={120}
                    autoComplete="email"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="border-t border-[var(--sl-border)] pt-5">
              <legend className="sl-label">{t("help.groupIssue")}</legend>
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor="hs-order" className="sl-label mb-1.5 block">
                    {t("help.orderId")}
                  </label>
                  <input
                    id="hs-order"
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                    className="sl-v2-input !font-mono"
                    maxLength={80}
                  />
                  <p className="sl-small mt-1.5">{t("help.orderIdHint")}</p>
                </div>
                <div>
                  <label htmlFor="hs-subject" className="sl-label mb-1.5 block">
                    {t("help.subject")}
                  </label>
                  <input
                    id="hs-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="sl-v2-input"
                    required
                    maxLength={180}
                  />
                </div>
                <div>
                  <label htmlFor="hs-message" className="sl-label mb-1.5 block">
                    {t("help.message")}
                  </label>
                  <textarea
                    id="hs-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="sl-v2-input min-h-28 py-2.5"
                    required
                    maxLength={4000}
                  />
                </div>
              </div>
            </fieldset>

            <button type="submit" disabled={busy} className="sl-v2-btn sl-v2-btn-primary w-full sm:w-auto">
              {busy ? t("product.adding") : t("help.send")}
            </button>

            {error ? <Notice tone="error">{error}</Notice> : null}
            {status ? <Notice tone="success">{status}</Notice> : null}
          </form>
        </section>

        {/* ---------- POLICY LINKS ---------- */}
        <section className="sl-band border-t border-[var(--sl-border)]">
          <p className="sl-small">
            <Link href="/returns-refunds" className="sl-v2-focus font-semibold text-[var(--sl-primary)] hover:underline">
              {t("help.returnsShort")}
            </Link>
            {" · "}
            <Link href="/shipping-policy" className="sl-v2-focus font-semibold text-[var(--sl-primary)] hover:underline">
              {t("help.shippingShort")}
            </Link>
            {" · "}
            <Link href="/privacy-policy" className="sl-v2-focus font-semibold text-[var(--sl-primary)] hover:underline">
              {t("help.privacyShort")}
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
