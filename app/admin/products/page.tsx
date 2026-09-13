"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  partNumber: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  listingCount: number;
  createdAt: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/products", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setProducts(d.products);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load products.");
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
          <span className="text-sm">Manage Products</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Products</h1>
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
          <p className="mt-6 text-sm text-zinc-500">Loading products...</p>
        )}

        {!loading && products.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Part Number</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Brand</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Listings</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.partNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-zinc-600">
                          {p.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{p.brand || "-"}</td>
                    <td className="px-4 py-3">{p.category || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {p.listingCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && products.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No products found.</p>
        )}
      </div>
    </main>
  );
}
