"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAlert, IconBoxes, IconCheck, IconSearch } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
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

/**
 * Product Information, browser half.
 *
 * SINGLE PRODUCT AT A TIME, DELIBERATELY.
 *
 * A product's name, brand and description live on `part`, one row, no firm
 * coupling, and those are what this screen edits. Price and stock do NOT live
 * there, and that is the reason this editor is deliberately narrow:
 *
 *   price / MRP  one row per dealer listing AND per firm. Ambaji Traders, Hind
 *                Motors and India Sales each have their own. Editing a price
 *                here would be a firm-scoped commercial decision taken from a
 *                screen that has no firm picker.
 *   stock        moves through stock transactions with row locking, order
 *                reservations and cancellation restocks. A direct write would
 *                hand out stock that is already sold.
 *   GST          computed at render from the listing price. There is no column.
 *   fitment      owned by part_vehicle_compatibility, edited in Vehicle
 *                Compatibility.
 *
 * So the editor shows all of those as read-only, with where they are managed,
 * rather than hiding them. An admin who needs a price change should be able to
 * see that one exists and where to go, instead of concluding the system has no
 * price.
 *
 * There is no bulk edit and no filtered scope anywhere in this screen or its API.
 * That is structural, not a setting: there is no code path that would accept
 * more than one part id.
 */

type ProductState = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
  oemNumber: string | null;
  alternatePartNumbers: string | null;
  barcode: string | null;
  productType: string | null;
  warrantyMonths: number | null;
  specifications: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
  approvalStatus: string;
};

type SyncState = { ok: true; action: "upsert" | "delete"; documentId: string };

const PRODUCT_TYPES = [
  "aftermarket",
  "genuine",
  "original",
  "oem",
  "refurbished",
  "remanufactured",
];

type Draft = {
  name: string;
  description: string;
  brand: string;
  oemNumber: string;
  alternatePartNumbers: string;
  barcode: string;
  productType: string;
  warrantyMonths: string;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

function draftFrom(p: ProductState): Draft {
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    brand: p.brand ?? "",
    oemNumber: p.oemNumber ?? "",
    alternatePartNumbers: p.alternatePartNumbers ?? "",
    barcode: p.barcode ?? "",
    productType: p.productType ?? "aftermarket",
    warrantyMonths: p.warrantyMonths === null ? "" : String(p.warrantyMonths),
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    isPublished: p.isPublished,
  };
}

export default function ProductInformationPage() {
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<ProductState | null>(null);
  const [fitment, setFitment] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [notice, setNotice] = useState("");
  const [sync, setSync] = useState<SyncState | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async (partNumber: string) => {
    const term = partNumber.trim();
    setLoadError("");
    setSaveError("");
    setSyncWarning("");
    setNotice("");
    setSync(null);
    setProduct(null);
    setDraft(null);
    setFitment([]);
    if (!term) return;

    setLoading(true);
    try {
      /* The API takes a part id. This screen resolves the human-facing part
         number through the existing catalogue search, so an admin pastes
         "M-648" and gets the right product without learning an internal id. */
      const lookup = await fetch(
        `/api/search/parts?q=${encodeURIComponent(term)}&perPage=1`,
        { cache: "no-store" },
      );
      const found = await lookup.json().catch(() => ({}));
      const hit = found?.results?.[0]?.document;
      if (!hit?.id) {
        setLoadError(`No product matched "${term}".`);
        return;
      }

      const response = await fetch(
        `/api/admin/product-information?partId=${encodeURIComponent(hit.id)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(data.error || "The product could not be loaded.");
        return;
      }
      setProduct(data.product as ProductState);
      setDraft(draftFrom(data.product as ProductState));
      setFitment(data.fitment ?? []);
    } catch {
      setLoadError("The product could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void search(query);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [query, search]);

  const dirty = useMemo(() => {
    if (!product || !draft) return false;
    return JSON.stringify(draftFrom(product)) !== JSON.stringify(draft);
  }, [product, draft]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!product || !draft || busy) return;
    setBusy(true);
    setSaveError("");
    setSyncWarning("");
    setNotice("");
    setSync(null);
    try {
      /* Send only the fields that changed. An unchanged field absent from the
         payload means "leave alone", which is what keeps a concurrent edit by
         someone else from being overwritten by a form that merely loaded. */
      const baseline = draftFrom(product);
      const changes: Record<string, unknown> = {};
      for (const key of Object.keys(draft) as (keyof Draft)[]) {
        if (draft[key] === baseline[key]) continue;
        if (key === "warrantyMonths") {
          changes[key] = draft[key] === "" ? null : Number(draft[key]);
          continue;
        }
        changes[key] = draft[key];
      }

      const response = await fetch("/api/admin/product-information", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: product.id, ...changes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(
          data.details?.length
            ? data.details.map((d: { field: string; error: string }) => `${d.field}: ${d.error}`).join(" · ")
            : data.error || "The product could not be saved.",
        );
        return;
      }
      setSync((data.sync as SyncState) ?? null);
      if (data.syncWarning) {
        setSyncWarning(String(data.syncWarning));
      } else {
        setNotice(
          `Saved ${data.changedFields?.length ?? 0} field(s). Search index updated.`,
        );
      }
      /* Re-read so the form's baseline is what is now in the database, which
         keeps `dirty` honest instead of leaving it permanently true. */
      await search(product.partNumber);
    } catch {
      setSaveError("The product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Product Information"
      subtitle="Edit the descriptive fields that belong to the product itself"
      activeHref="/admin/editing"
    >
      {loadError ? <AdminError message={loadError} /> : null}
      {saveError ? <AdminError message={saveError} /> : null}
      {syncWarning ? (
        <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold text-amber-900">Saved, but not indexed</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{syncWarning}</p>
          </div>
        </div>
      ) : null}
      {notice ? <AdminNotice message={notice} /> : null}

      <AdminSection
        eyebrow="Field ownership"
        title="Why this editor is narrow"
        description="A product's descriptive fields live on one row. Its price, stock and fitment do not, and each of those is owned somewhere with rules this screen must not bypass."
      />

      <div className="mt-4">
        <AdminStat label="Products editable here" value="1,1" tone="neutral" />
        <AdminStat label="Bulk edits available" value="None" tone="brand" />
        <AdminStat label="Search writes" value="Full document" tone="good" />
      </div>

      <AdminSection
        eyebrow="Find a product"
        title="Search by part number or name"
        description="One product at a time. There is no bulk edit and no filtered save anywhere in this screen or its API, so there is no path that could mass-update the catalogue."
      />

      <div className={`mt-3 ${panelClass} p-4`}>
        <AdminFilterBarLike>
          <AdminSearch
            label="Search products"
            value={query}
            onChange={setQuery}
            placeholder="Part number or name, e.g. M-648"
          />
          <AdminActionButton
            tone="primary"
            icon={<IconSearch className="h-4 w-4" />}
            disabled={loading}
            onClick={() => void search(query)}
          >
            Load product
          </AdminActionButton>
        </AdminFilterBarLike>
      </div>

      {loading ? (
        <div className="mt-3 h-40 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : !product || !draft ? (
        <AdminEmptyState
          title="No product loaded"
          description="Search for a part number above to edit its information."
          icon={<IconBoxes className="h-5 w-5" />}
        />
      ) : (
        <form
          className="mt-4 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className={`${panelClass} p-4`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-bold">{product.partNumber}</span>
              <AdminStatusBadge tone={product.isPublished ? "good" : "warn"}>
                {product.isPublished ? "Published" : "Not published"}
              </AdminStatusBadge>
              <AdminStatusBadge tone={product.approvalStatus === "APPROVED" ? "good" : "warn"}>
                {product.approvalStatus}
              </AdminStatusBadge>
              {product.categoryName ? (
                <span className="text-xs text-zinc-500">{product.categoryName}</span>
              ) : null}
              <AdminInlineLink href={`/part/${encodeURIComponent(product.partNumber)}`}>
                View product page
              </AdminInlineLink>
            </div>
          </div>

          <AdminSection eyebrow="Editable" title="Product fields" />

          <div className={`${panelClass} space-y-4 p-4`}>
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={300}
                className={INPUT}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={4000}
                rows={4}
                className={INPUT}
              />
            </Field>
            <Field label="Brand">
              <input
                value={draft.brand}
                onChange={(e) => set("brand", e.target.value)}
                maxLength={120}
                className={INPUT}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="OEM number">
                <input
                  value={draft.oemNumber}
                  onChange={(e) => set("oemNumber", e.target.value)}
                  maxLength={120}
                  className={INPUT}
                />
              </Field>
              <Field label="Alternate part numbers">
                <input
                  value={draft.alternatePartNumbers}
                  onChange={(e) => set("alternatePartNumbers", e.target.value)}
                  maxLength={1000}
                  className={INPUT}
                />
              </Field>
              <Field label="Barcode">
                <input
                  value={draft.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  maxLength={80}
                  className={INPUT}
                />
              </Field>
              <Field label="Quality">
                <select
                  value={draft.productType}
                  onChange={(e) => set("productType", e.target.value)}
                  className={INPUT}
                >
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Warranty (months)" hint="Blank means no warranty recorded.">
                <input
                  value={draft.warrantyMonths}
                  onChange={(e) => set("warrantyMonths", e.target.value)}
                  inputMode="numeric"
                  className={INPUT}
                />
              </Field>
              <Field label="Visibility">
                <label className="flex items-center gap-2 pt-1 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={draft.isPublished}
                    onChange={(e) => set("isPublished", e.target.checked)}
                    className="h-4 w-4"
                  />
                  Published in the storefront and search
                </label>
              </Field>
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              Unpublishing removes the product from the search index as well as
              hiding it. Re-publishing re-indexes it with every required field.
            </p>
          </div>

          <AdminSection eyebrow="Read-only here" title="Owned elsewhere" />

          <div className={`${panelClass} divide-y divide-zinc-100 p-4`}>
            <ReadOnly
              label="Selling price / MRP"
              owner="Pricing, per dealer listing and per firm"
              note="Ambaji Traders, Hind Motors and India Sales each carry their own listing price."
              href="/admin/inventory"
            />
            <ReadOnly
              label="Stock"
              owner="Inventory, through stock transactions"
              note="Quantities move with order reservations and cancellation restocks. A direct edit could promise stock that is already sold."
              href="/admin/inventory"
            />
            <ReadOnly
              label="GST"
              owner="Computed at render from the listing price"
              note="There is no GST column, so there is nothing here to edit."
            />
            <ReadOnly
              label="Vehicle fitment"
              owner="Vehicle Compatibility"
              note={
                fitment.length === 0
                  ? "This product is not linked to any fitment vehicle."
                  : `Linked to ${fitment.length} vehicle(s): ${fitment.join(", ")}`
              }
              href="/admin/editing/vehicle-compatibility"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AdminActionButton tone="primary" type="submit" disabled={!dirty || busy}>
              {busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
            </AdminActionButton>
            {dirty ? (
              <AdminActionButton tone="secondary" onClick={() => setDraft(draftFrom(product))}>
                Discard
              </AdminActionButton>
            ) : null}
            {sync ? (
              <span className="text-xs text-zinc-500">
                Last save: index {sync.action === "delete" ? "removed" : "updated"} for{" "}
                {sync.documentId}.
              </span>
            ) : null}
          </div>

          <section aria-label="What this screen does not do" className="mt-2">
            <div className={`${panelClass} p-5`}>
              <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
                <li className="flex gap-2.5">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    A save sends a COMPLETE search document, every required field
                    included. A partial update would not fail loudly on a missing
                    field, it would silently drop the fields it did not name.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    If search indexing fails, the product edit is still saved and
                    the failure is reported and audited as retryable. The
                    catalogue database is authoritative.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Only the fields you changed are sent, so a form that merely
                    loaded cannot overwrite an edit someone else made in the
                    meantime.
                  </span>
                </li>
              </ul>
            </div>
          </section>
        </form>
      )}
    </AdminShell>
  );
}

const INPUT =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wide text-zinc-600">
        {label}
        {required ? " *" : ""}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function ReadOnly({
  label,
  owner,
  note,
  href,
}: {
  label: string;
  owner: string;
  note: string;
  href?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-800">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{note}</p>
      </div>
      <p className="text-xs font-semibold text-zinc-500">
        {owner}
        {href ? (
          <>
            {" · "}
            <AdminInlineLink href={href}>Open</AdminInlineLink>
          </>
        ) : null}
      </p>
    </div>
  );
}

function AdminFilterBarLike({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2">{children}</div>;
}
