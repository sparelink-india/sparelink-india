"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/preferences-provider";
import { DealerBackLink } from "@/components/dealer-back-link";
import { Notice } from "@/components/page-states";
import { StorefrontShell } from "@/components/storefront-shell";

type SO = {
  id: string;
  soNumber: string;
  status: string;
  partyName: string;
  totalPaise: number;
  createdAt: string;
};

type SearchHit = {
  partNumber: string | null;
  name: string | null;
  listing: { listingId: string; partName: string; pricePaise: number } | null;
};

export default function DealerSalesOrdersPage() {
  /* These labels were hardcoded English, so the dealer order views were
     untranslated. The view is unchanged; only the copy is looked up now. */
  const { t } = useI18n();

  const [orders, setOrders] = useState<SO[]>([]);
  const [error, setError] = useState("");
  const [partyName, setPartyName] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [lines, setLines] = useState<
    Array<{ dealerListingId: string; quantity: number; label: string }>
  >([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch("/api/dealer/sales-orders", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setOrders(d.salesOrders);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load().catch((e) =>
        setError(e instanceof Error ? e.message : t("orders.loadFail")),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [t]);

  const search = async () => {
    const r = await fetch(
      `/api/b2b/product-search?q=${encodeURIComponent(q.trim())}`,
      { cache: "no-store" },
    );
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || t("product.searchFail"));
      return;
    }
    setHits(d.hits ?? []);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/dealer/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyName: partyName || undefined,
          items: lines.map((l) => ({
            dealerListingId: l.dealerListingId,
            quantity: l.quantity,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setLines([]);
      setPartyName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickOrder.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StorefrontShell>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sl-rule)] pb-4">
        <span className="sl-eyebrow">{t("dealer.salesOrdersTitle")}</span>
      </div>
      <div className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="sl-h2">{t("dealer.b2bSalesTitle")}</h1>
          <DealerBackLink href="/dealer">{t("dealer.back")}</DealerBackLink>
        </div>
        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <form onSubmit={create} className="sl-panel mt-8 space-y-3 p-6">
          <input
            aria-label={t("dealer.sales.partyName")}
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder={t("dealer.sales.partyName")}
            className="sl-input"
          />
          <div className="flex gap-2">
            <input
              aria-label={t("dealer.sales.searchParts")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("dealer.sales.searchParts")}
              className="sl-input min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => void search()}
              className="sl-btn sl-btn-secondary shrink-0"
            >
              {t("dealer.sales.search")}
            </button>
          </div>
          {hits.map((h, i) => (
            <button
              key={i}
              type="button"
              disabled={!h.listing}
              onClick={() => {
                if (!h.listing) return;
                setLines((prev) => [
                  ...prev,
                  {
                    dealerListingId: h.listing!.listingId,
                    quantity: 1,
                    label: `${h.partNumber} · ${h.listing!.partName}`,
                  },
                ]);
              }}
              className="sl-btn sl-btn-secondary sl-btn-block justify-start whitespace-normal text-left"
            >
              {h.partNumber} · {h.name}
            </button>
          ))}
          {lines.map((l, i) => (
            <div key={`${l.dealerListingId}-${i}`} className="flex gap-2 text-sm">
              <span className="min-w-0 flex-1">{l.label}</span>
              <input
                type="number"
                min={1}
                aria-label={t("dealer.sales.quantityFor", { label: l.label })}
                value={l.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, quantity: Number(e.target.value) } : x,
                    ),
                  )
                }
                className="sl-input w-20 shrink-0"
              />
            </div>
          ))}
          <button
            disabled={saving || !lines.length}
            className="sl-btn sl-btn-primary"
          >
            {t("dealer.quickOrderSubmit")}
          </button>
        </form>
        <div className="mt-8 space-y-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="sl-panel flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4 text-sm"
            >
              <span>
                <b>{o.soNumber}</b> · {o.partyName} · {o.status}
              </span>
              <span className="sl-num">₹{(o.totalPaise / 100).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      </div>
    </StorefrontShell>
  );
}
