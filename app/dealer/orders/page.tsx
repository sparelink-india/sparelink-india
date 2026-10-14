"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/preferences-provider";
import { DealerBackLink } from "@/components/dealer-back-link";
import { Notice } from "@/components/page-states";
import { StorefrontShell } from "@/components/storefront-shell";

type OrderLine = {
  orderItemId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  partNumber: string;
  partName: string;
  quantity: number;
  totalPaise: number;
  createdAt: string;
};

export default function DealerOrdersPage() {
  /* These labels were hardcoded English, so the dealer order views were
     untranslated. The view is unchanged; only the copy is looked up now. */
  const { t } = useI18n();

  const [orders, setOrders] = useState<OrderLine[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/dealer/orders", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setOrders(d.orders);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("orders.loadFail"));
      }
    };
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [t]);

  return (
    <StorefrontShell>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sl-rule)] pb-4">
        <span className="sl-eyebrow">{t("dealer.ordersTitle")}</span>
      </div>
      <div className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="sl-h2">{t("dealer.orderLines")}</h1>
          <DealerBackLink href="/dealer">{t("dealer.back")}</DealerBackLink>
        </div>
        {error && (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="mt-8 space-y-2">
          {orders.map((o) => (
            <div
              key={o.orderItemId}
              className="sl-panel flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4 text-sm"
            >
              <span>
                <b>#{o.orderNumber}</b> · {o.partNumber} · {o.partName} ×{" "}
                {o.quantity}
              </span>
              <span className="sl-num">
                ₹{(o.totalPaise / 100).toLocaleString("en-IN")} ·{" "}
                {o.orderStatus}
              </span>
            </div>
          ))}
          {!orders.length && !error && (
            <p className="sl-small text-[var(--sl-ink-3)]">{t("dealer.noOrderLines")}</p>
          )}
        </div>
      </div>
    </StorefrontShell>
  );
}
