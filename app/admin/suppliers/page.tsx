"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  isActive: boolean;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/admin/suppliers", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuppliers(d.suppliers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load suppliers.");
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactName, phone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setName("");
      setContactName("");
      setPhone("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
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
          <span className="text-sm">Suppliers</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Suppliers</h1>
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
          className="mt-8 grid gap-3 rounded-lg border bg-white p-6 md:grid-cols-4"
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Supplier name *"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            disabled={saving}
            className="rounded bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            {saving ? "Saving..." : "Add supplier"}
          </button>
        </form>
        <div className="mt-8 space-y-3">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-lg border bg-white p-4">
              <p className="font-semibold">{s.name}</p>
              <p className="mt-1 text-xs text-zinc-600">
                {[s.contactName, s.phone, s.email, s.city]
                  .filter(Boolean)
                  .join(" · ") || "No contact details"}
              </p>
            </div>
          ))}
          {!suppliers.length && (
            <p className="text-sm text-zinc-500">No suppliers yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
