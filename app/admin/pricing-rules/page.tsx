"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Category = { id: string; code: string; name: string; isActive: boolean };
type Rule = {
  id: string;
  name: string;
  scope: string;
  discountPercent: number | null;
  isActive: boolean;
  pricingCategoryId: string | null;
  customerUserId: string | null;
  dealerId: string | null;
};

export default function PricingRulesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState("");
  const [catCode, setCatCode] = useState("");
  const [catName, setCatName] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [scope, setScope] = useState("pricing_category");
  const [discountPercent, setDiscountPercent] = useState("");
  const [pricingCategoryId, setPricingCategoryId] = useState("");
  const [customerUserId, setCustomerUserId] = useState("");
  const [dealerId, setDealerId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [cR, rR] = await Promise.all([
      fetch("/api/admin/pricing-categories", { cache: "no-store" }),
      fetch("/api/admin/pricing-rules", { cache: "no-store" }),
    ]);
    const cD = await cR.json();
    const rD = await rR.json();
    if (!cR.ok) throw new Error(cD.error);
    if (!rR.ok) throw new Error(rD.error);
    setCategories(cD.categories);
    setRules(rD.rules);
    if (!pricingCategoryId && cD.categories[0]) {
      setPricingCategoryId(cD.categories[0].id);
    }
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

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/pricing-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: catCode, name: catName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setCatCode("");
      setCatName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/pricing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleName,
          scope,
          discountPercent:
            discountPercent.trim() === "" ? null : Number(discountPercent),
          pricingCategoryId:
            scope === "pricing_category" ? pricingCategoryId : null,
          customerUserId: scope === "customer" ? customerUserId : null,
          dealerId: scope === "dealer" ? dealerId : null,
          isActive: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRuleName("");
      setDiscountPercent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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
          <span className="text-sm">Pricing Rules</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dealer / Customer Pricing</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Back to Admin
          </Link>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          Configure categories and rules only. Percentages are never invented —
          leave discount blank/null until a commercial value is approved.
        </p>
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form
          onSubmit={createCategory}
          className="mt-8 grid gap-3 rounded-lg border bg-white p-6 md:grid-cols-3"
        >
          <h2 className="md:col-span-3 text-lg font-semibold">
            Pricing category
          </h2>
          <input
            required
            value={catCode}
            onChange={(e) => setCatCode(e.target.value)}
            placeholder="code (e.g. standard)"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            required
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="name"
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            disabled={saving}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Add category
          </button>
        </form>

        <form
          onSubmit={createRule}
          className="mt-6 grid gap-3 rounded-lg border bg-white p-6 md:grid-cols-3"
        >
          <h2 className="md:col-span-3 text-lg font-semibold">Pricing rule</h2>
          <input
            required
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="rule name *"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="pricing_category">pricing_category</option>
            <option value="dealer">dealer</option>
            <option value="customer">customer</option>
          </select>
          <input
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            placeholder="discount % (optional)"
            className="rounded border px-3 py-2 text-sm"
          />
          {scope === "pricing_category" && (
            <select
              required
              value={pricingCategoryId}
              onChange={(e) => setPricingCategoryId(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">category *</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          )}
          {scope === "customer" && (
            <input
              required
              value={customerUserId}
              onChange={(e) => setCustomerUserId(e.target.value)}
              placeholder="customer user id *"
              className="rounded border px-3 py-2 text-sm"
            />
          )}
          {scope === "dealer" && (
            <input
              required
              value={dealerId}
              onChange={(e) => setDealerId(e.target.value)}
              placeholder="dealer id *"
              className="rounded border px-3 py-2 text-sm"
            />
          )}
          <button
            disabled={saving}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Add rule
          </button>
        </form>

        <h2 className="mt-10 text-xl font-semibold">Categories</h2>
        <div className="mt-3 space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="rounded border bg-white p-3 text-sm">
              <span className="font-semibold">{c.code}</span> — {c.name}{" "}
              <span className="text-xs text-zinc-500">
                {c.isActive ? "active" : "inactive"}
              </span>
            </div>
          ))}
          {!categories.length && (
            <p className="text-sm text-zinc-500">No categories yet.</p>
          )}
        </div>

        <h2 className="mt-10 text-xl font-semibold">Rules</h2>
        <div className="mt-3 space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="rounded border bg-white p-3 text-sm">
              <p className="font-semibold">
                {r.name} · {r.scope}
              </p>
              <p className="text-xs text-zinc-600">
                discount:{" "}
                {r.discountPercent === null ? "not set" : `${r.discountPercent}%`}{" "}
                · {r.isActive ? "active" : "inactive"}
              </p>
            </div>
          ))}
          {!rules.length && (
            <p className="text-sm text-zinc-500">No rules yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}
