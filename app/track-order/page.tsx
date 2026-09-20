"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

type TrackedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  createdAt: string;
  items: { id: string; partName: string; partNumber: string; quantity: number; totalPaise: number }[];
};

export default function TrackOrderPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const whatsappHref = getWhatsAppChatUrl("Hello SpareLink India, I need help tracking an order.");

  async function handleTrack(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOrder(null);
    setNeedsLogin(false);
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/track?q=${encodeURIComponent(query.trim())}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.status === 401) {
        setNeedsLogin(true);
        setError(t("track.signin"));
        return;
      }
      if (response.status === 404) {
        setError(t("track.notFound"));
        return;
      }
      if (!response.ok) {
        setError(data.error || t("track.fail"));
        return;
      }
      setOrder(data.order);
    } catch {
      setError(t("track.fail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("track.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("track.hint")}</p>
        <form onSubmit={handleTrack} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("track.id")}
            className="h-12 flex-1 rounded-xl border border-slate-300 px-4"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="h-12 rounded-xl bg-[#7a1233] px-5 font-semibold text-white disabled:opacity-50"
          >
            {t("track.button")}
          </button>
        </form>
        {!query.trim() && !order && !error ? (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t("track.empty")}
          </p>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>{error}</p>
            {needsLogin ? (
              <Link href="/login" className="mt-3 inline-block font-semibold text-[#7a1233] underline">
                {t("dealer.customerLogin")}
              </Link>
            ) : null}
          </div>
        ) : null}
        {order ? (
          <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <p className="font-semibold">#{order.orderNumber}</p>
            <p className="mt-1 text-sm text-slate-500">{t("track.status", { status: order.status, payment: order.paymentStatus })}</p>
            <p className="mt-1 text-sm">{t("track.total", { amount: (order.totalPaise / 100).toLocaleString("en-IN") })}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.partName} ({item.partNumber}) × {item.quantity}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
        <div className="mt-8">
          <WhatsAppCta href={whatsappHref} label={t("wa.chat")} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
