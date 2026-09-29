"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAlert, IconBoxes, IconCheck, IconList } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminError,
  AdminInlineLink,
  AdminNotice,
  AdminSearch,
  AdminSection,
  AdminStat,
  AdminStatusBadge,
  panelClass,
} from "@/components/admin-ui";
import { slugifyCategoryName } from "@/lib/category-admin";

/**
 * Categories, browser half.
 *
 * There is one taxonomy and this screen does not get to invent another.
 * Categories persist in the existing `part_category` table, and
 * `lib/category-navigation.ts` owns the navigation, the water-pump segments and
 * the slug rules on top of it. So this is an editor for the table, plus the
 * consequences of an edit, plus the reasons the dangerous ones are refused.
 *
 * The guard worth knowing about: `part.category_id` is ON DELETE SET NULL, so
 * deleting a category in use would not fail. It would succeed and strip the
 * category from every product in it, taking them out of category routes and
 * search facets simultaneously. Deletion is refused with the count instead.
 */

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
};

const INPUT =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [configOwnedIds, setConfigOwnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [indexNote, setIndexNote] = useState("");

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CategoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(data.error || "The categories could not be loaded.");
        return;
      }
      setCategories(data.categories ?? []);
      setConfigOwnedIds(data.configOwnedIds ?? []);
    } catch {
      setLoadError("The categories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [categories, query]);

  const totals = useMemo(
    () => ({
      unused: categories.filter((c) => c.productCount === 0).length,
      inUse: categories.filter((c) => c.productCount > 0).length,
      products: categories.reduce((sum, c) => sum + c.productCount, 0),
    }),
    [categories],
  );

  const derivedSlug = useMemo(() => slugifyCategoryName(name), [name]);

  function openEditor(row: CategoryRow) {
    setMutationError("");
    setNotice("");
    setIndexNote("");
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? "");
  }

  async function saveEdit() {
    if (!editing || busy) return;
    setBusy(true);
    setMutationError("");
    setNotice("");
    setIndexNote("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, name, description }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(
          data.details?.length
            ? data.details.map((d: { field: string; error: string }) => `${d.field}: ${d.error}`).join(" · ")
            : data.error || "The category could not be saved.",
        );
        return;
      }
      setEditing(null);
      setNotice(
        data.impact?.urlImpact === "moves"
          ? `Saved. The public URL is now /category/${data.saved.slug}.`
          : "Saved. The URL is unchanged.",
      );
      if (data.indexNote) setIndexNote(String(data.indexNote));
      await load();
    } catch {
      setMutationError("The category could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setMutationError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(
          data.details?.length
            ? data.details.map((d: { field: string; error: string }) => `${d.field}: ${d.error}`).join(" · ")
            : data.error || "The category could not be created.",
        );
        return;
      }
      setCreating(false);
      setNewName("");
      setDescription("");
      setNotice(`Created "${data.created.name}".`);
      await load();
    } catch {
      setMutationError("The category could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    const row = confirmDelete;
    if (!row || busy) return;
    setConfirmDelete(null);
    setBusy(true);
    setMutationError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/categories?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(data.error || "The category could not be deleted.");
        return;
      }
      setNotice(`Deleted "${row.name}". ${data.warning ?? ""}`);
      await load();
    } catch {
      setMutationError("The category could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Categories" subtitle="The existing category table, with safe edits" activeHref="/admin/editing">
      {loadError ? <AdminError message={loadError} /> : null}
      {mutationError ? <AdminError message={mutationError} /> : null}
      {notice ? <AdminNotice message={notice} /> : null}
      {indexNote ? (
        <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-sm leading-relaxed text-amber-800">{indexNote}</p>
        </div>
      ) : null}

      <div className="mt-4">
        <AdminStat label="Categories" value={String(categories.length)} tone="neutral" />
        <AdminStat label="In use" value={String(totals.inUse)} tone="brand" />
        <AdminStat label="Unused" value={String(totals.unused)} tone="warn" />
        <AdminStat label="Products covered" value={String(totals.products)} tone="good" />
      </div>

      <AdminSection
        eyebrow="One taxonomy"
        title="This screen edits the existing table"
        description="Categories already persist in part_category, and lib/category-navigation.ts owns the navigation, the water-pump segments and the slug rules on top of it. No second store is created here, and no category is built from a separate list."
      />

      <div className={`mt-3 ${panelClass} flex flex-wrap items-end gap-2 p-4`}>
        <AdminSearch
          label="Find a category"
          value={query}
          onChange={setQuery}
          placeholder="Name or slug…"
        />
        <AdminActionButton
          tone="primary"
          icon={<IconBoxes className="h-4 w-4" />}
          onClick={() => {
            setCreating((c) => !c);
            setMutationError("");
          }}
        >
          New category
        </AdminActionButton>
      </div>

      {creating ? (
        <div className={`mt-3 ${panelClass} p-4`}>
          <h3 className="text-sm font-bold text-zinc-900">Create a category</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">Name *</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={`mt-1.5 ${INPUT}`}
                placeholder="e.g. Steering & Suspension"
              />
              {newName.trim() ? (
                <span className="mt-1 block font-mono text-xs text-zinc-500">
                  /category/{slugifyCategoryName(newName)}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                Description
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`mt-1.5 ${INPUT}`}
                maxLength={500}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AdminActionButton tone="primary" disabled={!newName.trim() || busy} onClick={() => void create()}>
              Create
            </AdminActionButton>
            <AdminActionButton tone="ghost" onClick={() => setCreating(false)}>
              Cancel
            </AdminActionButton>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 h-40 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="No categories matched"
          description="Clear the search to see the full list."
          icon={<IconList className="h-5 w-5" />}
        />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th scope="col" className="py-2 pr-3 font-semibold">Name</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Slug</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Products</th>
                <th scope="col" className="py-2 pr-3 font-semibold">State</th>
                <th scope="col" className="py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const configOwned = configOwnedIds.includes(row.id);
                return (
                  <tr key={row.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-semibold text-zinc-900">{row.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-600">{row.slug}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.productCount}</td>
                    <td className="py-2 pr-3">
                      {row.productCount === 0 ? (
                        <AdminStatusBadge tone="warn">Unused</AdminStatusBadge>
                      ) : (
                        <AdminStatusBadge tone="good">In use</AdminStatusBadge>
                      )}
                      {configOwned ? (
                        <span className="ml-1.5">
                          <AdminStatusBadge tone="info">Navigation</AdminStatusBadge>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminActionButton tone="secondary" onClick={() => openEditor(row)}>
                          Edit
                        </AdminActionButton>
                        <AdminInlineLink href={`/category/${row.slug}`}>View</AdminInlineLink>
                        {row.productCount === 0 ? (
                          <AdminActionButton tone="ghost" onClick={() => setConfirmDelete(row)}>
                            Delete
                          </AdminActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <section aria-label="Edit category" className="mt-6">
          <AdminSection
            eyebrow="Editing"
            title={editing.name}
            description={`Affects ${editing.productCount} product(s). ${editing.productCount > 0 ? "Renaming changes the category name every one of them carries in search." : ""}`}
          />
          <div className={`mt-3 ${panelClass} p-4`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Name *
                </span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${INPUT}`} />
                <span className="mt-1 block text-xs text-zinc-500">
                  URL will be <span className="font-mono">/category/{derivedSlug}</span>
                </span>
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Description
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`mt-1.5 ${INPUT}`}
                  maxLength={500}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AdminActionButton tone="primary" disabled={busy} onClick={() => void saveEdit()}>
                Save
              </AdminActionButton>
              <AdminActionButton tone="ghost" onClick={() => setEditing(null)}>
                Cancel
              </AdminActionButton>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-label="What this screen guards against" className="mt-8">
        <AdminSection eyebrow="Guards" title="The three edits that actually break something" />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Deleting a category in use.</strong>{" "}
                <code className="font-mono text-xs">part.category_id</code> is ON DELETE SET
                NULL, so a permitted delete would not error. It would succeed and
                strip the category from every product in it. Refused here, with the
                count, rather than left to a constraint that does not exist.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>A hand-written slug.</strong> The slug is derived from the
                name by the config&apos;s own rule, which expands &quot;&amp;&quot; to
                &quot;and&quot; and truncates at 80 characters. A slug that disagrees gives
                one category two addresses. Change the name, not the slug.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>A rename without a reindex.</strong>{" "}
                <code className="font-mono text-xs">part_category.name</code> is the
                value the search index carries for every product in the category. A
                rename reports the affected count and asks for a reindex rather than
                leaving a stale index quietly.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                There is no bulk edit and no filtered scope. A rename touches one
                category row and reports its blast radius; it never rewrites
                products.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <AdminConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => void doDelete()}
        title={`Delete "${confirmDelete?.name}"?`}
        description="This category has no products. Its public URL will stop resolving and the name is unique, so nothing else will take its place."
        confirmLabel="Delete category"
        tone="danger"
        busy={busy}
      />
    </AdminShell>
  );
}
