"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAlert, IconBoxes, IconCheck, IconSearch } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminEmptyState,
  AdminError,
  AdminFilterBar,
  AdminInlineLink,
  AdminNotice,
  AdminSearch,
  AdminSection,
  AdminStat,
  AdminStatusBadge,
  panelClass,
} from "@/components/admin-ui";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/lib/product-images";

/**
 * Product Images, browser half.
 *
 * READ AND REPORT, NOT REBUILD.
 *
 * The catalogue's images are not rows in a table. They are two build-time JSON
 * indexes plus the binaries in R2, resolved by
 * `lib/catalogue-image-index.ts`. So this screen's job is to answer three
 * questions an admin actually has:
 *
 *   1. does this part have an image
 *   2. does it have the fast derivatives as well as the original
 *   3. where is that image served from
 *
 * Uploading replaces one original at its derived key. Nothing here deletes,
 * because the indexes that decide whether an image is visible cannot be written
 * from a request, so a delete would leave the storefront advertising an image
 * that no longer resolves.
 *
 * Uploads additionally require R2 credentials, which are not configured in
 * production. Browse and preview work fully regardless; the upload control
 * reports that state honestly instead of being hidden or faking success.
 */

type StorageState =
  | { canUpload: true }
  | { canUpload: false; reason: string; assetOrigin: string | null };

type ProductRow = {
  id: string;
  partNumber: string;
  name: string;
  brand: string | null;
  categoryName: string | null;
  status: "original-and-derivatives" | "original-only" | "missing";
  statusLabel: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  mediumUrl: string | null;
};

const STATUS_TONE: Record<ProductRow["status"], "good" | "warn" | "critical"> = {
  "original-and-derivatives": "good",
  "original-only": "warn",
  missing: "critical",
};

const PAGE_SIZE = 24;

export default function ProductImagesPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [storage, setStorage] = useState<StorageState | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [busyPartId, setBusyPartId] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), perPage: String(PAGE_SIZE) });
      if (query.trim()) params.set("q", query.trim());
      if (brand.trim()) params.set("brand", brand.trim());
      const response = await fetch(`/api/admin/product-images?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(data.error || "The product image list could not be loaded.");
        return;
      }
      setRows(data.products ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? nextPage);
      if (data.storage) setStorage(data.storage as StorageState);
    } catch {
      setLoadError("The product image list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [query, brand]);

  /* Deferred by a tick, matching the vehicle compatibility page: this fetches
     once on mount and is not synchronising with an external system. */
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load(1);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const stats = useMemo(
    () => ({
      withDerivatives: rows.filter((r) => r.status === "original-and-derivatives").length,
      originalOnly: rows.filter((r) => r.status === "original-only").length,
      missing: rows.filter((r) => r.status === "missing").length,
    }),
    [rows],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function uploadFor(row: ProductRow, file: File) {
    setBusyPartId(row.id);
    setUploadError("");
    setNotice("");
    try {
      const bytes = await file.arrayBuffer();
      let binary = "";
      const chunk = new Uint8Array(bytes);
      // Chunked so a large file does not blow the argument limit of fromCharCode.
      for (let i = 0; i < chunk.length; i += 0x8000) {
        binary += String.fromCharCode(...chunk.subarray(i, i + 0x8000));
      }
      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: row.id,
          sku: row.id,
          fileName: file.name,
          contentType: file.type,
          bytesBase64: btoa(binary),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUploadError(data.error || "The image could not be uploaded.");
        return;
      }
      setNotice(`Uploaded the image for ${row.partNumber}.`);
      await load(page);
    } catch {
      setUploadError("The image could not be uploaded.");
    } finally {
      setBusyPartId(null);
    }
  }

  return (
    <AdminShell
      title="Product Images"
      subtitle="Catalogue image state, with single-image replacement"
      activeHref="/admin/editing"
    >
      {loadError ? <AdminError message={loadError} /> : null}
      {uploadError ? <AdminError message={uploadError} /> : null}
      {notice ? <AdminNotice message={notice} /> : null}

      {storage && storage.canUpload === false ? (
        <div className={`mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4`}>
          <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">Storage not configured</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{storage.reason}</p>
            {storage.assetOrigin ? (
              <p className="mt-1 text-xs text-amber-700">
                Reading still works. Images are served from {storage.assetOrigin}.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <AdminStat label="Matching products" value={String(total)} tone="neutral" />
        <AdminStat label="With derivatives" value={String(stats.withDerivatives)} tone="good" />
        <AdminStat label="Original only" value={String(stats.originalOnly)} tone="warn" />
        <AdminStat label="No image" value={String(stats.missing)} tone="critical" />
      </div>

      <AdminSection
        eyebrow="How images are stored"
        title="There is no image column to edit"
        description="Catalogue images resolve from two build-time indexes plus the binaries in R2. The status below is derived from those indexes, so it always matches what the storefront actually serves. A replacement writes one original at its derived key."
      />

      <AdminSection
        eyebrow="Browse"
        title="Catalogue image state"
        description="Search by part number or name, optionally narrow by brand. Status is derived, never stored."
      />

      <div className={`mt-3 ${panelClass} p-4`}>
        <AdminFilterBar>
          <AdminSearch
            label="Search products"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Part number or nameâ€¦"
          />
          <AdminSearch
            label="Brand"
            value={brand}
            onChange={(v) => {
              setBrand(v);
              setPage(1);
            }}
            placeholder="Filter by brandâ€¦"
          />
          <AdminActionButton
            tone="primary"
            icon={<IconSearch className="h-4 w-4" />}
            onClick={() => void load(1)}
          >
            Search
          </AdminActionButton>
        </AdminFilterBar>
      </div>

      {loading ? (
        <div className="mt-3 h-32 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No products matched"
          description="Try a shorter search term, or clear the brand filter."
          icon={<IconBoxes className="h-5 w-5" />}
        />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th scope="col" className="py-2 pr-3 font-semibold">Image</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Part number</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Name</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Brand</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Category</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                <th scope="col" className="py-2 font-semibold">Replace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 align-middle">
                  <td className="py-2 pr-3">
                    {row.thumbUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={row.thumbUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded border border-zinc-200 bg-white object-contain"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded border border-dashed border-zinc-300 text-[10px] text-zinc-400">
                        none
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.partNumber}</td>
                  <td className="py-2 pr-3 max-w-[18rem] truncate">{row.name}</td>
                  <td className="py-2 pr-3">{row.brand ?? "â€”"}</td>
                  <td className="py-2 pr-3">{row.categoryName ?? "â€”"}</td>
                  <td className="py-2 pr-3">
                    <AdminStatusBadge tone={STATUS_TONE[row.status]}>{row.statusLabel}</AdminStatusBadge>
                  </td>
                  <td className="py-2">
                    <label className="inline-flex">
                      <span className="sr-only">Replace image for {row.partNumber}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        disabled={storage?.canUpload === false || busyPartId !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void uploadFor(row, file);
                        }}
                      />
                      <span
                        aria-hidden
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                      >
                        {busyPartId === row.id ? "Uploadingâ€¦" : "Choose file"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AdminActionButton
            tone="secondary"
            disabled={page <= 1}
            onClick={() => void load(page - 1)}
          >
            Previous
          </AdminActionButton>
          <span className="text-xs text-zinc-600">
            Page {page} of {pageCount}
          </span>
          <AdminActionButton
            tone="secondary"
            disabled={page >= pageCount}
            onClick={() => void load(page + 1)}
          >
            Next
          </AdminActionButton>
        </div>
      ) : null}

      <section aria-label="What this screen deliberately cannot do" className="mt-8">
        <AdminSection
          eyebrow="Deliberate limits"
          title="What this screen will not do"
        />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                No bulk edit. Regenerating the catalogue&apos;s images is a pipeline
                job, not an admin click, so a multi-image request is refused at
                the edge.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                No delete. The indexes that decide whether an image is visible are
                build-time artifacts, so removing the object would leave the
                storefront advertising an image that no longer resolves. Replace
                overwrites the same key instead.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                The storage key is derived on the server from the part id and the
                declared file type. A browser cannot choose where in the bucket a
                file lands.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Nothing here rewrites product data. Price, stock and fitment are
                managed elsewhere and are deliberately not reachable from this
                screen.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Uploads are limited to {Math.round(MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024)} MB, PNG,
            JPEG or WebP. See{" "}
            <AdminInlineLink href="/admin/editing">the Editing Studio</AdminInlineLink> for the
            other catalogue tools.
          </p>
        </div>
      </section>
    </AdminShell>
  );
}
