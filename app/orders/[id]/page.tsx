"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPaise: number;
  subtotalPaise: number;
  shippingPaise: number;
  createdAt: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  items: {
    id: string;
    partNumber: string;
    partName: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }[];
};

type FirmPayment = {
  firmOrderId: string;
  firmName: string;
  firmCode?: string | null;
  allocationNumber: string;
  amountPaise: number;
  fulfillmentStatus: string;
  paymentStatus: string;
};

function statusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [firmPayments, setFirmPayments] = useState<FirmPayment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [returnMsg, setReturnMsg] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${id}/payment`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load order.");
        setOrder(data.order);
        setFirmPayments(data.firmPayments || []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load order.",
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function submitReturnRequest() {
    if (!order || submittingReturn) return;
    setSubmittingReturn(true);
    setReturnMsg("");
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          requestType: "return",
          reason: "other",
          description: "Customer return request from order detail",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit return.");
      setReturnMsg(`Return request submitted (${data.requestNumber}).`);
    } catch (err) {
      setReturnMsg(
        err instanceof Error ? err.message : "Unable to submit return.",
      );
    } finally {
      setSubmittingReturn(false);
    }
  }

  const gstPaise = order
    ? Math.max(
        0,
        order.totalPaise - order.subtotalPaise - (order.shippingPaise ?? 0),
      )
    : 0;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/orders" className="text-sm font-semibold text-zinc-600">
            ← My Orders
          </Link>
          <Link href="/" className="text-xl font-bold">
            SpareLink India
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        {loading && (
          <p className="text-sm text-zinc-500">Loading order details…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {order && (
          <article className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Order detail
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                #{order.orderNumber}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Placed{" "}
                {new Date(order.createdAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium">
                  {statusLabel(order.status)}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium">
                  {order.paymentMethod === "cash_on_delivery"
                    ? "Cash on delivery"
                    : statusLabel(order.paymentMethod)}{" "}
                  · {statusLabel(order.paymentStatus)}
                </span>
              </div>
            </div>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-bold">Delivery address</h2>
              <p className="mt-2 text-sm text-zinc-700">
                {order.shippingName}
                <br />
                {order.shippingPhone}
                <br />
                {order.shippingAddressLine1}
                {order.shippingAddressLine2 ? (
                  <>
                    <br />
                    {order.shippingAddressLine2}
                  </>
                ) : null}
                <br />
                {order.shippingCity}, {order.shippingState}{" "}
                {order.shippingPincode}
              </p>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-bold">Items</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-4 border-b border-zinc-100 pb-2"
                  >
                    <span>
                      {item.partName}{" "}
                      <span className="font-mono text-zinc-400">
                        #{item.partNumber}
                      </span>{" "}
                      × {item.quantity}
                    </span>
                    <span className="font-medium">
                      ₹{(item.totalPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-1 text-xs text-zinc-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    ₹{(order.subtotalPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                {gstPaise > 0 && (
                  <div className="flex justify-between">
                    <span>GST (included)</span>
                    <span>₹{(gstPaise / 100).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>
                    ₹{((order.shippingPaise ?? 0) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-950">
                  <span>Total</span>
                  <span>
                    ₹{(order.totalPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </section>

            {firmPayments.length > 0 && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-bold">Fulfillment</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Your SpareLink order may be fulfilled by one or more of our
                  firms.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {firmPayments.map((firm) => (
                    <li
                      key={firm.firmOrderId}
                      className="flex justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2"
                    >
                      <span>
                        {firm.firmName}
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {statusLabel(firm.fulfillmentStatus)} ·{" "}
                          {statusLabel(firm.paymentStatus)}
                        </span>
                      </span>
                      <span className="font-medium">
                        ₹{(firm.amountPaise / 100).toLocaleString("en-IN")}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/orders/${order.id}/invoice`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold"
              >
                Download PDF
              </a>
              <a
                href={`/api/orders/${order.id}/excel`}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
              >
                Download Excel
              </a>
              {order.paymentMethod !== "cash_on_delivery" && (
                <Link
                  href={`/orders/${order.id}/payment`}
                  className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white"
                >
                  Payment
                </Link>
              )}
              <button
                type="button"
                disabled={submittingReturn}
                onClick={() => void submitReturnRequest()}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50"
              >
                {submittingReturn ? "Submitting…" : "Request return"}
              </button>
            </div>
            {returnMsg && (
              <p className="text-sm text-zinc-600">{returnMsg}</p>
            )}
          </article>
        )}
      </div>
    </main>
  );
}
