"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { StorefrontShell } from "@/components/storefront-shell";
import { QuickOrderPanel } from "@/components/quick-order-panel";
import { ErrorState, PanelSkeleton } from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
import { T } from "@/components/t";
type Listing = {
  id: string;
  partName: string;
  partNumber: string;
  sku: string | null;
  pricePaise: number;
  status: string;
  stock: number | null;
};
type Dashboard = {
  businessName: string;
  listings: Listing[];
  recentOrders: {
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    partName: string;
    quantity: number;
    totalPaise: number;
    createdAt: string;
  }[];
};
export default function DealerPage() {
  const { t } = useI18n();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  // Memoized on `t` only, so the identity is stable across re-renders (t is
  // itself a useCallback) and the mount effect below never re-fires in a loop.
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dealer/dashboard", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dealer.loadFail"));
    }
  }, [t]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  const save = async (listing: Listing, form: HTMLFormElement) => {
    setSaving(listing.id);
    const f = new FormData(form);
    try {
      const r = await fetch("/api/dealer/dashboard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: listing.id,
          pricePaise: Math.round(Number(f.get("price")) * 100),
          stock: Number(f.get("stock")),
          status: f.get("status"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dealer.saveFail"));
    } finally {
      setSaving("");
    }
  };
  return (
    <StorefrontShell>
      {/* The shell owns the header, the <main> landmark, the footer and
          the mobile nav, so the page has exactly one header landmark. The portal
          label and sign-out live here instead of in a second one — dropping
          them would take away the only way a signed-in dealer can leave. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sl-rule)] pb-4">
        <span className="sl-eyebrow">{t("dealer.portal")}</span>
        <SignOutButton />
      </div>
      <div className="pt-6">
        <p className="sl-eyebrow">{t("nav.dealer")}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--sl-rule)] pb-4">
          <h1 className="sl-display">
            {data?.businessName || t("dealer.dashboardTitle")}
          </h1>
          <span className="sl-badge sl-badge-copper ml-auto shrink-0">
            {t("nav.dealer")}
          </span>
        </div>
        {error && (
          <div className="mt-5">
            <ErrorState title={t("common.error")} body={error} onRetry={() => window.location.reload()} />
          </div>
        )}
        {!data && !error && (
          <div className="mt-6">
            <PanelSkeleton rows={5} />
          </div>
        )}
        {data && (
          <>
            <nav className="mt-5 flex flex-wrap gap-2" aria-label={t("nav.dealer")}>
              <Link
                href="/dealer/orders"
                className="sl-btn sl-btn-secondary"
              >
                {t("dealer.orderLines")}
              </Link>
              <Link
                href="/dealer/sales-orders"
                className="sl-btn sl-btn-secondary"
              >
                {t("dealer.b2bSalesTitle")}
              </Link>
            </nav>

            {/*
              Bulk / quick order by part number.

              This is the SAME component that previously sat on the public
              homepage — it is reused here unchanged, not duplicated. The
              component itself is not dealer-aware, so the authorisation
              boundary is the dealer layout above (session + role === "dealer"),
              not this file. Its data flow is untouched: it still calls the
              public /api/search/parts for part-number resolution and
              POST /api/cart to add lines.
            */}
            <section className="mt-8">
              <h2 className="sl-h2">{t("dealer.bulkTitle")}</h2>
              <p className="sl-body mt-1.5 max-w-prose">{t("dealer.bulkBody")}</p>
              <div className="mt-4">
                <QuickOrderPanel />
              </div>
            </section>
            <section className="mt-8">
              <h2 className="sl-h2">{t("dealer.listingsTitle")}</h2>
              <div className="mt-4 space-y-3">
                {data.listings.map((l) => (
                  <form
                    key={l.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(l, e.currentTarget);
                    }}
                    className="sl-panel grid gap-3 p-4 md:grid-cols-[1fr_130px_100px_120px_90px]"
                  >
                    <div>
                      <p className="sl-h4 text-sm">{l.partName}</p>
                      <p className="sl-partno mt-0.5">{l.partNumber}</p>
                    </div>
                    {/* These three controls had no accessible name at all: the
                        grid is a table-like row, so the column heading is not
                        programmatically associated with the control. Each gets
                        a real <label>, visually hidden so the grid keeps its
                        compact four-column shape. The dealer save handler reads
                        them by `name`, which is unchanged. */}
                    <label className="sr-only" htmlFor={`dl-price-${l.id}`}>
                      {t("dealer.price")}
                    </label>
                    <input
                      id={`dl-price-${l.id}`}
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={(l.pricePaise / 100).toFixed(2)}
                      className="sl-input"
                    />
                    <label className="sr-only" htmlFor={`dl-stock-${l.id}`}>
                      {t("dealer.stock")}
                    </label>
                    <input
                      id={`dl-stock-${l.id}`}
                      name="stock"
                      type="number"
                      min="0"
                      defaultValue={l.stock ?? 0}
                      className="sl-input"
                    />
                    <label className="sr-only" htmlFor={`dl-status-${l.id}`}>
                      {t("dealer.status")}
                    </label>
                    <select
                      id={`dl-status-${l.id}`}
                      name="status"
                      defaultValue={l.status}
                      className="sl-select"
                    >
                      <option value="active">
                        <T k="dealer.statusActive" />
                      </option>
                      <option value="inactive">
                        <T k="dealer.statusInactive" />
                      </option>
                    </select>
                    <button
                      disabled={saving === l.id}
                      className="sl-btn sl-btn-dark"
                    >
                      <T k="dealer.save" />
                    </button>
                  </form>
                ))}
              </div>
            </section>
            <section className="mt-10">
              <h2 className="sl-h2">{t("dealer.recentOrderItems")}</h2>
              <div className="mt-4 space-y-2">
                {data.recentOrders.map((o, i) => (
                  <div
                    key={`${o.orderNumber}-${i}`}
                    className="sl-panel flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4 text-sm"
                  >
                    <span>
                      <b>#{o.orderNumber}</b> · {o.partName} × {o.quantity}
                    </span>
                    <span className="sl-num">
                      ₹{(o.totalPaise / 100).toLocaleString("en-IN")} ·{" "}
                      {o.orderStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
                {!data.recentOrders.length && (
                  <p className="sl-small text-[var(--sl-ink-3)]">{t("dealer.noOrderItems")}</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </StorefrontShell>
  );
}
