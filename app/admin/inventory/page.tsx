"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type InventoryItem = {
  id: string;
  partName: string;
  dealerName: string;
  quantity: number;
  price: number;
  lastUpdated: string;
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/inventory", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setInventory(d.inventory);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load inventory.");
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
          <span className="text-sm">Inventory</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Inventory</h1>
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
          <p className="mt-6 text-sm text-zinc-500">Loading inventory...</p>
        )}

        {!loading && inventory.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Part Name</th>
                  <th className="px-4 py-3 font-semibold">Dealer</th>
                  <th className="px-4 py-3 font-semibold">Quantity</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{item.partName}</td>
                    <td className="px-4 py-3 text-xs">{item.dealerName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs ${
                          item.quantity > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      ₹{(item.price / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {new Date(item.lastUpdated).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && inventory.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No inventory found.</p>
        )}
      </div>
    </main>
  );
}
