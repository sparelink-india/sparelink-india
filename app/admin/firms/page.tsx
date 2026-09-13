"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Firm = {
  id: string;
  name: string;
  code: string;
  ledgerReference: string;
  isActive: boolean;
  createdAt: string;
};

export default function FirmsPage() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/admin/firms", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setFirms(d.firms);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load firms.");
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
          <span className="text-sm">Manage Firms</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Firms</h1>
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
          <p className="mt-6 text-sm text-zinc-500">Loading firms...</p>
        )}

        {!loading && firms.length > 0 && (
          <div className="mt-8 space-y-4">
            {firms.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border bg-white p-6 hover:border-blue-300"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      Code: {f.code} | Ledger: {f.ledgerReference}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {f.isActive ? "Active" : "Inactive"} · Created{" "}
                      {new Date(f.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded px-3 py-1 text-xs font-medium ${
                        f.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {f.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && firms.length === 0 && (
          <p className="mt-6 text-sm text-zinc-500">No firms found.</p>
        )}
      </div>
    </main>
  );
}
