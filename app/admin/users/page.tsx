"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type UserItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  phoneNumber: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
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

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-4">
          <Link href="/admin" className="text-xl font-bold">
            SpareLink India
          </Link>
          <span className="text-sm">Manage Users</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Users</h1>
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
          <p className="mt-6 text-sm text-zinc-500">Loading users...</p>
        )}

        {!loading && users.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Verified</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.phoneNumber || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {u.emailVerified ? (
                        <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                          ✓
                        </span>
                      ) : (
                        <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {new Date(u.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && users.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No users found.</p>
        )}
      </div>
    </main>
  );
}
