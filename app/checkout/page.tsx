"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CartData = {
  items: {
    id: string;
    quantity: number;
    pricePaise: number;
    partName: string | null;
  }[];
  totalPaise: number;
};

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load secure payment checkout."));
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);

  useEffect(() => {
    async function loadCart() {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load cart.");
        setCart(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load cart.",
        );
      } finally {
        setLoading(false);
      }
    }
    void loadCart();
    void fetch("/api/payments/razorpay/config")
      .then((response) => response.json())
      .then((data) => setOnlinePaymentEnabled(Boolean(data.enabled)))
      .catch(() => setOnlinePaymentEnabled(false));
  }, []);

  async function openRazorpayPayment(orderId: string) {
    const response = await fetch("/api/payments/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const paymentData = await response.json();
    if (!response.ok)
      throw new Error(paymentData.error || "Unable to start payment.");
    await loadRazorpayCheckout();
    if (!window.Razorpay)
      throw new Error("Unable to open secure payment checkout.");

    new window.Razorpay({
      key: paymentData.keyId,
      amount: paymentData.amountPaise,
      currency: paymentData.currency,
      name: "SpareLink India",
      description: `Order ${paymentData.orderNumber}`,
      order_id: paymentData.providerOrderId,
      prefill: {
        name: paymentData.buyerName,
        email: paymentData.buyerEmail,
        contact: paymentData.buyerPhone,
      },
      handler: async (paymentResponse) => {
        try {
          const verification = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paymentResponse),
          });
          const result = await verification.json();
          if (!verification.ok)
            throw new Error(result.error || "Payment verification failed.");
          router.push(
            `/order-confirmation/${result.orderId}?number=${encodeURIComponent(result.orderNumber)}`,
          );
        } catch (verificationError) {
          setError(
            verificationError instanceof Error
              ? verificationError.message
              : "Payment verification failed. Please contact support.",
          );
          setSubmitting(false);
        }
      },
      modal: { ondismiss: () => setSubmitting(false) },
    }).open();
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const shippingAddress = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress, paymentMethod }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to place order.");
      if (paymentMethod === "razorpay") {
        await openRazorpayPayment(data.id);
      } else {
        router.push(
          `/order-confirmation/${data.id}?number=${encodeURIComponent(data.orderNumber)}`,
        );
      }
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to place order.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            SpareLink India
          </Link>
          <Link
            href="/cart"
            className="text-sm font-medium hover:text-zinc-600"
          >
            Back to cart
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        {loading && (
          <p className="mt-8 text-sm text-zinc-500">Loading checkout...</p>
        )}
        {!loading && error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && (!cart || !cart.items.length) && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
            <p className="font-medium">Your cart is empty.</p>
            <Link
              href="/"
              className="mt-5 inline-block text-sm font-medium underline"
            >
              Find parts
            </Link>
          </div>
        )}
        {!loading && cart && cart.items.length > 0 && (
          <form
            onSubmit={placeOrder}
            className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]"
          >
            <section className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-lg font-semibold">Delivery address</h2>
              <p className="mt-1 text-sm text-zinc-500">
                We’ll use this address for dispatch and order updates.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  ["name", "Full name"],
                  ["phone", "10-digit mobile number"],
                  ["addressLine1", "Address line 1"],
                  ["addressLine2", "Address line 2 (optional)"],
                  ["city", "City"],
                  ["state", "State"],
                  ["pincode", "6-digit pincode"],
                ].map(([name, label]) => (
                  <label
                    key={name}
                    className={
                      name === "addressLine1" || name === "addressLine2"
                        ? "sm:col-span-2"
                        : ""
                    }
                  >
                    <span className="mb-1 block text-sm font-medium">
                      {label}
                    </span>
                    <input
                      name={name}
                      required={name !== "addressLine2"}
                      inputMode={
                        name === "phone" || name === "pincode"
                          ? "numeric"
                          : undefined
                      }
                      pattern={
                        name === "phone"
                          ? "(?:\\+91)?[6-9][0-9]{9}"
                          : name === "pincode"
                            ? "[0-9]{6}"
                            : undefined
                      }
                      className="h-11 w-full rounded-lg border border-zinc-300 px-3 outline-none focus:border-zinc-950"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                <label className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-4 text-sm">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash_on_delivery"
                    checked={paymentMethod === "cash_on_delivery"}
                    onChange={() => setPaymentMethod("cash_on_delivery")}
                  />
                  <span>
                    <span className="block font-medium text-zinc-900">
                      Cash on delivery
                    </span>
                    <span className="mt-1 block text-zinc-600">
                      Pay when your order is delivered.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex gap-3 rounded-xl border p-4 text-sm ${onlinePaymentEnabled ? "cursor-pointer border-zinc-200" : "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"}`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="razorpay"
                    checked={paymentMethod === "razorpay"}
                    disabled={!onlinePaymentEnabled}
                    onChange={() => setPaymentMethod("razorpay")}
                  />
                  <span>
                    <span className="block font-medium text-zinc-900">
                      Pay online
                    </span>
                    <span className="mt-1 block text-zinc-600">
                      Secure UPI, card and net-banking payment via Razorpay
                      {onlinePaymentEnabled ? "." : " — coming soon."}
                    </span>
                  </span>
                </label>
              </div>
            </section>
            <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <div className="mt-5 space-y-3">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <span>
                      {item.partName || "Automotive spare part"} ×{" "}
                      {item.quantity}
                    </span>
                    <span className="font-medium">
                      ₹
                      {((item.pricePaise * item.quantity) / 100).toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-between border-t border-zinc-100 pt-5">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">
                  ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
              <button
                disabled={submitting}
                className="mt-6 w-full rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {submitting
                  ? paymentMethod === "razorpay"
                    ? "Opening payment..."
                    : "Placing order..."
                  : paymentMethod === "razorpay"
                    ? "Pay securely"
                    : "Place COD order"}
              </button>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
