"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Listing = {
  id: string;
  partName: string;
  partNumber: string;
  dealerName: string;
  firmName: string | null;
  firmId: string | null;
  sku: string | null;
  price: number;
  status: string;
  createdAt: string;
};

type Firm = {
  id: string;
  name: string;
};

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [listingsRes, firmsRes] = await Promise.all([
          fetch("/api/admin/listings", { cache: "no-store" }),
          fetch("/api/admin/firms/list", { cache: "no-store" }),
        ]);

        const listingsData = await listingsRes.json();
        const firmsData = await firmsRes.json();

        if (!listingsRes.ok) throw new Error(listingsData.error);
        if (!firmsRes.ok) throw new Error(firmsData.error);

        setListings(listingsData.listings);
        setFirms(firmsData.firms);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load data.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateFirm = async (listingId: string, firmId: string | null) => {
    setUpdating(listingId);
    try {
      const r = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, firmId }),
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      // Update local state
      setListings((prev) =>
        prev.map((l) =>
          l.id === listingId
            ? {
                ...l,
                firmId,
                firmName: firms.find((f) => f.id === firmId)?.name || null,
              }
            : l,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update listing.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Manage Listings</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dealer Listings</h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          Assign listings to firms for order fulfillment
        </p>

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading listings...</p>
        )}

        {!loading && listings.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Part Number</th>
                  <th className="px-4 py-3 font-semibold">Part Name</th>
                  <th className="px-4 py-3 font-semibold">Dealer</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Firm</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      {l.partNumber}
                    </td>
                    <td className="px-4 py-3 font-medium">{l.partName}</td>
                    <td className="px-4 py-3 text-xs">{l.dealerName}</td>
                    <td className="px-4 py-3">
                      ₹{(l.price / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={l.firmId || ""}
                        onChange={(e) =>
                          void updateFirm(
                            l.id,
                            e.target.value || null,
                          )
                        }
                        disabled={updating === l.id}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        <option value="">No Firm</option>
                        {firms.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {updating === l.id && (
                        <span className="text-xs text-zinc-500">Updating...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && listings.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No listings found.</p>
        )}
      </div>
    </main>
  );
}
