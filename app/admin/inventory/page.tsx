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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    void load();
  }, []);

  const save = async (inventoryId: string) => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          quantity: qty,
          reason,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEditingId(null);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjust failed");
    } finally {
      setSaving(false);
    }
  };

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
                  <th className="px-4 py-3 font-semibold">Adjust</th>
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
                    <td className="px-4 py-3">
                      {editingId === item.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) => setQty(Number(e.target.value))}
                            className="w-24 rounded border px-2 py-1"
                          />
                          <input
                            required
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason *"
                            className="w-48 rounded border px-2 py-1"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={saving || !reason.trim()}
                              onClick={() => void save(item.id)}
                              className="rounded bg-zinc-950 px-2 py-1 text-xs text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-zinc-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setQty(item.quantity);
                            setReason("");
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Adjust
                        </button>
                      )}
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
