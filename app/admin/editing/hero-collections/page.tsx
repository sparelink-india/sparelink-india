"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAlert, IconCheck, IconSearch, IconStack } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminConfirmDialog,
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
import {
  HERO_COLLECTION_SLOTS,
  HERO_SLOT_META,
  HERO_BULK_CONFIRM_THRESHOLD,
  type HeroCollectionSlot,
} from "@/lib/hero-collections";

/**
 * Hero Vehicle Collections, browser half.
 *
 * A hero class is a marketing label on the hero artwork, not a vehicle. Curating
 * one says what that click shows; it says NOTHING about what a part fits, which
 * is what `part_vehicle_compatibility` is for. Nothing on this screen can reach
 * that table.
 *
 * Eight slots, not seven: Passenger Vehicle is drawn twice, on the red SUV and
 * the white saloon, and each hotspot needs its own shortlist.
 *
 * A slot with nothing curated falls back to /vehicle-fitment on the storefront.
 * That is why an empty slot is a normal state here, not an error: an admin who
 * has curated three of eight has done real work, and the other five cost the
 * click nothing.
 */

type SlotRow = {
  slot: HeroCollectionSlot;
  label: string;
  note: string;
  isEnabled: boolean;
  count: number;
};

type PendingMutation = {
  action: "add" | "remove";
  slot: HeroCollectionSlot;
  label: string;
  partIds: string[];
  scope: "ids" | "filtered";
  expectedCount: number | null;
  filters: { q: string; brand: string; categoryId: string };
};

export default function HeroCollectionsPage() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");

  const [selectedSlot, setSelectedSlot] = useState<HeroCollectionSlot | null>(null);
  const [collected, setCollected] = useState<string[]>([]);
  const [collectedLoading, setCollectedLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingMutation | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/hero-collections", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoadError(data.error || "The collections could not be loaded.");
        return;
      }
      setSlots(data.slots ?? []);
    } catch {
      setLoadError("The collections could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCollected = useCallback(async (slot: HeroCollectionSlot) => {
    setCollectedLoading(true);
    try {
      const response = await fetch(`/api/admin/hero-collections/${slot}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCollected([]);
        return;
      }
      setCollected(data.partIds ?? []);
    } catch {
      setCollected([]);
    } finally {
      setCollectedLoading(false);
    }
  }, []);

  /* Deferred by a tick, matching the vehicle compatibility page. The effect is
     here to fetch once on mount, not to synchronise with an external system, and
     deferring keeps the setState off the synchronous render pass. */
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSlots();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadSlots]);

  /* The slot's contents load when a slot is CHOSEN, not in an effect watching
     the selection. Deriving the fetch from the click keeps it off the render
     path: an effect that calls setState synchronously re-renders before it
     paints, and this page has nothing to synchronise with an external system. */
  function chooseSlot(slot: HeroCollectionSlot | null) {
    setSelectedSlot(slot);
    setNotice("");
    setMutationError("");
    if (slot) void loadCollected(slot);
    else setCollected([]);
  }

  const active = useMemo(() => slots.find((s) => s.slot === selectedSlot) ?? null, [slots, selectedSlot]);
  const curatedTotal = useMemo(() => slots.reduce((sum, s) => sum + s.count, 0), [slots]);
  const liveSlots = useMemo(() => slots.filter((s) => s.isEnabled && s.count > 0).length, [slots]);

  function requestAdd() {
    if (!selectedSlot) return;
    setNotice("");
    setMutationError("");
    setPending({
      action: "add",
      slot: selectedSlot,
      label: active?.label ?? selectedSlot,
      partIds: [],
      scope: "filtered",
      expectedCount: null,
      filters: { q: query.trim(), brand: "", categoryId: "" },
    });
  }

  async function runMutation() {
    const action = pending;
    if (!action || busy) return;
    setPending(null);
    setBusy(true);
    setNotice("");
    setMutationError("");
    try {
      const response = await fetch(`/api/admin/hero-collections/${action.slot}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action.action,
          scope: action.scope,
          partIds: action.partIds,
          expectedCount: action.expectedCount,
          confirmCount: action.expectedCount,
          filters: action.filters,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(data.error || "The change could not be saved.");
        return;
      }
      setNotice(data.message ?? "Saved.");
      await Promise.all([loadSlots(), loadCollected(action.slot)]);
    } catch {
      setMutationError("The change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(slot: HeroCollectionSlot, isEnabled: boolean) {
    setNotice("");
    setMutationError("");
    try {
      const response = await fetch(`/api/admin/hero-collections/${slot}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMutationError(data.error || "The slot could not be updated.");
        return;
      }
      setNotice(`${data.slot} is now ${isEnabled ? "live" : "hidden from the hero"}.`);
      await loadSlots();
    } catch {
      setMutationError("The slot could not be updated.");
    }
  }

  return (
    <AdminShell
      title="Hero Vehicle Collections"
      subtitle="Curated product sets behind the homepage hero hotspots"
      activeHref="/admin/editing"
    >
      {loadError ? <AdminError message={loadError} /> : null}
      {mutationError ? <AdminError message={mutationError} /> : null}
      {notice ? <AdminNotice message={notice} /> : null}

      <div className="mt-4">
        <AdminStat label="Slots" value={String(HERO_COLLECTION_SLOTS.length)} tone="neutral" />
        <AdminStat label="Curated products" value={String(curatedTotal)} tone="brand" />
        <AdminStat label="Live slots" value={String(liveSlots)} tone="good" />
      </div>

      <AdminSection
        eyebrow="Separated by design"
        title="These are not vehicle fitments"
        description="A hero class is a label on the hero artwork. Curating one decides what that hotspot shows and nothing else; what a part fits lives in part_vehicle_compatibility and is never written from this screen."
      />

      <AdminSection
        eyebrow="Curated sets"
        title="Hero vehicle classes"
        description="Eight slots. Passenger Vehicle is drawn twice, on the red SUV and the white saloon, and each hotspot has its own shortlist."
      />

      {loading ? (
        <div className="mt-3 h-24 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {HERO_SLOT_META.map((meta) => {
            const row = slots.find((s) => s.slot === meta.slot);
            const count = row?.count ?? 0;
            const enabled = row?.isEnabled ?? false;
            const chosen = selectedSlot === meta.slot;
            return (
              <li key={meta.slot} className={`${panelClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight text-zinc-900">{meta.label}</p>
                    <p className="mt-1 text-xs leading-snug text-zinc-500">{meta.note}</p>
                  </div>
                  <AdminStatusBadge tone={enabled && count > 0 ? "good" : "neutral"}>
                    {count > 0 ? `${count} curated` : "Falls back to fitment"}
                  </AdminStatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AdminActionButton
                    tone={chosen ? "primary" : "secondary"}
                    icon={<IconStack className="h-4 w-4" />}
                    onClick={() => chooseSlot(chosen ? null : meta.slot)}
                  >
                    {chosen ? "Close" : "Curate"}
                  </AdminActionButton>
                  {count > 0 ? <AdminInlineLink href={`/hero/${meta.slot}`}>View storefront</AdminInlineLink> : null}
                  <AdminActionButton
                    tone="ghost"
                    onClick={() => void toggleEnabled(meta.slot, !enabled)}
                  >
                    {enabled ? "Hide" : "Show"}
                  </AdminActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selectedSlot ? (
        <section aria-label="Curate the selected slot" className="mt-8">
          <AdminSection
            eyebrow="Selected slot"
            title={active?.label ?? selectedSlot}
            description="Search the catalogue and add the products this hotspot should show. Removing a product never touches vehicle compatibility."
          />

          <div className={`mt-3 ${panelClass} p-4`}>
            <AdminFilterBar>
              <AdminSearch
                label="Search products"
                value={query}
                onChange={setQuery}
                placeholder="Part number or name…"
              />
              <AdminActionButton
                tone="primary"
                icon={<IconSearch className="h-4 w-4" />}
                onClick={requestAdd}
                disabled={!query.trim()}
              >
                Add matching products
              </AdminActionButton>
            </AdminFilterBar>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              The filter is resolved on the server, so a large catalogue is never
              shipped from the browser. A bulk add asks you to confirm the count.
            </p>
          </div>

          <div className="mt-3">
            {collectedLoading ? (
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" aria-hidden />
            ) : collected.length === 0 ? (
              <AdminEmptyState
                title="This slot is empty"
                description="Add products above. Until then the hotspot falls back to the vehicle fitment browser, so nothing on the homepage is broken."
                icon={<IconStack className="h-5 w-5" />}
              />
            ) : (
              <ul className="grid gap-2">
                {collected.map((partId) => (
                  <li
                    key={partId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2"
                  >
                    <span className="truncate text-sm text-zinc-800">{partId}</span>
                    <AdminActionButton
                      tone="ghost"
                      onClick={() =>
                        setPending({
                          action: "remove",
                          slot: selectedSlot,
                          label: active?.label ?? selectedSlot,
                          partIds: [partId],
                          scope: "ids",
                          expectedCount: null,
                          filters: { q: "", brand: "", categoryId: "" },
                        })
                      }
                    >
                      Remove
                    </AdminActionButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <section aria-label="How hero collections reach the storefront" className="mt-8">
        <AdminSection
          eyebrow="How this reaches the homepage"
          title="A slot with a curated set gets its own page"
          description="An enabled, non-empty slot links to /hero/<slot>. Everything else links to /vehicle-fitment, so a curation mistake costs the click, not the data."
        />
        <div className={`mt-3 ${panelClass} p-5`}>
          <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>Hiding a slot is reversible and deletes nothing.</span>
            </li>
            <li className="flex gap-2.5">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                A bulk add of {HERO_BULK_CONFIRM_THRESHOLD} products or more has to
                echo its count back, so a dialog opened against an old result set
                cannot commit a new one.
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Nothing here writes to vehicle compatibility. A curated
                shortlist is a merchandising decision, not a fitment claim.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <AdminConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void runMutation()}
        title={pending?.action === "add" ? "Add products to this slot?" : "Remove this product?"}
        description={
          pending
            ? [
                pending.label + ".",
                pending.action === "add"
                  ? "Every product matching the filter is added, resolved on the server."
                  : "This removes the product from the curated set only.",
                "Vehicle compatibility is not affected.",
              ].join(" ")
            : ""
        }
        confirmLabel={pending?.action === "add" ? "Add" : "Remove"}
        tone={pending?.action === "add" ? "primary" : "danger"}
        busy={busy}
      />
    </AdminShell>
  );
}
