"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminEmptyState,
  AdminError,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminSection,
  AdminStatusBadge,
  AdminTextarea,
  panelClass,
} from "@/components/admin-ui";
import { IconCard, IconCheck, IconExternal, IconUpload } from "@/components/admin-icons";

/**
 * Advertisement / Banner Manager.
 *
 * A separate admin system from the hero and from vehicle fitment, on purpose.
 * It manages promotional artwork only: it has no notion of vehicles, parts or
 * compatibility, and nothing it does can change what a part fits.
 *
 * The workflow is upload-then-create rather than create-then-upload. The
 * upload route returns a storage key and creates nothing, so an abandoned
 * upload cannot become a live banner, and a new banner is always created
 * DISABLED — going live is a second, explicit action. That ordering is what
 * stops a half-finished banner appearing on the live storefront.
 *
 * Every mutation goes through /api/admin/banners, which is behind
 * `requireAdminApi` — the same admin gate as every other admin route.
 */

type Banner = {
  id: string;
  title: string;
  imageKey: string;
  imageUrl: string;
  altText: string | null;
  destinationUrl: string | null;
  isEnabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

type Draft = {
  title: string;
  altText: string;
  destinationUrl: string;
};

const EMPTY_DRAFT: Draft = { title: "", altText: "", destinationUrl: "" };

/** Advisory only. The stage is 3:1 on desktop and 16:9 on a phone. */
const RATIO_HINT = "3:1 to 4:1 on desktop (the storefront stage is 3:1).";

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [imageKey, setImageKey] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Banner | null>(null);
  const [busyId, setBusyId] = useState("");
  /** Local ordering applied before the reorder request is confirmed. */
  const [order, setOrder] = useState<string[]>([]);

  const fileInput = useRef<HTMLInputElement | null>(null);
  const replaceInput = useRef<HTMLInputElement | null>(null);
  const replaceTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/banners", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load banners.");
      const rows: Banner[] = Array.isArray(data.banners) ? data.banners : [];
      setBanners(rows);
      setOrder(rows.map((row) => row.id));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load banners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    /* Deferred by a tick, matching the other admin list pages. `load` sets
       state synchronously when the promise resolves, and calling it straight
       from the effect body is what the react-hooks lint rule is objecting to. */
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const ordered = useCallback((): Banner[] => {
    const byId = new Map(banners.map((row) => [row.id, row]));
    const sorted = order
      .map((id) => byId.get(id))
      .filter((row): row is Banner => Boolean(row));
    // Any banner the local order has not caught up with yet still has to appear.
    for (const row of banners) {
      if (!sorted.some((entry) => entry.id === row.id)) sorted.push(row);
    }
    return sorted;
  }, [banners, order]);

  /* ---------------- upload ---------------- */

  async function uploadFile(file: File): Promise<string | null> {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/banners/upload", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      return String(data.key || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function onPickNew(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const key = await uploadFile(file);
    if (!key) return;
    setImageKey(key);
    // A local object URL for instant preview. The public URL is only known once
    // R2_PUBLIC_BASE_URL is set, and an admin needs to see what they picked
    // before they commit it.
    setImagePreview(URL.createObjectURL(file));
    if (!draft.title.trim()) {
      setDraft((current) => ({
        ...current,
        title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 80),
      }));
    }
  }

  async function onPickReplace(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const id = replaceTarget.current;
    if (!file || !id) return;
    const key = await uploadFile(file);
    if (!key) return;
    await patch(id, { imageKey: key }, "Banner image replaced.");
  }

  /* ---------------- mutations ---------------- */

  async function patch(
    id: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Update failed.");
      setNotice(successMessage);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusyId("");
    }
  }

  async function createBanner() {
    if (creating) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          altText: draft.altText,
          destinationUrl: draft.destinationUrl,
          imageKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not create banner.");
      setDraft(EMPTY_DRAFT);
      setImageKey("");
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview("");
      setNotice("Banner created. It is disabled until you enable it.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create banner.");
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    setBusyId(target.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/banners/${target.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      setNotice(`Deleted "${target.title}".`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed.");
    } finally {
      setBusyId("");
    }
  }

  /* ---------------- reordering ---------------- */

  function move(id: string, direction: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      const at = next.indexOf(id);
      const to = at + direction;
      if (at < 0 || to < 0 || to >= next.length) return current;
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  }

  async function saveOrder() {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save the order.");
      setNotice("Banner order saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the order.");
    }
  }

  const rows = ordered();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Advertisement / Banner Manager
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Promotional banners for the storefront slider. Separate from vehicle
              fitment and from the hero.
            </p>
          </div>
          <Link href="/admin" className="text-sm text-[#7a1233] hover:underline">
            Back to Admin
          </Link>
        </div>

        {error ? <AdminError message={error} onRetry={() => void load()} /> : null}
        {notice ? <div className="mb-4"><AdminNotice message={notice} /></div> : null}

        <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
          {/* ---------------- create ---------------- */}
          <section className={`${panelClass} p-4 lg:sticky lg:top-6`}>
            <AdminSection
              eyebrow="New"
              title="Add a banner"
              description="Upload the image first, then save. The banner is created disabled."
            />

            <input
              ref={fileInput}
              type="file"
              accept="image/webp,image/png,image/jpeg,image/avif"
              className="sr-only"
              onChange={onPickNew}
            />

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center transition-colors hover:border-[#7a1233] hover:bg-white disabled:opacity-60"
            >
              {imagePreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imagePreview}
                  alt="Selected banner preview"
                  className="max-h-28 w-auto rounded-lg"
                />
              ) : (
                <IconUpload className="h-5 w-5 text-zinc-400" />
              )}
              <span className="text-xs font-semibold text-zinc-700">
                {uploading ? "Uploading…" : imageKey ? "Replace image" : "Choose image"}
              </span>
              <span className="text-[11px] text-zinc-500">{RATIO_HINT}</span>
            </button>

            {imageKey ? (
              <p className="mt-2 break-all text-[10px] text-zinc-400">{imageKey}</p>
            ) : null}

            <div className="mt-4 space-y-3">
              <AdminField
                label="Title / name"
                htmlFor="banner-title"
                hint="For your reference. Shown to customers only as the image alt text, if you leave alt text empty."
              >
                <AdminInput
                  id="banner-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Monsoon filters offer"
                />
              </AdminField>

              <AdminField
                label="Alt text"
                htmlFor="banner-alt"
                hint="Describe the banner for screen readers. Leave empty to use the title."
              >
                <AdminTextarea
                  id="banner-alt"
                  rows={2}
                  value={draft.altText}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, altText: event.target.value }))
                  }
                />
              </AdminField>

              <AdminField
                label="Destination URL (optional)"
                htmlFor="banner-destination"
                hint="Leave empty for a display-only banner. Use a site path like /offers, or a full https:// URL."
              >
                <AdminInput
                  id="banner-destination"
                  value={draft.destinationUrl}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      destinationUrl: event.target.value,
                    }))
                  }
                  placeholder="/offers"
                />
              </AdminField>

              <AdminActionButton
                tone="primary"
                onClick={() => void createBanner()}
                disabled={creating || uploading || !imageKey || !draft.title.trim()}
                className="w-full !bg-[#7a1233]"
                style={{ backgroundColor: "#7a1233" }}
              >
                {creating ? "Saving…" : "Save banner (disabled)"}
              </AdminActionButton>
            </div>
          </section>

          {/* ---------------- list ---------------- */}
          <section className={panelClass}>
            <div className="border-b border-zinc-100 p-4">
              <AdminSection
                eyebrow="Storefront"
                title={`Banners (${banners.length})`}
                description="Only enabled banners appear on the storefront. Top to bottom is the display order."
                action={
                  <AdminActionButton
                    onClick={() => void saveOrder()}
                    disabled={loading || banners.length < 2}
                  >
                    Save order
                  </AdminActionButton>
                }
                className="mb-0"
              />
            </div>

            {loading ? (
              <p className="p-6 text-sm text-zinc-500">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="p-4">
                <AdminEmptyState
                  icon={<IconCard className="h-5 w-5" />}
                  title="No banners yet"
                  description="The storefront shows a quiet empty banner area until you add and enable a banner here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {rows.map((banner, position) => (
                  <li key={banner.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="w-full shrink-0 sm:w-56">
                        <div className="flex aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                          {banner.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={banner.imageUrl}
                              alt={banner.altText || banner.title}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="px-3 text-center text-[10px] text-zinc-400">
                              No public image URL. Set R2_PUBLIC_BASE_URL so previews and the
                              storefront can load this image.
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <AdminActionButton
                            onClick={() => move(banner.id, -1)}
                            disabled={position === 0}
                            aria-label={`Move "${banner.title}" up`}
                            className="!px-2"
                          >
                            ↑
                          </AdminActionButton>
                          <AdminActionButton
                            onClick={() => move(banner.id, 1)}
                            disabled={position === rows.length - 1}
                            aria-label={`Move "${banner.title}" down`}
                            className="!px-2"
                          >
                            ↓
                          </AdminActionButton>
                          <span className="ml-auto text-[10px] tabular-nums text-zinc-400">
                            #{position + 1}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-zinc-900">
                            {banner.title}
                          </h3>
                          {banner.isEnabled ? (
                            <AdminStatusBadge tone="good">
                              <IconCheck className="mr-1 inline h-3 w-3" />
                              Live
                            </AdminStatusBadge>
                          ) : (
                            <AdminStatusBadge tone="neutral">Disabled</AdminStatusBadge>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <AdminField label="Title / name" htmlFor={`title-${banner.id}`}>
                            <AdminInput
                              id={`title-${banner.id}`}
                              defaultValue={banner.title}
                              onBlur={(event) => {
                                const next = event.target.value.trim();
                                if (next && next !== banner.title) {
                                  void patch(banner.id, { title: next }, "Title updated.");
                                }
                              }}
                            />
                          </AdminField>

                          <AdminField
                            label="Destination URL"
                            htmlFor={`dest-${banner.id}`}
                            hint={
                              banner.destinationUrl
                                ? "Clicking the banner goes here."
                                : "Empty: the banner is display-only."
                            }
                          >
                            <AdminInput
                              id={`dest-${banner.id}`}
                              defaultValue={banner.destinationUrl ?? ""}
                              placeholder="/offers"
                              onBlur={(event) => {
                                const next = event.target.value.trim();
                                if (next !== (banner.destinationUrl ?? "")) {
                                  void patch(
                                    banner.id,
                                    { destinationUrl: next },
                                    "Destination updated.",
                                  );
                                }
                              }}
                            />
                          </AdminField>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <AdminActionButton
                            tone={banner.isEnabled ? "secondary" : "primary"}
                            onClick={() =>
                              void patch(
                                banner.id,
                                { isEnabled: !banner.isEnabled },
                                banner.isEnabled
                                  ? "Banner hidden from the storefront."
                                  : "Banner is now live on the storefront.",
                              )
                            }
                            disabled={busyId === banner.id}
                            className={banner.isEnabled ? "" : "!bg-[#7a1233]"}
                            style={banner.isEnabled ? undefined : { backgroundColor: "#7a1233" }}
                          >
                            {banner.isEnabled ? "Disable" : "Enable"}
                          </AdminActionButton>

                          <input
                            ref={replaceInput}
                            type="file"
                            accept="image/webp,image/png,image/jpeg,image/avif"
                            className="sr-only"
                            onChange={onPickReplace}
                          />
                          <AdminActionButton
                            onClick={() => {
                              replaceTarget.current = banner.id;
                              replaceInput.current?.click();
                            }}
                            disabled={busyId === banner.id || uploading}
                          >
                            Replace image
                          </AdminActionButton>

                          {banner.destinationUrl ? (
                            <a
                              href={banner.destinationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-[#7a1233] hover:underline"
                            >
                              <IconExternal className="h-3 w-3" />
                              Open destination
                            </a>
                          ) : null}

                          <AdminActionButton
                            tone="danger"
                            onClick={() => setPendingDelete(banner)}
                            disabled={busyId === banner.id}
                            className="ml-auto"
                          >
                            Delete
                          </AdminActionButton>
                        </div>

                        <p className="break-all text-[10px] text-zinc-400">
                          {banner.imageKey}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <AdminConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        busy={busyId === pendingDelete?.id}
        title="Delete this banner?"
        confirmLabel="Delete banner"
        description={
          <>
            <strong>{pendingDelete?.title}</strong> will be removed from the storefront and
            its image deleted from storage. This cannot be undone.
          </>
        }
      />
    </main>
  );
}
