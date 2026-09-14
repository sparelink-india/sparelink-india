"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">
          {data?.businessName || "Dealer dashboard"}
        </h1>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {!data && !error && (
          <p className="mt-6 text-sm text-zinc-500">Loading dashboard...</p>
        )}
        {data && (
          <>
            <section className="mt-8">
              <h2 className="text-xl font-semibold">Your listings</h2>
              <div className="mt-4 space-y-3">
                {data.listings.map((l) => (
                  <form
                    key={l.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(l, e.currentTarget);
                    }}
                    className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1fr_130px_100px_120px_90px]"
                  >
                    <div>
                      <b>{l.partName}</b>
                      <p className="text-xs text-zinc-500">{l.partNumber}</p>
                    </div>
                    <input
                      name="price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={(l.pricePaise / 100).toFixed(2)}
                      className="rounded border px-2"
                    />
                    <input
                      name="stock"
                      type="number"
                      min="0"
                      defaultValue={l.stock ?? 0}
                      className="rounded border px-2"
                    />
                    <select
                      name="status"
                      defaultValue={l.status}
                      className="rounded border px-2"
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
