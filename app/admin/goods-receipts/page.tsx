"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type PO = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string | null;
};

type PendingItem = {
  id: string;
  partNumber: string;
  partName: string;
  quantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  dealerListingId: string | null;
};

type Receipt = {
  id: string;
  receiptNumber: string;
  poNumber: string;
  supplierName: string | null;
  warehouseCode: string;
  status: string;
  createdAt: string;
};

export default function GoodsReceiptsPage() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [poId, setPoId] = useState("");
  const [items, setItems] = useState<PendingItem[]>([]);
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [poR, grR] = await Promise.all([
      fetch("/api/admin/purchase-orders", { cache: "no-store" }),
      fetch("/api/admin/goods-receipts", { cache: "no-store" }),
    ]);
    const poD = await poR.json();
    const grD = await grR.json();
    if (!poR.ok) throw new Error(poD.error);
    if (!grR.ok) throw new Error(grD.error);
    setOrders(poD.purchaseOrders);
    setReceipts(grD.receipts);
    if (!poId && poD.purchaseOrders[0]) setPoId(poD.purchaseOrders[0].id);
  };

  const loadPending = async (purchaseOrderId: string) => {
    const r = await fetch("/api/admin/goods-receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseOrderId, preview: true }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setItems(d.items);
    const next: Record<string, number> = {};
    for (const item of d.items as PendingItem[]) {
      next[item.id] = item.pendingQuantity;
    }
    setQtyByItem(next);
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load().catch((e) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!poId) return;
    const t = window.setTimeout(() => {
      void loadPending(poId).catch((e) =>
        setError(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, [poId]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const lines = items
        .map((item) => ({
          purchaseOrderItemId: item.id,
          quantityReceived: Number(qtyByItem[item.id] || 0),
        }))
        .filter((l) => l.quantityReceived > 0);

      const r = await fetch("/api/admin/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderId: poId,
          lines,
          idempotencyKey: `grn-${poId}-${lines.map((l) => `${l.purchaseOrderItemId}:${l.quantityReceived}`).join("|")}-${Date.now()}`,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
      await loadPending(poId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receipt failed");
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
          <span className="text-sm">Goods Receipts</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Goods Receipts</h1>
          <div className="flex gap-4">
            <a
              href="/api/admin/goods-receipts?format=csv"
              className="text-sm text-blue-600 hover:underline"
            >
              Export CSV
            </a>
            <Link href="/admin" className="text-sm text-blue-600 hover:underline">
              Back to Admin
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Creating a PO never increases stock. Confirm receipt here. Over-receipt
          is blocked. Lines without a dealer listing record receipt but cannot
          update inventory.
        </p>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form
          onSubmit={confirm}
          className="mt-8 space-y-4 rounded-lg border bg-white p-6"
        >
          <select
            value={poId}
            onChange={(e) => setPoId(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.poNumber} · {o.status} · {o.supplierName || "—"}
              </option>
            ))}
          </select>

          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 rounded border p-3 text-sm md:grid-cols-4"
            >
              <div className="md:col-span-2">
                <p className="font-semibold">
                  {item.partNumber} · {item.partName}
                </p>
                <p className="text-xs text-zinc-500">
                  ordered {item.quantity} · received {item.receivedQuantity} ·
                  pending {item.pendingQuantity}
                  {!item.dealerListingId ? " · no listing (no stock update)" : ""}
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={item.pendingQuantity}
                value={qtyByItem[item.id] ?? 0}
                onChange={(e) =>
                  setQtyByItem((prev) => ({
                    ...prev,
                    [item.id]: Number(e.target.value),
                  }))
                }
                className="rounded border px-3 py-2"
              />
            </div>
          ))}

          <button
            disabled={saving || !poId}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Confirm goods receipt
          </button>
        </form>

        <h2 className="mt-10 text-xl font-semibold">Recent receipts</h2>
        <div className="mt-3 space-y-2">
          {receipts.map((r) => (
            <div key={r.id} className="rounded border bg-white p-3 text-sm">
              <p className="font-semibold">
                {r.receiptNumber} · {r.poNumber}
              </p>
              <p className="text-xs text-zinc-500">
                {r.supplierName || "—"} · {r.warehouseCode} · {r.status} ·{" "}
                {new Date(r.createdAt).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
          {!receipts.length && (
            <p className="text-sm text-zinc-500">No goods receipts yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
