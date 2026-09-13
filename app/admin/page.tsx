"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type AdminStats = {
  totalFirms: number;
  totalDealers: number;
  totalParts: number;
  totalOrders: number;
  totalRevenue: number;
  activeListings: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/stats", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setStats(d);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load stats.");
      }
    };

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Admin Dashboard</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!stats && !error && (
          <p className="mt-6 text-sm text-zinc-500">Loading dashboard...</p>
        )}

        {stats && (
          <>
            <div className="mt-10 grid gap-6 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border bg-white p-6">
                <p className="text-xs text-zinc-600">Firms</p>
                <p className="mt-2 text-2xl font-bold">{stats.totalFirms}</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-xs text-zinc-600">Dealers</p>
                <p className="mt-2 text-2xl font-bold">{stats.totalDealers}</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-xs text-zinc-600">Parts</p>
                <p className="mt-2 text-2xl font-bold">{stats.totalParts}</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-xs text-zinc-600">Active Listings</p>
                <p className="mt-2 text-2xl font-bold">{stats.activeListings}</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-xs text-zinc-600">Orders</p>
                <p className="mt-2 text-2xl font-bold">{stats.totalOrders}</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-xs text-zinc-600">Revenue</p>
                <p className="mt-2 text-2xl font-bold">
                  ₹{(stats.totalRevenue / 100).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Management</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/admin/firms"
                  className="rounded-lg border border-blue-200 bg-blue-50 p-6 hover:bg-blue-100"
                >
                  <p className="text-sm font-semibold text-blue-900">
                    Manage Firms
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    View and edit selling firms
                  </p>
                </Link>

                <Link
                  href="/admin/dealers"
                  className="rounded-lg border border-green-200 bg-green-50 p-6 hover:bg-green-100"
                >
                  <p className="text-sm font-semibold text-green-900">
                    Manage Dealers
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    View and manage dealer accounts
                  </p>
                </Link>

                <Link
                  href="/admin/products"
                  className="rounded-lg border border-purple-200 bg-purple-50 p-6 hover:bg-purple-100"
                >
                  <p className="text-sm font-semibold text-purple-900">
                    Manage Products
                  </p>
                  <p className="mt-1 text-xs text-purple-700">
                    View and edit parts catalog
                  </p>
                </Link>

                <Link
                  href="/admin/listings"
                  className="rounded-lg border border-orange-200 bg-orange-50 p-6 hover:bg-orange-100"
                >
                  <p className="text-sm font-semibold text-orange-900">
                    Manage Listings
                  </p>
                  <p className="mt-1 text-xs text-orange-700">
                    Edit dealer listings and prices
                  </p>
                </Link>

                <Link
                  href="/admin/inventory"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 p-6 hover:bg-indigo-100"
                >
                  <p className="text-sm font-semibold text-indigo-900">
                    Inventory
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    Monitor stock levels
                  </p>
                </Link>

                <Link
                  href="/admin/orders"
                  className="rounded-lg border border-red-200 bg-red-50 p-6 hover:bg-red-100"
                >
                  <p className="text-sm font-semibold text-red-900">
                    Orders
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    View all orders and allocations
                  </p>
                </Link>

                <Link
                  href="/admin/allocations"
                  className="rounded-lg border border-cyan-200 bg-cyan-50 p-6 hover:bg-cyan-100"
                >
                  <p className="text-sm font-semibold text-cyan-900">
                    Allocations
                  </p>
                  <p className="mt-1 text-xs text-cyan-700">
                    Firm-wise order allocations
                  </p>
                </Link>

                <Link
                  href="/admin/users"
                  className="rounded-lg border border-teal-200 bg-teal-50 p-6 hover:bg-teal-100"
                >
                  <p className="text-sm font-semibold text-teal-900">
                    Users
                  </p>
                  <p className="mt-1 text-xs text-teal-700">
                    Manage system users
                  </p>
                </Link>
              </div>
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Data Management</h2>
              <div className="mt-6 grid gap-4">
                <Link
                  href="/admin/import"
                  className="rounded-lg border border-slate-300 bg-slate-50 p-6 hover:bg-slate-100"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    Bulk Import
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Import products and dealer listings via CSV/Excel
                  </p>
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
