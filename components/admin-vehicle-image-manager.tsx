"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { IconExternal, IconSearch, IconUpload } from "@/components/admin-icons";
import {
  AdminActionButton,
  AdminDialog,
  AdminEmptyState,
  AdminFilterBar,
  AdminSearch,
  AdminSection,
  AdminStatusBadge,
  panelClass,
} from "@/components/admin-ui";
import {
  HERO_ARTWORK_PATH,
  HERO_CLASS_IMAGE_NOTE,
  HERO_VEHICLE_CLASSES,
  IMAGE_PIPELINE_SCRIPT,
  IMAGE_STATUS_LABEL,
  IMAGE_STATUS_TONE,
  MODEL_IMAGE_DIRECTORY,
  type VehicleImageRow,
} from "@/lib/vehicle-image-catalogue";

/**
 * Vehicle Image Manager, browser half.
 *
 * Holds the search box and the preview dialog, which need state. The inventory
 * itself arrives as props from the server, so no catalogue file list and no
 * vehicle rows are re-fetched here.
 *
 * WHY THERE IS NO REPLACE MUTATION. See `lib/admin-vehicle-images.ts` for the
 * storage finding: these are committed files under `public/`, which is a
 * build-time directory, so a runtime write would work in `next dev` and vanish
 * in production. Rather than ship an upload that silently fails, the Replace
 * control is present but disabled and says why, and the dialog states the
 * sanctioned pipeline. The admin gets the truth and a working route forward;
 * what they do not get is a button that lies.
 */

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "present", label: "Present" },
  { id: "pending", label: "Intentionally absent" },
  { id: "missing", label: "No image" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

function statusMatches(row: VehicleImageRow, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  return row.status === filter;
}

function queryMatches(row: VehicleImageRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.make.toLowerCase().includes(needle) ||
    row.model.toLowerCase().includes(needle) ||
    (row.filename ?? "").toLowerCase().includes(needle)
  );
}

/** The framed preview, or the same branded absence the storefront shows. */
function ModelThumb({ row, size = 160 }: { row: VehicleImageRow; size?: number }) {
  if (!row.photo) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center"
        style={{ height: size }}
      >
        <span className="text-[11px] font-semibold leading-snug text-zinc-400">
          No image
          <br />
          on purpose
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-2"
      style={{ height: size }}
    >
      <Image
        src={row.photo}
        alt={`${row.make} ${row.model}`}
        width={size - 16}
        height={size - 16}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export function VehicleImageManager({
  rows,
  catalogueLoaded,
}: {
  rows: VehicleImageRow[];
  catalogueLoaded: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [preview, setPreview] = useState<VehicleImageRow | null>(null);

  const visible = useMemo(
    () => rows.filter((row) => statusMatches(row, status) && queryMatches(row, query)),
    [rows, status, query],
  );

  if (!catalogueLoaded) {
    return (
      <div className="mt-4">
        <AdminEmptyState
          title="Vehicle catalogue unavailable"
          description="The fitment catalogue could not be read, so no vehicle image inventory is shown. This is a connection problem, not an empty catalogue."
        />
      </div>
    );
  }

  return (
    <>
      {/* ------------------------------------------------- 1. model images */}
      <section aria-label="Vehicle model images" className="mt-6">
        <AdminSection
          eyebrow="Section 1"
          title="Vehicle model images"
          description="One image per fitment model, resolved from the committed file in public/images/vehicles/models. Each model has its own file; none is shared with an unrelated model."
        />

        <div className="mt-3">
          <AdminFilterBar>
            <AdminSearch
              value={query}
              onChange={setQuery}
              label="Search vehicles"
              placeholder="Hyundai, Swift, tata-ace…"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatus(option.id)}
                  aria-pressed={status === option.id}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40 ${
                    status === option.id
                      ? "bg-[#7a1233] text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </AdminFilterBar>
        </div>

        {visible.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyState
              title="No vehicle matches that filter"
              description="Clear the search or status filter to see the whole catalogue."
              icon={<IconSearch className="h-5 w-5" />}
              action={
                <AdminActionButton
                  tone="secondary"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </AdminActionButton>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <li key={`${row.makeSlug}-${row.modelSlug}`} className={`${panelClass} p-4`}>
                <div className="flex gap-3">
                  <div className="shrink-0">
                    <ModelThumb row={row} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-zinc-900">
                      {row.make} {row.model}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {row.partCount} compatible{" "}
                      {row.partCount === 1 ? "part" : "parts"}
                    </p>
                    <p className="mt-1.5 break-all font-mono text-[11px] text-zinc-600">
                      {row.filename ?? "no file"}
                    </p>
                    <div className="mt-2">
                      <AdminStatusBadge tone={IMAGE_STATUS_TONE[row.status]}>
                        {IMAGE_STATUS_LABEL[row.status]}
                      </AdminStatusBadge>
                    </div>
                  </div>
                </div>

                {row.pendingReason ? (
                  <p className="mt-3 text-[11px] leading-snug text-zinc-500">
                    {row.pendingReason}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminActionButton
                    tone="secondary"
                    icon={<IconExternal className="h-4 w-4" />}
                    onClick={() => setPreview(row)}
                  >
                    Preview
                  </AdminActionButton>
                  <AdminActionButton
                    tone="secondary"
                    icon={<IconUpload className="h-4 w-4" />}
                    disabled
                    title="Disabled: vehicle images are committed build files, not runtime uploads. See the Preview dialog for the supported replacement route."
                  >
                    Replace
                  </AdminActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------ 2. hero vehicle classes */}
      <section aria-label="Hero vehicle class images" className="mt-8">
        <AdminSection
          eyebrow="Section 2"
          title="Hero vehicle class images"
          description="The vehicle classes the homepage hero marks as click targets. These are marketing classes, not fitment models, and they are deliberately kept out of the compatibility data."
        />

        <div className={`mt-3 ${panelClass} p-4`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <div
                className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50"
                style={{ height: 96 }}
              >
                <Image
                  src={HERO_ARTWORK_PATH}
                  alt="The single composited homepage hero artwork containing every hero vehicle class"
                  width={168}
                  height={96}
                  className="h-full w-auto object-contain"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">
                One artwork holds every class
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                {HERO_CLASS_IMAGE_NOTE}
              </p>
            </div>
          </div>
        </div>

        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {HERO_VEHICLE_CLASSES.map((item) => (
            <li key={item.id} className={`${panelClass} p-4`}>
              <p className="text-sm font-bold leading-tight text-zinc-900">{item.label}</p>
              <p className="mt-1 text-xs leading-snug text-zinc-500">{item.note}</p>
              <div className="mt-2.5">
                <AdminStatusBadge tone="info">No class image</AdminStatusBadge>
              </div>
              <div className="mt-3">
                <AdminActionButton
                  tone="secondary"
                  icon={<IconExternal className="h-4 w-4" />}
                  onClick={() => {
                    window.open(HERO_ARTWORK_PATH, "_blank", "noopener,noreferrer");
                  }}
                >
                  View hero artwork
                </AdminActionButton>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------- how to replace, safely */}
      <section aria-label="How to change a vehicle image" className="mt-8">
        <AdminSection
          eyebrow="Sanctioned route"
          title="How to change a vehicle image"
          description="Vehicle images are committed build files. This is the supported path, and it is a deliberate choice rather than a missing feature."
        />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ol className="space-y-2.5 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <span className="font-semibold text-zinc-900">1.</span>
              <span>
                Edit the entry in{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">
                  data/vehicle-fitment-image-sources.json
                </code>
                . That file is the source of truth for every vehicle image and its licence.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-semibold text-zinc-900">2.</span>
              <span>
                Run{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">
                  {IMAGE_PIPELINE_SCRIPT}
                </code>
                . It trims the background, standardises the cutout and writes the{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">SOURCES.txt</code>{" "}
                licence record.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-semibold text-zinc-900">3.</span>
              <span>
                Commit the regenerated file in{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px]">
                  {MODEL_IMAGE_DIRECTORY}
                </code>
                . Filenames are derived from the make and model slugs, so they are
                predictable and must not be renamed by hand.
              </span>
            </li>
          </ol>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
            Every model image is a Creative Commons or public-domain file with a recorded author
            and licence, because manufacturer press photography carries no republication licence.
            An admin upload would bypass that provenance, so this screen does not offer one.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ preview */}
      <AdminDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? `${preview.make} ${preview.model}` : ""}
        description={preview?.filename ?? undefined}
        width="max-w-2xl"
      >
        {preview ? (
          <div className="space-y-4">
            {preview.photo ? (
              <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <Image
                  src={preview.photo}
                  alt={`${preview.make} ${preview.model}`}
                  width={420}
                  height={300}
                  className="h-auto w-full max-w-[420px] object-contain"
                />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                This model has no image file. The storefront renders a branded placeholder
                carrying its own name rather than another vehicle&apos;s picture.
              </p>
            )}

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Public path
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-zinc-700">
                  {preview.photo ?? "none"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Status
                </dt>
                <dd className="mt-1">
                  <AdminStatusBadge tone={IMAGE_STATUS_TONE[preview.status]}>
                    {IMAGE_STATUS_LABEL[preview.status]}
                  </AdminStatusBadge>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Compatible parts
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
                  {preview.partCount}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  Source file
                </dt>
                <dd className="mt-1 break-words text-xs text-zinc-700">
                  {preview.commonsTitle ?? "Not recorded in the manifest"}
                </dd>
              </div>
            </dl>

            {preview.pendingReason ? (
              <p className="rounded-xl bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
                {preview.pendingReason}
              </p>
            ) : null}

            <p className="border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
              Replace is disabled here on purpose. Vehicle images are committed files under{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5">{MODEL_IMAGE_DIRECTORY}</code>,
              and that folder is served at build time, so a runtime upload would not reach
              customers. Use the manifest and the image pipeline instead.
            </p>
          </div>
        ) : null}
      </AdminDialog>
    </>
  );
}
