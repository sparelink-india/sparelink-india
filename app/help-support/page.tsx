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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("help.title")}</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-semibold text-slate-500">{t("help.phoneLabel")}</dt>
            <dd className="font-semibold">{PUBLIC_SUPPORT_PHONE}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">{t("help.emailLabel")}</dt>
            <dd className="font-semibold">{PUBLIC_DISPLAY_EMAIL}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <WhatsAppCta
            href={whatsappHref}
            label={t("wa.label")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          />
          {telHref ? (
            <a href={telHref} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800">
              {t("help.call")}
            </a>
          ) : null}
          <a
            href={`mailto:${PUBLIC_DISPLAY_EMAIL}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800"
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
            <article key={q} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">{t(q)}</h3>
              <p className="mt-1 text-sm text-slate-600">{t(a)}</p>
            </article>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-semibold">{t("help.submit")}</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("help.name")} className="h-11 w-full rounded-lg border px-3" required maxLength={120} />
          <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder={t("help.mobile")} className="h-11 w-full rounded-lg border px-3" required maxLength={30} />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("help.email")} type="email" className="h-11 w-full rounded-lg border px-3" required maxLength={120} />
          <input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder={t("help.orderId")} className="h-11 w-full rounded-lg border px-3" maxLength={80} />
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t("help.subject")} className="h-11 w-full rounded-lg border px-3" required maxLength={180} />
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("help.message")} className="min-h-28 w-full rounded-lg border px-3 py-2" required maxLength={4000} />
          <button type="submit" disabled={busy} className="h-11 rounded-lg bg-[#7a1233] px-4 font-semibold text-white disabled:opacity-60">
            {t("help.send")}
          </button>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
        </form>
        <p className="mt-4 text-xs text-slate-500">
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
