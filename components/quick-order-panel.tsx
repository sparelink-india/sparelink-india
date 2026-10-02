"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useI18n } from "@/components/preferences-provider";

type QuickRow = { id: string; partNumber: string; qty: number };

function newRow(id: string): QuickRow {
  return { id, partNumber: "", qty: 1 };
}

/**
 * Frontend Quick Order using existing /api/search/parts + /api/cart.
 * Resolves each part number to the first active priced listing, then adds qty.
 */
export function QuickOrderPanel({
  onCartChange,
}: {
  onCartChange?: (delta: number) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const nextRowId = useRef(4);
  const createRow = () => newRow(`row-${nextRowId.current++}`);
  const [rows, setRows] = useState<QuickRow[]>(() => [newRow("row-1"), newRow("row-2"), newRow("row-3")]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateRow(id: string, patch: Partial<QuickRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function resolveListingId(partNumber: string): Promise<{ listingId: string; name: string } | null> {
    const response = await fetch(
      `/api/search/parts?q=${encodeURIComponent(partNumber)}&page=1&perPage=8`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data.results)) return null;

    const needle = partNumber.trim().toLowerCase();
    const ranked = [...data.results].sort((a, b) => {
      const aNo = String(a?.document?.part_number || "").toLowerCase();
      const bNo = String(b?.document?.part_number || "").toLowerCase();
      const aExact = aNo === needle ? 0 : aNo.includes(needle) ? 1 : 2;
      const bExact = bNo === needle ? 0 : bNo.includes(needle) ? 1 : 2;
      return aExact - bExact;
    });

    for (const hit of ranked) {
      const listings = Array.isArray(hit.listings) ? hit.listings : [];
      const listing = listings.find(
        (row: { status?: string; stock?: number | null; pricePaise?: number }) =>
          row.status === "active" && row.stock !== null && row.stock !== undefined && row.stock > 0 && (row.pricePaise ?? 0) > 0,
      );
      if (listing?.id) {
        return {
          listingId: String(listing.id),
          name: String(hit?.document?.name || partNumber),
        };
      }
    }
    return null;
  }

  async function addAll() {
    const pending = rows
      .map((row) => ({
        partNumber: row.partNumber.trim(),
        qty: Number.isFinite(row.qty) && row.qty > 0 ? Math.floor(row.qty) : 0,
      }))
      .filter((row) => row.partNumber && row.qty > 0);

    if (pending.length === 0) {
      setError(t("quickOrder.empty"));
      setMessage("");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    let added = 0;
    const failures: string[] = [];

    try {
      for (const row of pending) {
        const resolved = await resolveListingId(row.partNumber);
        if (!resolved) {
          failures.push(row.partNumber);
          continue;
        }
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealerListingId: resolved.listingId,
            quantity: row.qty,
          }),
        });
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          failures.push(row.partNumber);
          continue;
        }
        added += row.qty;
        onCartChange?.(row.qty);
      }

      if (added > 0) {
        setMessage(t("quickOrder.added", { count: added }));
        setRows([newRow(`row-${nextRowId.current++}`), newRow(`row-${nextRowId.current++}`), newRow(`row-${nextRowId.current++}`)]);
      }
      if (failures.length > 0) {
        setError(t("quickOrder.failedParts", { parts: failures.join(", ") }));
      }
    } catch {
      setError(t("quickOrder.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="quick-order-heading"
      className="rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-3 sm:p-4"
    >
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--v3-brand-ink)]">
            {t("quickOrder.kicker")}
          </p>
          <h2 id="quick-order-heading" className="text-base font-bold text-[var(--v3-text)]">
            {t("quickOrder.title")}
          </h2>
        </div>
        <button
          type="button"
          className="min-h-10 rounded-[var(--v3-r)] border border-[var(--v3-rule)] px-3 text-xs font-semibold text-[var(--v3-text-2)]"
          onClick={() => setRows((prev) => [...prev, createRow()])}
        >
          {t("quickOrder.addRow")}
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--v3-text-3)]">{t("quickOrder.hint")}</p>

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--v3-text-3)]">
          <span>{t("quickOrder.partNumber")}</span>
          <span>{t("quickOrder.qty")}</span>
          <span className="sr-only">{t("quickOrder.removeRow")}</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.25rem] gap-2">
            <label className="sr-only" htmlFor={`qo-pn-${row.id}`}>
              {t("quickOrder.partNumber")}
            </label>
            <input
              id={`qo-pn-${row.id}`}
              value={row.partNumber}
              onChange={(e) => updateRow(row.id, { partNumber: e.target.value })}
              placeholder="M-648"
              autoComplete="off"
              className="min-h-11 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-3 font-mono text-sm outline-none focus:border-[var(--v3-brand)] bg-[var(--v3-panel)] focus:ring-[var(--v3-brand)]/20"
            />
            <label className="sr-only" htmlFor={`qo-qty-${row.id}`}>
              {t("quickOrder.qty")}
            </label>
            <input
              id={`qo-qty-${row.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={row.qty}
              onChange={(e) =>
                updateRow(row.id, { qty: Math.max(1, Number(e.target.value) || 1) })
              }
              className="min-h-11 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-sunk)] px-2 text-center text-sm outline-none focus:border-[var(--v3-brand)] bg-[var(--v3-panel)] focus:ring-[var(--v3-brand)]/20"
            />
            <button
              type="button"
              aria-label={t("quickOrder.removeRow")}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--v3-r)] border border-[var(--v3-rule)] text-[var(--v3-text-3)]"
              onClick={() =>
                setRows((prev) => (prev.length <= 1 ? [createRow()] : prev.filter((r) => r.id !== row.id)))
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-[var(--v3-bad)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-xs font-medium text-[var(--v3-ok)]">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void addAll()}
        className="btn-press mt-3 flex min-h-12 w-full items-center justify-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] text-sm font-bold text-white disabled:opacity-60"
      >
        {busy ? t("quickOrder.adding") : t("quickOrder.addAll")}
      </button>
    </section>
  );
}
