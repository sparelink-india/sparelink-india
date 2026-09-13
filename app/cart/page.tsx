"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CartItem = {
  id: string;
  dealerListingId: string;
  quantity: number;
  pricePaise: number;
  partId: string;
  partNumber: string | null;
  partName: string | null;
};

type CartData = {
  id: string | null;
  items: CartItem[];
  totalPaise: number;
};

export default function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCart() {
      try {
        const response = await fetch("/api/cart", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load cart.");
        }

        setCart(data);
      } catch (cartError) {
        console.error(cartError);
        setError(
          cartError instanceof Error
            ? cartError.message
            : "Unable to load cart.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCart();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            SpareLink India
          </Link>

          <Link
            href="/"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            Continue Shopping
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Your Cart</h1>

        {loading && (
          <p className="mt-8 text-sm text-zinc-500">Loading cart...</p>
        )}

        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && cart && cart.items.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <h2 className="font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Find spare parts and add them to your cart.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Find Parts
            </Link>
          </div>
        )}

        {!loading && !error && cart && cart.items.length > 0 && (
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
            <section className="space-y-4">
              {cart.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-6"
                >
                  <h2 className="text-lg font-semibold">
                    {item.partName || "Automotive Spare Part"}
                  </h2>

                  {item.partNumber && (
                    <p className="mt-1 text-sm text-zinc-500">
                      Part No: {item.partNumber}
                    </p>
                  )}

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">
                        Quantity:{" "}
                        <span className="font-medium text-zinc-900">
                          {item.quantity}
                        </span>
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        ₹{(item.pricePaise / 100).toLocaleString("en-IN")} each
                      </p>
                    </div>

                    <p className="text-lg font-bold">
                      ₹
                      {((item.pricePaise * item.quantity) / 100).toLocaleString(
                        "en-IN",
                      )}
                    </p>
                  </div>
                </article>
              ))}
            </section>

            <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-6">
              <h2 className="text-lg font-semibold">Order Summary</h2>

              <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5">
                <span className="text-sm text-zinc-500">Total</span>
                <span className="text-2xl font-bold">
                  ₹{(cart.totalPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>

              <Link
                href="/checkout"
                className="mt-6 block w-full rounded-xl bg-zinc-950 px-5 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
              >
                Proceed to checkout
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
