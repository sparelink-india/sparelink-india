"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type PO = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string | null;
  totalPaise: number;
  createdAt: string;
};

type Supplier = { id: string; name: string };

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCostPaise, setUnitCostPaise] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [poR, sR] = await Promise.all([
      fetch("/api/admin/purchase-orders", { cache: "no-store" }),
      fetch("/api/admin/suppliers", { cache: "no-store" }),
    ]);
    const poD = await poR.json();
    const sD = await sR.json();
    if (!poR.ok) throw new Error(poD.error);
    if (!sR.ok) throw new Error(sD.error);
    setOrders(poD.purchaseOrders);
    setSuppliers(sD.suppliers);
    if (!supplierId && sD.suppliers[0]) setSupplierId(sD.suppliers[0].id);
  };

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Load failed"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          status: "draft",
          items: [
            {
              partNumber,
              partName,
              quantity,
              unitCostPaise,
            },
          ],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPartNumber("");
      setPartName("");
      setQuantity(1);
      setUnitCostPaise(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
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
          <span className="text-sm">Purchase Orders</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <form
          onSubmit={create}
          className="mt-8 grid gap-3 rounded-lg border bg-white p-6 md:grid-cols-3"
        >
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Select supplier *</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            required
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="Part number *"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            required
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            placeholder="Part name *"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            placeholder="Qty"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={0}
            required
            value={unitCostPaise}
            onChange={(e) => setUnitCostPaise(Number(e.target.value))}
            placeholder="Unit cost (paise) *"
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            disabled={saving}
            className="rounded bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            {saving ? "Creating..." : "Create draft PO"}
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Stock does not increase on create/submit/received — goods receipt is
          separate.
        </p>
        <div className="mt-8 space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border bg-white p-4 text-sm"
            >
              <div>
                <p className="font-semibold">
                  {o.poNumber} · {o.supplierName || "—"}
                </p>
                <p className="text-xs text-zinc-500">{o.status}</p>
              </div>
              <div className="flex gap-3">
                <span>₹{(o.totalPaise / 100).toLocaleString("en-IN")}</span>
                <a
                  href={`/api/admin/purchase-orders/${o.id}/excel`}
                  className="text-blue-600 hover:underline"
                >
                  CSV
                </a>
              </div>
            </div>
          ))}
          {!orders.length && (
            <p className="text-sm text-zinc-500">No purchase orders yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
