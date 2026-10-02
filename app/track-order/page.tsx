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
    <div className="flex min-h-screen flex-col bg-[var(--v3-sunk)]">
      <StorefrontHeader />
      <main id="main-content" className="v3-container flex-1 py-10">
        <h1 className="v3-h1">{t("track.title")}</h1>
        <p className="v3-body mt-2">{t("track.hint")}</p>
        {/* The order-id field had a placeholder but no label, so its accessible
            name was empty and the instruction disappeared once a visitor typed.
            A visible label plus `htmlFor` fixes 3.3.2 / 4.1.2 without changing the
            copy: the label reuses the same `track.id` key. */}
        <form onSubmit={handleTrack} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="track-order-id" className="v3-label">
              {t("track.id")}
            </label>
            <input
              id="track-order-id"
              name="orderId"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("track.id")}
              className="v3-input mt-1.5 !min-h-12"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="v3-btn v3-btn-primary v3-focus !min-h-12 !px-5 disabled:opacity-50"
          >
            {t("track.button")}
          </button>
        </form>
        {!query.trim() && !order && !error ? (
          <p className="mt-8 rounded-[var(--v3-r)] border border-dashed border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] p-8 text-center text-sm text-[var(--v3-text-3)]">
            {t("track.empty")}
          </p>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-[var(--v3-r)] border border-[var(--v3-warn-line)] bg-[var(--v3-warn-soft)] p-4 text-sm text-[var(--v3-warn)]">
            <p>{error}</p>
            {needsLogin ? (
              <Link href="/login" className="mt-3 inline-block font-semibold text-[var(--v3-brand-ink)] underline">
                {t("dealer.customerLogin")}
              </Link>
            ) : null}
          </div>
        ) : null}
        {order ? (
          <article className="mt-6 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-6">
            <p className="font-semibold">#{order.orderNumber}</p>
            <p className="mt-1 text-sm text-[var(--v3-text-3)]">{t("track.status", { status: order.status, payment: order.paymentStatus })}</p>
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
