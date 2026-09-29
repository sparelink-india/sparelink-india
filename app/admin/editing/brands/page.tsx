"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAlert, IconCheck } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminError,
  AdminInlineLink,
  AdminNotice,
  AdminSection,
  AdminStat,
  AdminStatusBadge,
  panelClass,
} from "@/components/admin-ui";

/**
 * Brands, browser half.
 *
 * MEMBERSHIP IS NOT EDITABLE HERE, AND THAT IS THE POINT.
 *
 * The nine customer-facing brands live in PUBLIC_BRANDS, a config registry in
 * lib/public-brands.ts. It is the authority for what appears on /brands and in
 * the homepage grid, and it is code. This screen edits presentation on top of
 * it, and only that.
 *
 * There are three separate things and conflating them is the trap:
 *
 *   PUBLIC_BRANDS  the approved list. Nine brands. Code.
 *   this screen     presentation overrides. Database.
 *   part.brand      the catalogue value on 9,017 rows, free text, faceted by
 *                   the search index.
 *
 * So "Super Seal" becoming "Superseal" on a card does NOT rewrite 9,017
 * catalogue rows: that would break search facets, break any listing whose brand
 * string differs by a space, and could not be undone from an audit record. A
 * row whose id is not in the registry is discarded rather than rendered, so this
 * screen cannot introduce a tenth brand.
 */

type ResolvedBrand = {
  id: string;
  name: string;
  logo: string;
  relationship: string;
  searchQuery: string;
  description?: string | null;
  tagline?: string;
  overridden: string[];
  hasProfile: boolean;
  isVisible?: boolean;
};

type RegistryEntry = { id: string; name: string };

type Draft = {
  displayName: string;
  description: string;
  logoUrl: string;
  relationship: string;
  searchQuery: string;
  displayOrder: string;
  isVisible: boolean;
};

const INPUT =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

const FIELD_LABEL: Record<string, string> = {
  name: "Display name",
  description: "Description",
  logo: "Logo",
  relationship: "Relationship",
  searchQuery: "Search query",
  displayOrder: "Order",
  isVisible: "Visibility",
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<ResolvedBrand[]>([]);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");

  const [editing, setEditing] = useState<ResolvedBrand | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmReset, setConfirmReset] = useState<ResolvedBrand | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/brands", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(data.error || "The brands could not be loaded.");
        return;
      }
      setBrands(data.brands ?? []);
      setRegistry(data.registryNames ?? []);
      setIgnored(data.ignoredOverlayIds ?? []);
    } catch {
      setLoadError("The brands could not be loaded.");
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

  const stats = useMemo(
    () => ({
      overridden: brands.filter((b) => b.overridden.length > 0).length,
      hidden: brands.filter((b) => b.isVisible === false).length,
      described: brands.filter((b) => b.description).length,
    }),
    [brands],
  );

  function openEditor(brand: ResolvedBrand) {
    setMutationError("");
    setNotice("");
    setEditing(brand);
    /* Seeded from the EFFECTIVE value, not the overlay, so an admin sees what
       is live and edits relative to it. Clearing a field then means "fall back
       to the registry value", which is what a null means. */
    setDraft({
      displayName: brand.name,
      description: brand.description ?? "",
      logoUrl: brand.logo,
      relationship: brand.relationship,
      searchQuery: brand.searchQuery,
      displayOrder: "",
      isVisible: brand.isVisible !== false,
    });
  }

  async function save() {
    if (!editing || !draft || busy) return;
    setBusy(true);
    setMutationError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          displayName: draft.displayName.trim(),
          description: draft.description.trim(),
          logoUrl: draft.logoUrl.trim(),
          relationship: draft.relationship,
          searchQuery: draft.searchQuery.trim(),
          displayOrder: draft.displayOrder.trim() === "" ? null : Number(draft.displayOrder),
          isVisible: draft.isVisible,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(
          data.details?.length
            ? data.details.map((d: { field: string; error: string }) => `${d.field}: ${d.error}`).join(" · ")
            : data.error || "The brand could not be saved.",
        );
        return;
      }
      setEditing(null);
      setNotice(`Saved. ${data.brand?.overridden?.length ?? 0} field(s) now override the registry.`);
      await load();
    } catch {
      setMutationError("The brand could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    const brand = confirmReset;
    if (!brand || busy) return;
    setConfirmReset(null);
    setBusy(true);
    setMutationError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/brands?id=${encodeURIComponent(brand.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(data.error || "The brand could not be reset.");
        return;
      }
      setNotice(
        data.changed
          ? `Reset. ${brand.name} is back to its registry values.`
          : `${brand.name} was already at its registry values.`,
      );
      await load();
    } catch {
      setMutationError("The brand could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Brands" subtitle="Presentation overrides for the approved public registry" activeHref="/admin/editing">
      {loadError ? <AdminError message={loadError} /> : null}
      {mutationError ? <AdminError message={mutationError} /> : null}
      {notice ? <AdminNotice message={notice} /> : null}

      <div className="mt-4">
        <AdminStat label="Registry brands" value={String(brands.length)} tone="neutral" />
        <AdminStat label="Overridden" value={String(stats.overridden)} tone="brand" />
        <AdminStat label="With description" value={String(stats.described)} tone="neutral" />
        <AdminStat label="Hidden" value={String(stats.hidden)} tone={stats.hidden ? "warn" : "neutral"} />
      </div>

      <AdminSection
        eyebrow="Three separate things"
        title="What is editable, and what is not"
        description="Membership is the config registry and is not editable here. Presentation overrides are what this screen changes. The catalogue's part.brand value on 9,017 rows is not reachable from this screen at all, and never will be."
      />

      {ignored.length > 0 ? (
        <div className={`mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4`}>
          <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold text-amber-900">Ignored override rows</p>
            <p className="mt-1 text-sm text-amber-800">
              {ignored.join(", ")} — not in the registry, so they have no effect. This
              normally means a config file changed and a saved row is now orphaned.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th scope="col" className="py-2 pr-3 font-semibold">Brand</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Registry name</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Relationship</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Search query</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Overrides</th>
                <th scope="col" className="py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => {
                const regName = registry.find((r) => r.id === brand.id)?.name ?? brand.id;
                const renamed = brand.name !== regName;
                return (
                  <tr key={brand.id} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-zinc-900">{brand.name}</span>
                      {brand.isVisible === false ? (
                        <span className="ml-1.5">
                          <AdminStatusBadge tone="warn">Hidden</AdminStatusBadge>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {regName}
                      {renamed ? (
                        <span className="ml-1.5 text-[11px] text-amber-700">overridden</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">{brand.relationship}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-zinc-600">{brand.searchQuery}</td>
                    <td className="py-2 pr-3">
                      {brand.overridden.length === 0 ? (
                        <span className="text-xs text-zinc-400">none</span>
                      ) : (
                        <span className="text-xs text-zinc-600">
                          {brand.overridden.map((f) => FIELD_LABEL[f] ?? f).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminActionButton tone="secondary" onClick={() => openEditor(brand)}>
                          Edit
                        </AdminActionButton>
                        <AdminInlineLink href="/brands">View page</AdminInlineLink>
                        {brand.hasProfile ? (
                          <AdminActionButton tone="ghost" onClick={() => setConfirmReset(brand)}>
                            Reset
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

      {editing && draft ? (
        <section aria-label="Edit brand" className="mt-6">
          <AdminSection
            eyebrow="Editing"
            title={editing.name}
            description="Blank fields fall back to the registry value. Clearing a field explicitly restores the registry value rather than blanking the card."
          />
          <div className={`mt-3 ${panelClass} space-y-4 p-4`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Display name
                </span>
                <input
                  value={draft.displayName}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  className={`mt-1.5 ${INPUT}`}
                  maxLength={80}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Relationship
                </span>
                <select
                  value={draft.relationship}
                  onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
                  className={`mt-1.5 ${INPUT}`}
                >
                  <option value="distributor">Distributor</option>
                  <option value="trader">Trader</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Logo path
                </span>
                <input
                  value={draft.logoUrl}
                  onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                  className={`mt-1.5 ${INPUT}`}
                  maxLength={500}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Search query
                </span>
                <input
                  value={draft.searchQuery}
                  onChange={(e) => setDraft({ ...draft, searchQuery: e.target.value })}
                  className={`mt-1.5 ${INPUT}`}
                  maxLength={120}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Display order
                </span>
                <input
                  value={draft.displayOrder}
                  onChange={(e) => setDraft({ ...draft, displayOrder: e.target.value })}
                  inputMode="numeric"
                  placeholder="Blank keeps registry order"
                  className={`mt-1.5 ${INPUT}`}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                  Visibility
                </span>
                <label className="mt-1.5 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={draft.isVisible}
                    onChange={(e) => setDraft({ ...draft, isVisible: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Shown on /brands and the homepage grid
                </label>
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
                Description
              </span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                maxLength={400}
                className={`mt-1.5 ${INPUT}`}
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Approved brand copy only. Leave blank if there is none; it is never
                populated from a tagline or invented.
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <AdminActionButton tone="primary" disabled={busy} onClick={() => void save()}>
                Save overrides
              </AdminActionButton>
              <AdminActionButton tone="ghost" onClick={() => setEditing(null)}>
                Cancel
              </AdminActionButton>
            </div>
          </div>
        </section>
      ) : null}

      <section aria-label="What this screen deliberately cannot do" className="mt-8">
        <AdminSection eyebrow="Deliberate limits" title="What this screen will not do" />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Add or remove a brand. Membership is the config registry, and an
                override row for an id that is not in it is discarded rather than
                rendered.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Rewrite the catalogue&apos;s brand values. <code className="font-mono text-xs">part.brand</code>{" "}
                is free text on 9,017 rows and is what search facets on. A display
                name change is presentation, not a data migration, and is not
                undoable from an audit record.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                Need a reset? Removing the override row restores the registry
                exactly, because absent means &quot;use the registry&quot; rather than
                storing a copy of it. There is no half-restored state.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                A brand edit never breaks the brands page. If the override read
                fails, the approved registry renders unchanged rather than the
                page going blank.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <AdminConfirmDialog
        open={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => void doReset()}
        title={`Reset "${confirmReset?.name}"?`}
        description="Removes this brand's overrides so it renders exactly as the config registry defines it. Nothing about the catalogue changes."
        confirmLabel="Reset to registry"
        tone="danger"
        busy={busy}
      />
    </AdminShell>
  );
}
