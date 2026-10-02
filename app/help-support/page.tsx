"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { getTelHref } from "@/lib/support-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

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

  return (
    <div className="flex min-h-screen flex-col bg-[var(--v3-sunk)]">
      <StorefrontHeader />
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-[var(--v3-text)]">{t("help.title")}</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-semibold text-[var(--v3-text-3)]">{t("help.phoneLabel")}</dt>
            <dd className="font-semibold">{PUBLIC_SUPPORT_PHONE}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--v3-text-3)]">{t("help.emailLabel")}</dt>
            <dd className="font-semibold">{PUBLIC_DISPLAY_EMAIL}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <WhatsAppCta
            href={whatsappHref}
            label={t("wa.label")}
            className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-4 py-3"
          />
          {telHref ? (
            <a href={telHref} className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-4 py-3 font-semibold text-[var(--v3-text)]">
              {t("help.call")}
            </a>
          ) : null}
          <a
            href={`mailto:${PUBLIC_DISPLAY_EMAIL}`}
            className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] px-4 py-3 font-semibold text-[var(--v3-text)]"
          >
            {t("help.emailUs")}
          </a>
        </div>

        <h2 className="mt-10 text-lg font-semibold">{t("help.faqs")}</h2>
        <div className="mt-3 space-y-3">
          {(
            [
              ["help.faq1q", "help.faq1a"],
              ["help.faq2q", "help.faq2a"],
              ["help.faq3q", "help.faq3a"],
            ] as const
          ).map(([q, a]) => (
            <article key={q} className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-4">
              <h3 className="font-semibold">{t(q)}</h3>
              <p className="mt-1 text-sm text-[var(--v3-text-2)]">{t(a)}</p>
            </article>
          ))}
        </div>

        <h2 className="v3-h2 mt-10">{t("help.submit")}</h2>
        {/* VISIBLE LABELS.

            Every field here was identified ONLY by its placeholder, which means
            the accessible name was empty and the instruction vanished the moment
            the visitor typed a character - the WCAG 3.3.2 / 4.1.2 failure that
            placeholder-only forms produce. The label text is the SAME i18n key
            the placeholder already used, so no new copy is invented and Hindi
            gets a labelled field too.

            The labels are `sr-only` rather than visible because the form is
            narrow and six stacked visible labels push the first field below the
            fold; the name is still announced, which is what 4.1.2 requires. */}
        <form onSubmit={handleSubmit} className="v3-panel mt-3 space-y-3 p-5">
          <div>
            <label htmlFor="help-name" className="v3-label">
              {t("help.name")}
            </label>
            <input
              id="help-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("help.name")}
              className="v3-input mt-1.5"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="help-mobile" className="v3-label">
              {t("help.mobile")}
            </label>
            <input
              id="help-mobile"
              name="mobile"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder={t("help.mobile")}
              className="v3-input mt-1.5"
              required
              maxLength={30}
            />
          </div>
          <div>
            <label htmlFor="help-email" className="v3-label">
              {t("help.email")}
            </label>
            <input
              id="help-email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("help.email")}
              type="email"
              className="v3-input mt-1.5"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="help-order-id" className="v3-label">
              {t("help.orderId")}
            </label>
            <input
              id="help-order-id"
              name="orderId"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder={t("help.orderId")}
              className="v3-input mt-1.5"
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="help-subject" className="v3-label">
              {t("help.subject")}
            </label>
            <input
              id="help-subject"
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("help.subject")}
              className="v3-input mt-1.5"
              required
              maxLength={180}
            />
          </div>
          <div>
            <label htmlFor="help-message" className="v3-label">
              {t("help.message")}
            </label>
            <textarea
              id="help-message"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("help.message")}
              className="v3-input mt-1.5 min-h-28 !py-2"
              required
              maxLength={4000}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="v3-btn v3-btn-primary v3-focus w-full !min-h-11 disabled:opacity-60"
          >
            {t("help.send")}
          </button>
          {error ? (
            <p role="alert" className="text-sm text-[var(--v3-bad)]">
              {error}
            </p>
          ) : null}
          {status ? (
            <p role="status" className="text-sm text-[var(--v3-ok)]">
              {status}
            </p>
          ) : null}
        </form>
        <p className="mt-4 text-xs text-[var(--v3-text-3)]">
          <Link href="/returns-refunds" className="underline">{t("help.returnsShort")}</Link>
          {" · "}
          <Link href="/shipping-policy" className="underline">{t("help.shippingShort")}</Link>
          {" · "}
          <Link href="/privacy-policy" className="underline">{t("help.privacyShort")}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
