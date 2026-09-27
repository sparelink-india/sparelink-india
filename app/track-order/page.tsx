"use client";

import { FormEvent, useState } from "react";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { EmptyState, ErrorState, StateIcons } from "@/components/page-states";
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
    <div className="sl-page flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="sl-container sl-container-narrow sl-page-main flex-1">
        {/* ---- Order identity: search first, result below ---- */}
        <p className="sl-label">{t("nav.track")}</p>
        <h1 className="sl-h1 mt-1.5">{t("track.searchTitle")}</h1>
        <p className="sl-body mt-2 max-w-prose">{t("track.searchHint")}</p>

        <form
          onSubmit={handleTrack}
          className="sl-v2-card mt-6 flex flex-col gap-2.5 p-3 sm:flex-row"
        >
          <label htmlFor="track-query" className="sr-only">
            {t("track.searchPlaceholder")}
          </label>
          <input
            id="track-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("track.searchPlaceholder")}
            className="sl-v2-input flex-1"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="sl-v2-btn sl-v2-btn-primary shrink-0 sm:w-44"
          >
            {busy ? t("product.adding") : t("track.searchAction")}
          </button>
        </form>

        {!query.trim() && !order && !error ? (
          <div className="mt-7">
            <EmptyState
              icon={StateIcons.orders}
              title={t("track.empty")}
              body={t("track.emptyBody")}
              action={{ href: "/orders", label: t("nav.orders") }}
              secondaryAction={{ href: "/help-support", label: t("nav.help") }}
            />
          </div>
        ) : null}

        {error ? (
          <div className="mt-6">
            <ErrorState
              title={t("track.notFoundTitle")}
              body={error}
              onRetry={() => void handleTrack(new Event("submit") as never)}
              action={needsLogin ? { href: "/login", label: t("nav.login") } : undefined}
            />
          </div>
        ) : null}

        {order ? (
          /* ---- Result: two columns. Timeline left, order facts right. ---- */
          <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
            <section className="sl-v2-card p-5 sm:p-6" aria-label={t("track.progressLabel")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--sl-border)] pb-4">
                <div>
                  <p className="sl-label">{t("track.orderLabel")}</p>
                  <p className="sl-partno mt-1 !text-sm !font-bold">{order.orderNumber}</p>
                </div>
                <p className="sl-small">{t("track.placedOn", { date: order.createdAt })}</p>
              </div>

              <div className="mt-5">
                <OrderStatusTimeline
                  status={order.status}
                  paymentStatus={order.paymentStatus}
                />
              </div>

              {/* Honest disclosure: this project has no courier integration, so
                  no tracking number or scan feed is shown. Saying so is better
                  than leaving the user wondering where it is. */}
              <p className="sl-small mt-5 border-t border-[var(--sl-border)] pt-4">
                {t("track.noCarrierNote")}
              </p>
            </section>

            <aside className="sl-v2-card p-5 sm:p-6">
              <h2 className="sl-h2">{t("track.summaryTitle")}</h2>
              <p className="mt-3 flex items-baseline justify-between border-b border-[var(--sl-border)] pb-3">
                <span className="sl-small">{t("cart.total")}</span>
                <span className="sl-price">
                  ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                </span>
              </p>

              <h3 className="sl-label mt-5">{t("track.itemsLabel")}</h3>
              <ul className="mt-2.5 space-y-3">
                {order.items.map((item) => (
                  <li key={item.id} className="border-b border-[var(--sl-border)] pb-3 last:border-0 last:pb-0">
                    <p className="sl-h3 !text-sm">{item.partName}</p>
                    <p className="sl-partno mt-0.5">
                      <span className="sr-only">Part number: </span>
                      {item.partNumber}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="sl-small">× {item.quantity}</span>
                      <span className="sl-small font-semibold">
                        ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        ) : null}

        <div className="mt-8">
          <WhatsAppCta href={whatsappHref} label={t("wa.chat")} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
