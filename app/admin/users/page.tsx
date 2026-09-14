"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type UserItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber: string | null;
  phoneNumberVerified?: boolean;
  emailVerified: boolean;
  businessName?: string | null;
  gstin?: string | null;
  customerType?: string | null;
  shippingAddressLine1?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
  shippingPreference?: string | null;
  transportName?: string | null;
  transportPhone?: string | null;
  transportGstin?: string | null;
  orderCount?: number;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setError("");
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUsers(d.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleToggleStatus = async (userItem: UserItem) => {
    const isSuspended = userItem.role === "suspended";
    const action = isSuspended ? "activate" : "suspend";
    const confirmMessage = isSuspended
      ? `Reactivate account for ${userItem.name || userItem.email}?`
      : `Are you sure you want to suspend ${userItem.name || userItem.email}? They will no longer be able to place orders. Historical orders will remain safe.`;

    if (!window.confirm(confirmMessage)) return;

    setProcessingId(userItem.id);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userItem.id, action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      setSuccessMsg(data.message || "Customer status updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) ||
      u.businessName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phoneNumber?.toLowerCase().includes(q) ||
      u.gstin?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.shippingCity?.toLowerCase().includes(q) ||
      u.transportName?.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm font-semibold text-zinc-600">
            Customer & Account Management
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Customer Accounts
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage buyer verification, account status, and order history
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            ← Back to Admin
          </Link>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {successMsg}
          </div>
        )}

        {/* Filter bar */}
        <div className="mt-6 flex max-w-md items-center gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, email..."
            className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none focus:border-zinc-950"
          />
        </div>

        {loading && (
          <p className="mt-6 text-sm text-zinc-500">Loading customers...</p>
        )}

        {!loading && filteredUsers.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer / Contact</th>
                  <th className="px-4 py-3 font-semibold">Firm / GSTIN</th>
                  <th className="px-4 py-3 font-semibold">Phone & Location</th>
                  <th className="px-4 py-3 font-semibold">Fulfillment & Transport</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-center">Orders</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredUsers.map((u) => {
                  const isSuspended = u.role === "suspended";
                  const isProcessing = processingId === u.id;
                  const isB2B = Boolean(u.gstin) || u.customerType === "b2b";

                  return (
                    <tr key={u.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-zinc-900">{u.name || "Customer"}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                        <p className="font-mono text-[10px] text-zinc-400">ID: {u.id.slice(0, 8)}...</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-zinc-900">{u.businessName || "—"}</p>
                        {u.gstin ? (
                          <span className="font-mono text-xs font-semibold text-emerald-700">
                            GSTIN: {u.gstin}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">B2C (Retail)</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-medium text-zinc-800">{u.phoneNumber || "—"}</p>
                        <p className="text-xs text-zinc-500">
                          {u.shippingCity ? `${u.shippingCity}, ${u.shippingState || ""}` : "No address set"}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <p className="font-medium text-zinc-800 capitalize">
                          {u.shippingPreference ? u.shippingPreference.replace(/_/g, " ") : "Courier"}
                        </p>
                        {u.transportName && (
                          <p className="text-[11px] text-zinc-500">
                            Transporter: <span className="font-semibold">{u.transportName}</span>
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        ) : u.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                            {isB2B ? "B2B Active" : "B2C Active"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center font-bold text-zinc-900">
                        {u.orderCount ?? 0}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {u.role !== "admin" && (
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void handleToggleStatus(u)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                              isSuspended
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            }`}
                          >
                            {isProcessing
                              ? "Updating..."
                              : isSuspended
                                ? "Reactivate"
                                : "Suspend"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            No customers found matching &quot;{searchQuery}&quot;.
          </div>
        )}
      </div>
    </main>
  );
}
