"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { QuickOrderPanel } from "@/components/quick-order-panel";
import { ErrorState, PanelSkeleton } from "@/components/page-states";
import { useI18n } from "@/components/preferences-provider";
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
  const load = async () => {
    try {
      const r = await fetch("/api/dealer/dashboard", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load dashboard.");
    }
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, []);
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
      setError(e instanceof Error ? e.message : "Unable to save listing.");
    } finally {
      setSaving("");
    }
  };
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            SpareLink India
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm">Dealer portal</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="sl-container sl-page-main flex-1">
        <p className="sl-label">{t("nav.dealer")}</p>
        <h1 className="sl-h1 mt-1.5">{data?.businessName || t("dealer.dashboardTitle")}</h1>
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
                className="sl-v2-btn sl-v2-btn-secondary !min-h-10 !text-[0.8125rem]"
              >
                Retail order lines
              </Link>
              <Link
                href="/dealer/sales-orders"
                className="sl-v2-btn sl-v2-btn-secondary !min-h-10 !text-[0.8125rem]"
              >
                B2B sales orders
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
                    className="sl-v2-card grid gap-3 p-4 md:grid-cols-[1fr_130px_100px_120px_90px]"
                  >
                    <div>
                      <p className="sl-h3 !text-sm">{l.partName}</p>
                      <p className="sl-partno mt-0.5">{l.partNumber}</p>
                    </div>
                    <input
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={(l.pricePaise / 100).toFixed(2)}
                      className="sl-v2-input !min-h-11"
                    />
                    <input
                      name="stock"
                      type="number"
                      min="0"
                      defaultValue={l.stock ?? 0}
                      className="sl-v2-input !min-h-11"
                    />
                    <select
                      name="status"
                      defaultValue={l.status}
                      className="sl-v2-input !min-h-11"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <button
                      disabled={saving === l.id}
                      className="rounded bg-zinc-950 px-3 py-2 text-sm text-white"
                    >
                      Save
                    </button>
                  </form>
                ))}
              </div>
            </section>
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Recent order items</h2>
              <div className="mt-4 space-y-2">
                {data.recentOrders.map((o, i) => (
                  <div
                    key={`${o.orderNumber}-${i}`}
                    className="flex justify-between rounded-xl border bg-white p-4 text-sm"
                  >
                    <span>
                      <b>#{o.orderNumber}</b> · {o.partName} × {o.quantity}
                    </span>
                    <span>
                      ₹{(o.totalPaise / 100).toLocaleString("en-IN")} ·{" "}
                      {o.orderStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
                {!data.recentOrders.length && (
                  <p className="text-sm text-zinc-500">No order items yet.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
