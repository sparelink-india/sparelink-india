"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Dealer = {
  id: string;
  businessName: string;
  gstin: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  listingCount: number;
  createdAt: string;
};

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/dealers", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDealers(d.dealers);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load dealers.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Manage Dealers</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dealers</h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading dealers...</p>
        )}

        {!loading && dealers.length > 0 && (
          <div className="mt-8 space-y-4">
            {dealers.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border bg-white p-6 hover:border-blue-300"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">{d.businessName}</h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      {d.city}, {d.state}
                    </p>
                    {d.email && (
                      <p className="mt-1 text-xs text-zinc-600">{d.email}</p>
                    )}
                    {d.gstin && (
                      <p className="mt-1 text-xs text-zinc-600">
                        GSTIN: {d.gstin}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {d.listingCount}
                    </p>
                    <p className="text-xs text-zinc-600">Active Listings</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Joined{" "}
                      {new Date(d.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && dealers.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No dealers found.</p>
        )}
      </div>
    </main>
  );
}
