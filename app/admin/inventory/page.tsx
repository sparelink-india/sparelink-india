"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminDataTable, type AdminColumn } from "@/components/admin-data-table";
import { FeatureIcon } from "@/components/admin-feature-icon";
import {
  IconAlert,
  IconInventory,
  IconLowStock,
  IconPackage,
  IconSliders,
  IconWarehouse,
} from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminDialog,
  AdminError,
  AdminFeatureCard,
  AdminField,
  AdminFilterBar,
  AdminFilterChips,
  AdminInlineLink,
  AdminInput,
  AdminNotice,
  AdminSearch,
  AdminSection,
  AdminStat,
  AdminStatusBadge,
  panelClass,
} from "@/components/admin-ui";
import {
  INVENTORY_FILTERS,
  INVENTORY_FILTER_LABELS,
  INVENTORY_SORTS,
  INVENTORY_SORT_LABELS,
  describeAdjustment,
  filterInventory,
  hasActiveInventoryFilters,
  inventoryDealer,
  inventoryEmptyMessage,
  inventoryErrorMessage,
  inventoryPart,
  stockBand,
  summariseInventory,
  validateAdjustmentQuantity,
  validateAdjustmentReason,
  type AdminInventoryRow,
  type InventoryFilter,
  type InventorySort,
} from "@/lib/admin-inventory-dashboard";
import {
  LOW_STOCK_THRESHOLD,
  formatCount,
  formatInr,
  formatRelativeTime,
} from "@/lib/admin-dashboard";

const FILTER_OPTIONS = INVENTORY_FILTERS.map((id) => ({
  id,
  label: INVENTORY_FILTER_LABELS[id],
}));

const SORT_OPTIONS = INVENTORY_SORTS.map((id) => ({
  id,
  label: INVENTORY_SORT_LABELS[id],
}));

type Adjustment = {
  row: AdminInventoryRow;
  quantity: string;
  reason: string;
};

export default function InventoryPage() {
  const [rows, setRows] = useState<AdminInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [sort, setSort] = useState<InventorySort>("stock");

  const [adjust, setAdjust] = useState<Adjustment | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: string; reason?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/inventory", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      setRows(Array.isArray(data?.inventory) ? data.inventory : []);
    } catch (cause) {
      setLoadError(inventoryErrorMessage(cause, "Unable to load inventory."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summariseInventory(rows), [rows]);
  const visible = useMemo(
    () => filterInventory(rows, { query, filter, sort }),
    [rows, query, filter, sort],
  );
  const filtered = hasActiveInventoryFilters({ query, filter });
  const empty = inventoryEmptyMessage({
    loading,
    hasData: rows.length > 0,
    filtered,
  });

  function openAdjustment(row: AdminInventoryRow) {
    setSaveError("");
    setFieldErrors({});
    setAdjust({ row, quantity: String(row.quantity), reason: "" });
  }

  function closeAdjustment() {
    if (saving) return;
    setAdjust(null);
    setFieldErrors({});
  }

  async function saveAdjustment() {
    if (!adjust || saving) return;

    const quantityError = validateAdjustmentQuantity(adjust.quantity);
    const reasonError = validateAdjustmentReason(adjust.reason);
    setFieldErrors({
      ...(quantityError ? { quantity: quantityError } : {}),
      ...(reasonError ? { reason: reasonError } : {}),
    });
    if (quantityError || reasonError) return;

    setSaving(true);
    setSaveError("");
    setNotice("");
    const target = adjust;
    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId: target.row.id,
          quantity: Number(target.quantity.trim()),
          reason: target.reason.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "The adjustment was rejected.");
      }
      setNotice(
        describeAdjustment({
          partName: target.row.partName,
          quantity: Number(data?.quantity ?? target.quantity),
          delta: Number(data?.delta ?? 0),
        }),
      );
      setAdjust(null);
      setFieldErrors({});
      await load();
    } catch (cause) {
      setSaveError(inventoryErrorMessage(cause, "The adjustment could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const columns: ReadonlyArray<AdminColumn<AdminInventoryRow>> = useMemo(
    () => [
      {
        key: "part",
        header: "Part",
        cell: (row) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{inventoryPart(row)}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Updated {formatRelativeTime(row.lastUpdated, new Date())}
            </p>
          </div>
        ),
      },
      {
        key: "dealer",
        header: "Dealer",
        hideBelow: "md",
        cell: (row) => <span className="text-xs text-zinc-700">{inventoryDealer(row)}</span>,
      },
      {
        key: "quantity",
        header: "Stock",
        numeric: true,
        className: "whitespace-nowrap",
        cell: (row) => {
          const band = stockBand(row.quantity);
          return (
            <AdminStatusBadge tone={band.band === "out" ? "critical" : band.band === "low" ? "warn" : "good"}>
              <span title={band.label}>{formatCount(row.quantity)}</span>
            </AdminStatusBadge>
          );
        },
      },
      {
        key: "price",
        header: "Price",
        numeric: true,
        hideBelow: "lg",
        className: "whitespace-nowrap",
        cell: (row) => (
          <span className="text-xs font-semibold tabular-nums text-zinc-800">
            {formatInr(row.price)}
          </span>
        ),
      },
      {
        key: "updated",
        header: "Last updated",
        hideBelow: "xl",
        cell: (row) => (
          <span className="whitespace-nowrap text-[11px] text-zinc-500">
            {formatRelativeTime(row.lastUpdated, new Date())}
          </span>
        ),
      },
      {
        key: "action",
        header: "",
        className: "text-right",
        cell: (row) => (
          <AdminActionButton
            onClick={() => openAdjustment(row)}
            icon={<IconSliders className="h-3.5 w-3.5" />}
            aria-label={`Adjust stock for ${inventoryPart(row)}`}
          >
            Adjust
          </AdminActionButton>
        ),
      },
    ],
    [],
  );

  return (
    <AdminShell
      title="Inventory"
      subtitle="Live stock levels, low stock and recorded adjustments"
      activeHref="/admin/inventory"
    >
      {/* ------------------------------------------------------------- summary */}
      <section aria-label="Stock summary">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat
            label="Stock listings"
            value={formatCount(summary.totalRows)}
            hint={`${formatCount(summary.totalUnits)} units on hand across ${formatCount(summary.dealers)} dealers`}
            tone="brand"
            icon={<IconInventory className="h-5 w-5" />}
          />
          <AdminStat
            label="In stock"
            value={formatCount(summary.healthy)}
            hint="Above the low-stock threshold"
            tone="good"
            icon={<IconPackage className="h-5 w-5" />}
          />
          <AdminStat
            label={`Low stock · ≤ ${LOW_STOCK_THRESHOLD}`}
            value={formatCount(summary.low)}
            hint="At or below the low-stock threshold"
            tone={summary.low > 0 ? "warn" : "neutral"}
            icon={<IconLowStock className="h-5 w-5" />}
          />
          <AdminStat
            label="Out of stock"
            value={formatCount(summary.out)}
            hint="No units remaining"
            tone={summary.out > 0 ? "critical" : "neutral"}
            icon={<IconAlert className="h-5 w-5" />}
          />
        </div>
      </section>

      {loadError && (
        <div className="mt-4">
          <AdminError message={loadError} onRetry={() => void load()} />
        </div>
      )}

      {!loadError && notice && (
        <div className="mt-4">
          <AdminNotice message={notice} />
        </div>
      )}

      {/* ------------------------------------------------------------- filters */}
      <div className="mt-5">
        <AdminFilterBar>
          <AdminSearch
            value={query}
            onChange={setQuery}
            label="Search inventory"
            placeholder="Part name, dealer, quantity…"
            className="min-w-[14rem] flex-1"
          />
          <AdminFilterChips
            label="Filter inventory by stock level"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(id) => setFilter(id as InventoryFilter)}
          />
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="inventory-sort"
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500"
            >
              Sort
            </label>
            <select
              id="inventory-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as InventorySort)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 outline-none transition-colors focus:border-[#7a1233] focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </AdminFilterBar>
      </div>

      {/* --------------------------------------------------------------- table */}
      <section aria-label="Stock levels" className="mt-4">
        <AdminSection
          eyebrow="Stock"
          title="Inventory levels"
          description={
            filtered
              ? `${formatCount(visible.length)} of ${formatCount(rows.length)} listings match.`
              : undefined
          }
          action={
            <div className="flex items-center gap-3">
              <AdminInlineLink href="/admin/stock-adjustments">
                Adjustment ledger
              </AdminInlineLink>
              <AdminInlineLink href="/admin/warehouses">Warehouses</AdminInlineLink>
            </div>
          }
        />
        <AdminDataTable
          rows={visible}
          columns={columns}
          rowKey={(row) => row.id}
          caption="Live inventory levels by listing with an adjustment action"
          loading={loading}
          minWidthClass="min-w-[50rem]"
          emptyTitle={empty.title}
          emptyDescription={empty.description}
          emptyIcon={<IconInventory className="h-5 w-5" />}
          emptyAction={
            filtered ? (
              <AdminActionButton
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </AdminActionButton>
            ) : undefined
          }
          footer={
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Showing {formatCount(visible.length)} of {formatCount(rows.length)} listings
              </span>
              <span>Low stock is {LOW_STOCK_THRESHOLD} units or fewer</span>
            </span>
          }
          mobileCard={(row) => {
            const band = stockBand(row.quantity);
            return (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-bold leading-tight text-zinc-900">
                    {inventoryPart(row)}
                  </p>
                  <AdminStatusBadge
                    tone={band.band === "out" ? "critical" : band.band === "low" ? "warn" : "good"}
                  >
                    {formatCount(row.quantity)} units
                  </AdminStatusBadge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-zinc-400">Dealer</dt>
                    <dd className="text-zinc-700">{inventoryDealer(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Price</dt>
                    <dd className="tabular-nums text-zinc-700">{formatInr(row.price)}</dd>
                  </div>
                </dl>
                <AdminActionButton onClick={() => openAdjustment(row)} className="w-full">
                  Adjust stock
                </AdminActionButton>
              </div>
            );
          }}
        />
      </section>

      {/* ------------------------------------------------------------- actions */}
      <section aria-label="Related workspaces" className="mt-6">
        <AdminSection
          eyebrow="Continue"
          title="Inventory workspaces"
          description="Where stock is recorded, received and audited."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminFeatureCard
            href="/admin/stock-adjustments"
            title="Stock adjustments"
            description="Every recorded movement, with previous and new quantity"
            icon={<IconSliders className="h-[22px] w-[22px]" />}
          />
          <AdminFeatureCard
            href="/admin/goods-receipts"
            title="Goods receipts"
            description="Receive supplier stock against a purchase order"
            icon={<FeatureIcon id="goods-receipts" className="h-[22px] w-[22px]" />}
          />
          <AdminFeatureCard
            href="/admin/warehouses"
            title="Warehouses"
            description="Fulfilment locations and their codes"
            icon={<IconWarehouse className="h-[22px] w-[22px]" />}
          />
          <AdminFeatureCard
            href="/admin/allocations"
            title="Allocations"
            description="How order lines are split across firms"
            icon={<FeatureIcon id="allocations" className="h-[22px] w-[22px]" />}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- adjustment */}
      <AdminDialog
        open={adjust !== null}
        onClose={closeAdjustment}
        title="Adjust stock"
        description={
          adjust
            ? `Set the absolute quantity for ${inventoryPart(adjust.row)} at ${inventoryDealer(adjust.row)}.`
            : undefined
        }
        footer={
          <>
            <AdminActionButton onClick={closeAdjustment} disabled={saving}>
              Cancel
            </AdminActionButton>
            <AdminActionButton
              tone="primary"
              onClick={() => void saveAdjustment()}
              disabled={saving}
              style={{ backgroundColor: "#0f172a" }}
            >
              {saving ? "Saving…" : "Save adjustment"}
            </AdminActionButton>
          </>
        }
      >
        {adjust && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAdjustment();
            }}
          >
            {saveError && <AdminError message={saveError} />}

            <div className={`rounded-xl border border-zinc-200 bg-zinc-50 p-3 ${panelClass}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                Current stock
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
                {formatCount(adjust.row.quantity)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Last updated {formatRelativeTime(adjust.row.lastUpdated, new Date())}
              </p>
            </div>

            <AdminField
              label="New quantity"
              htmlFor="adjust-quantity"
              hint="Whole units only. This sets the absolute level, not an increment."
              error={fieldErrors.quantity}
            >
              <AdminInput
                id="adjust-quantity"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={adjust.quantity}
                invalid={Boolean(fieldErrors.quantity)}
                onChange={(event) =>
                  setAdjust({ ...adjust, quantity: event.target.value })
                }
              />
            </AdminField>

            <AdminField
              label="Reason"
              htmlFor="adjust-reason"
              hint="Recorded in the stock ledger and the audit trail."
              error={fieldErrors.reason}
            >
              <AdminInput
                id="adjust-reason"
                type="text"
                value={adjust.reason}
                invalid={Boolean(fieldErrors.reason)}
                placeholder="Stock count correction"
                onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })}
              />
            </AdminField>

            <button type="submit" className="sr-only">
              Save adjustment
            </button>
          </form>
        )}
      </AdminDialog>
    </AdminShell>
  );
}
