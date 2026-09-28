"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconAlert, IconBoxes, IconList, IconSearch, IconStack, IconTruck } from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminConfirmDialog,
  AdminDialog,
  AdminEmptyState,
  AdminError,
  AdminFilterBar,
  AdminInlineLink,
  AdminNotice,
  AdminSearch,
  AdminSection,
  AdminSelect,
  AdminStat,
  AdminStatusBadge,
  panelClass,
} from "@/components/admin-ui";
import {
  COMPATIBILITY_FILTER_LABELS,
  COMPATIBILITY_FILTERS,
  COMPATIBILITY_STATUS_LABEL,
  EMPTY_PRODUCT_FILTERS,
  PER_PAGE_MAX,
  filterVehicleOptions,
  hasActiveProductFilters,
  normaliseProductFilters,
  resolvePagination,
  rowCompatibilityStatus,
  resolveActionAvailability,
  summariseCompatibility,
  vehicleLinkLabel,
  vehicleOptionLabel,
  vehicleVariantLabel,
  type CompatProduct,
  type CompatibilityFilter,
  type Pagination,
  type ProductFilters,
  type VehicleOption,
} from "@/lib/admin-vehicle-compatibility";
import { BULK_CONFIRM_THRESHOLD } from "@/lib/admin-vehicle-compatibility-mutations";
import { formatCount } from "@/lib/admin-dashboard";

/**
 * /admin/editing/vehicle-compatibility
 *
 * READ-ONLY. Nothing on this screen writes, and there is no mutation control
 * anywhere in the file. The selection state exists so the eventual link/unlink
 * flow can be reviewed against real data; the buttons that would act on it are
 * rendered disabled and say why.
 *
 * WHY THE DATA COMES FROM TWO READS. The vehicle list is small (a dozen rows)
 * and drives the picker, so it loads once. The product grid is ~9,000 rows and
 * is server-paginated on every filter or page change, so the browser never
 * holds the catalogue.
 *
 * WHY LINK COUNT AND "SELECT ALL MATCHING" ARE SHOWN HONESTLY. The vehicle
 * picker carries the real link count from a grouped query, and the toolbar
 * states how many rows each selection scope covers. A control labelled "select
 * all" that quietly means "select the current page" is the failure mode this
 * screen is built to avoid.
 */

const FOCUS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40 focus-visible:ring-offset-1";

type Facets = {
  brands: string[];
  categories: Array<{ id: string; name: string }>;
};

type GridResponse = {
  products: CompatProduct[];
  pagination: Pagination;
  facets: Facets;
  vehicleId: string | null;
  catalogueTotal: number;
};

export default function VehicleCompatibilityPage() {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleError, setVehicleError] = useState("");
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  const [vehicleQuery, setVehicleQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [filters, setFilters] = useState<ProductFilters>(EMPTY_PRODUCT_FILTERS);
  const [page, setPage] = useState(1);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [gridError, setGridError] = useState("");
  const [gridLoading, setGridLoading] = useState(false);

  /* Review-only selection. Never sent anywhere. */
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<string>>(new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    setVehicleError("");
    try {
      const response = await fetch("/api/admin/vehicles", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load vehicles.");
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
    } catch (cause) {
      setVehicleError(cause instanceof Error ? cause.message : "Could not load vehicles.");
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadVehicles(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadVehicles]);

  const loadGrid = useCallback(async () => {
    setGridLoading(true);
    setGridError("");
    try {
      const query = new URLSearchParams();
      if (filters.q) query.set("q", filters.q);
      if (filters.brand) query.set("brand", filters.brand);
      if (filters.categoryId) query.set("categoryId", filters.categoryId);
      if (filters.status !== "all") query.set("status", filters.status);
      if (selectedId) query.set("vehicleId", selectedId);
      query.set("page", String(page));
      query.set("perPage", String(PER_PAGE_MAX));

      const response = await fetch(`/api/admin/products-paginated?${query.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load products.");
      setGrid(data);
    } catch (cause) {
      setGridError(cause instanceof Error ? cause.message : "Could not load products.");
      setGrid(null);
    } finally {
      setGridLoading(false);
    }
  }, [filters, selectedId, page]);

  useEffect(() => {
    /* No vehicle means no grid, and that is already the initial state, so there
       is nothing to reset here. Clearing it in the effect would be a
       synchronous setState and would cascade a render for no benefit. */
    if (!selectedId) return;
    const timeout = window.setTimeout(() => { void loadGrid(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadGrid, selectedId]);

  const selected = useMemo(
    () => vehicles.find((item) => item.id === selectedId) ?? null,
    [vehicles, selectedId],
  );
  const pickerResults = useMemo(
    () => filterVehicleOptions(vehicles, vehicleQuery),
    [vehicles, vehicleQuery],
  );
  /* Memoised so the identity is stable across renders; a bare `?? []` would
     hand `useMemo` a new array every pass and defeat both memos below. */
  const products = useMemo(() => grid?.products ?? [], [grid]);
  const pageSummary = useMemo(() => summariseCompatibility(products), [products]);
  const pagination = useMemo(
    () => grid?.pagination ?? resolvePagination({ page: 1, perPage: PER_PAGE_MAX, total: 0 }),
    [grid],
  );

  const totalCatalogue = grid?.catalogueTotal ?? 0;

  function chooseVehicle(option: VehicleOption) {
    setSelectedId(option.id);
    setPickerOpen(false);
    setVehicleQuery("");
    setPage(1);
    setFilters(EMPTY_PRODUCT_FILTERS);
    setSelectedRows(new Set());
    setAllMatchingSelected(false);
  }

  function updateFilter(patch: Partial<ProductFilters>) {
    setFilters((current) => normaliseProductFilters({ ...current, ...patch }));
    setPage(1);
    setSelectedRows(new Set());
    setAllMatchingSelected(false);
  }

  function toggleRow(id: string) {
    setAllMatchingSelected(false);
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = products.length > 0 && products.every((row) => selectedRows.has(row.id));
  const scopeCount = allMatchingSelected ? pagination.total : selectedRows.size;

  /* ---- mutation state ---- */
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [pendingAction, setPendingAction] = useState<"link" | "unlink" | null>(null);
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");

  /* Link is only meaningful for products that are not already linked, and
     unlink only for products that are. The active status filter narrows this
     further: a grid filtered to linked rows has nothing for Link to do. */
  const selectedProducts = useMemo(
    () => products.filter((row) => selectedRows.has(row.id)),
    [products, selectedRows],
  );
  const plans = useMemo(
    () =>
      resolveActionAvailability({
        status: filters.status,
        scopeIsFiltered: allMatchingSelected,
        scopeTotal: pagination.total,
        selectedProducts,
      }),
    [filters.status, allMatchingSelected, pagination.total, selectedProducts],
  );

  /* A filtered selection at or above this size is a bulk operation and the
     confirmation dialog says so. Mirrors BULK_CONFIRM_THRESHOLD on the server. */
  const isBulkScope = allMatchingSelected && pagination.total >= BULK_CONFIRM_THRESHOLD;

  function requestMutation(action: "link" | "unlink") {
    if (!selectedId || busy) return;
    setNotice("");
    setMutationError("");
    setPendingAction(action);
  }

  async function runMutation() {
    const action = pendingAction;
    if (!action || !selectedId || busy) return;

    setPendingAction(null);
    setBusy(action);
    setNotice("");
    setMutationError("");

    /* A filtered scope is resolved on the server from the filters the admin is
       looking at, with the count they just confirmed. The browser never ships
       thousands of ids. */
    const payload = allMatchingSelected
      ? {
          vehicleId: selectedId,
          scope: "filtered",
          expectedCount: pagination.total,
          /* Echoes the count for any scope at or above the bulk threshold. The
             server rejects a filtered mutation above that size unless this
             matches, so a bulk operation can never be committed by a dialog that
             was opened against a different result set. */
          confirmCount: pagination.total,
          filters: { ...filters },
        }
      : {
          vehicleId: selectedId,
          scope: "ids",
          /* Only the rows this action can actually change are submitted, so the
             label count and the payload agree. The server still re-checks every
             id, so this is a smaller request rather than a weaker guard. */
          partIds:
            action === "link"
              ? selectedProducts.filter((row) => !row.isLinked).map((row) => row.id)
              : selectedProducts.filter((row) => row.isLinked).map((row) => row.id),
        };

    try {
      const response = await fetch(`/api/admin/vehicle-compatibility/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMutationError(data.error || "The change could not be saved.");
        return;
      }

      setNotice(data.syncWarning ? `${data.message} ${data.syncWarning}` : data.message);

      /* Only the vehicles and the current filtered page are refetched. The rest
         of the admin is untouched. */
      await Promise.all([loadVehicles(), loadGrid()]);
      setSelectedRows(new Set());
      setAllMatchingSelected(false);
    } catch (cause) {
      setMutationError(
        cause instanceof Error ? cause.message : "The change could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell
      title="Vehicle Compatibility"
      subtitle="Link and unlink catalogue parts to each fitment vehicle"
    >
      <div className="mb-4">
        <AdminInlineLink href="/admin/editing">Back to Editing Studio</AdminInlineLink>
      </div>

      {/* -------------------------------------------------------- authority note */}
      <div className={`${panelClass} mb-4 border-sky-200 bg-sky-50 p-4`}>
        <div className="flex gap-2.5">
          <span className="mt-0.5 shrink-0 text-sky-700">
            <IconAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-sky-900">
              part_vehicle_compatibility is the authority
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-sky-800">
              Linking writes one row per product and vehicle. Hero vehicle classes and marketing
              collections are a separate system and are never touched from here. After a change is
              committed, the search index is updated for the affected products only; if that step
              fails the database change still stands and the failure is reported and logged.
            </p>
          </div>
        </div>
      </div>

      {vehicleError && (
        <div className="mb-4">
          <AdminError message={vehicleError} onRetry={() => void loadVehicles()} />
        </div>
      )}

      {/* -------------------------------------------------------------- summary */}
      <section aria-label="Compatibility summary">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat
            label="Selected vehicle"
            value={selected ? selected.model : "None"}
            hint={selected ? vehicleOptionLabel(selected) : "Choose a vehicle to begin"}
            tone="brand"
            icon={<IconTruck className="h-5 w-5" />}
          />
          <AdminStat
            label="Variant"
            value={selected ? vehicleVariantLabel(selected) : "—"}
            hint={selected ? "As stored on the vehicle record" : "No vehicle selected"}
            icon={<IconList className="h-5 w-5" />}
          />
          <AdminStat
            label="Linked products"
            value={selected ? formatCount(selected.linkCount) : "—"}
            hint={selected ? vehicleLinkLabel(selected.linkCount) : "Requires a vehicle"}
            tone={selected && selected.linkCount > 0 ? "good" : "neutral"}
            icon={<IconStack className="h-5 w-5" />}
          />
          <AdminStat
            label="Result count"
            value={selected ? formatCount(pagination.total) : "—"}
            hint={
              selected
                ? `${formatCount(pagination.total)} matching, of ${formatCount(totalCatalogue)} in the catalogue`
                : "Requires a vehicle"
            }
            icon={<IconBoxes className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* ------------------------------------------------------- vehicle picker */}
      <section aria-label="Vehicle selector" className="mt-6">
        <AdminSection
          eyebrow="Step 1"
          title="Choose a vehicle"
          description="Read from the live vehicle table. Each option shows its real compatibility link count."
        />
        <div className={`mt-3 ${panelClass} p-4`}>
          <AdminFilterBar>
            <AdminSearch
              value={vehicleQuery}
              onChange={setVehicleQuery}
              label="Search vehicles"
              placeholder="Swift, Creta, Tata…"
            />
            <AdminActionButton tone="secondary" onClick={() => setPickerOpen(true)}>
              {vehiclesLoading
                ? "Loading vehicles…"
                : selected
                  ? `Selected: ${vehicleOptionLabel(selected)}`
                  : "Select a vehicle"}
            </AdminActionButton>
          </AdminFilterBar>

          {selected ? (
            <p className="mt-3 text-xs text-zinc-600">
              {vehicleOptionLabel(selected)} · {vehicleVariantLabel(selected)} ·{" "}
              {vehicleLinkLabel(selected.linkCount)}
            </p>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              No vehicle selected. The grid is empty until one is chosen.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------- the grid */}
      {selected ? (
        <>
          <section aria-label="Product compatibility grid" className="mt-6">
            <AdminSection
              eyebrow="Step 2"
              title="Product compatibility"
              description="Server-paginated. A product is LINKED only when a real part_vehicle_compatibility row exists for this vehicle."
              action={
                <AdminInlineLink
                  href={`/api/admin/products-paginated?vehicleId=${encodeURIComponent(selectedId ?? "")}&status=${filters.status}&page=${page}&perPage=${PER_PAGE_MAX}`}
                >
                  Open this query as JSON
                </AdminInlineLink>
              }
            />

            <div className="mt-3">
              <AdminFilterBar>
                <AdminSearch
                  value={filters.q}
                  onChange={(value) => updateFilter({ q: value })}
                  label="Search products"
                  placeholder="Part number or name…"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="font-semibold">Brand</span>
                  <AdminSelect
                    value={filters.brand}
                    onChange={(event) => updateFilter({ brand: event.target.value })}
                    aria-label="Filter by brand"
                    className="h-8 rounded-lg border border-zinc-300 text-xs"
                  >
                    <option value="">All brands</option>
                    {(grid?.facets.brands ?? []).map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </AdminSelect>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="font-semibold">Category</span>
                  <AdminSelect
                    value={filters.categoryId}
                    onChange={(event) => updateFilter({ categoryId: event.target.value })}
                    aria-label="Filter by category"
                    className="h-8 rounded-lg border border-zinc-300 text-xs"
                  >
                    <option value="">All categories</option>
                    {(grid?.facets.categories ?? []).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </AdminSelect>
                </label>
              </AdminFilterBar>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {COMPATIBILITY_FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateFilter({ status: option as CompatibilityFilter })}
                  aria-pressed={filters.status === option}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${FOCUS} ${
                    filters.status === option
                      ? "bg-[#7a1233] text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {COMPATIBILITY_FILTER_LABELS[option]}
                </button>
              ))}

              <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true" />

              <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    setAllMatchingSelected(false);
                    setSelectedRows(
                      event.target.checked ? new Set(products.map((row) => row.id)) : new Set(),
                    );
                  }}
                  className="h-3.5 w-3.5 rounded border-zinc-300"
                />
                Select all visible ({products.length} on this page)
              </label>

              <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={allMatchingSelected}
                  onChange={(event) => {
                    setAllMatchingSelected(event.target.checked);
                    setSelectedRows(new Set());
                  }}
                  className="h-3.5 w-3.5 rounded border-zinc-300"
                />
                Select all matching results ({formatCount(pagination.total)} in the filtered set)
              </label>
            </div>

            {/* Selection scope and the two mutations. */}
            <div className={`mt-3 flex flex-wrap items-center gap-2 ${panelClass} p-3`}>
              <p className="text-xs text-zinc-600">
                Selection scope:{" "}
                <strong className="font-semibold text-zinc-900">
                  {formatCount(scopeCount)} {allMatchingSelected ? "matching results" : "specific products"}
                </strong>
                {allMatchingSelected ? (
                  <span className="ml-1.5 text-zinc-500">
                    (applied to the current filter on the server)
                  </span>
                ) : null}
              </p>
              <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true" />
              <AdminActionButton
                tone="primary"
                disabled={Boolean(busy) || !plans.link.enabled}
                title={plans.link.reason ?? "Link the selected products to this vehicle"}
                onClick={() => requestMutation("link")}
              >
                {busy === "link"
                  ? "Linking…"
                  : `Link ${allMatchingSelected ? "all matching" : "selected"} (${formatCount(plans.link.count)})`}
              </AdminActionButton>
              <AdminActionButton
                tone="danger"
                disabled={Boolean(busy) || !plans.unlink.enabled}
                title={plans.unlink.reason ?? "Unlink the selected products from this vehicle"}
                onClick={() => requestMutation("unlink")}
              >
                {busy === "unlink"
                  ? "Unlinking…"
                  : `Unlink ${allMatchingSelected ? "all matching" : "selected"} (${formatCount(plans.unlink.count)})`}
              </AdminActionButton>
            </div>

            {/* A mixed filtered scope cannot be split client-side without a
                second count query, so the result summary is where the split is
                reported. Say so before the admin confirms, not after. */}
            {allMatchingSelected && !plans.link.exact && plans.link.enabled ? (
              <p className="mt-2 text-[11px] text-zinc-500">
                This filter shows linked and unlinked products together, so the count above
                includes rows that are already in the requested state. The result summary reports
                how many actually changed.
              </p>
            ) : null}

            {mutationError ? (
              <div className="mt-3">
                <AdminError message={mutationError} />
              </div>
            ) : null}
            {notice ? (
              <div className="mt-3">
                <AdminNotice message={notice} />
              </div>
            ) : null}

            {gridError && (
              <div className="mt-4">
                <AdminError message={gridError} onRetry={() => void loadGrid()} />
              </div>
            )}

            {gridLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                <IconSearch className="h-4 w-4" /> Loading products…
              </div>
            ) : products.length === 0 ? (
              <div className="mt-4">
                <AdminEmptyState
                  title="No products match"
                  description={
                    hasActiveProductFilters(filters)
                      ? "No product matches the current filters for this vehicle."
                      : "This filter set is empty for the selected vehicle."
                  }
                  icon={<IconBoxes className="h-5 w-5" />}
                  action={
                    hasActiveProductFilters(filters) ? (
                      <AdminActionButton
                        tone="secondary"
                        onClick={() => {
                          setFilters(EMPTY_PRODUCT_FILTERS);
                          setPage(1);
                        }}
                      >
                        Clear filters
                      </AdminActionButton>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((row) => {
                    const status = rowCompatibilityStatus(row);
                    return (
                      <li key={row.id} className={`${panelClass} p-3`}>
                        <div className="flex gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Select ${row.partNumber}`}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300"
                          />
                          <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                            aria-hidden="true"
                          >
                            {row.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.imageUrl} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-[9px] font-semibold text-zinc-400">No image</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-900" title={row.name}>
                              {row.name}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-zinc-600">{row.partNumber}</p>
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                              {row.brand ?? "—"} · {row.categoryName ?? "Uncategorised"}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <AdminStatusBadge tone={status === "linked" ? "good" : "neutral"}>
                                {COMPATIBILITY_STATUS_LABEL[status]}
                              </AdminStatusBadge>
                              {row.listingCount === 0 ? (
                                <AdminStatusBadge tone="warn">No dealer listing</AdminStatusBadge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* ---------------------------------------------------------- paging */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-zinc-600">
                    Page {pagination.page} of {pagination.totalPages} ·{" "}
                    {formatCount(pagination.total)} results ·{" "}
                    {formatCount(pageSummary.linked)} linked and{" "}
                    {formatCount(pageSummary.notLinked)} not linked on this page
                  </p>
                  <div className="flex items-center gap-2">
                    <AdminActionButton
                      tone="secondary"
                      disabled={pagination.page <= 1 || gridLoading}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Previous
                    </AdminActionButton>
                    <AdminActionButton
                      tone="secondary"
                      disabled={pagination.page >= pagination.totalPages || gridLoading}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </AdminActionButton>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}

      {/* ---------------------------------------------------------- vehicle dialog */}
      <AdminDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select a vehicle"
        description="Search by make, model or variant. Link counts are live from the compatibility table."
        width="max-w-xl"
      >
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {pickerResults.length === 0 ? (
            <p className="p-3 text-xs text-zinc-500">No vehicle matches that search.</p>
          ) : (
            pickerResults.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseVehicle(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${FOCUS} ${
                  option.id === selectedId
                    ? "border-[#7a1233] bg-[#7a1233]/5"
                    : "border-transparent hover:bg-zinc-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900">
                    {vehicleOptionLabel(option)}
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    {vehicleVariantLabel(option)}
                  </span>
                </span>
                <AdminStatusBadge tone={option.linkCount > 0 ? "good" : "neutral"}>
                  {vehicleLinkLabel(option.linkCount)}
                </AdminStatusBadge>
              </button>
            ))
          )}
        </div>
      </AdminDialog>

      {/* ------------------------------------------------------ mutation confirm */}
      <AdminConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => void runMutation()}
        title={pendingAction === "link" ? "Link products to this vehicle?" : "Unlink products from this vehicle?"}
        description={
          pendingAction
            ? [
                `${selected ? vehicleOptionLabel(selected) : ""} — ${vehicleLinkLabel(selected?.linkCount ?? 0)}.`,
                `This affects ${formatCount(pendingAction === "link" ? plans.link.count : plans.unlink.count)} ${
                  allMatchingSelected ? "products matching the current filter" : "selected products"
                }.`,
                allMatchingSelected &&
                !(pendingAction === "link" ? plans.link.exact : plans.unlink.exact)
                  ? "Some may already be in the requested state and will be skipped."
                  : null,
                /* A bulk scope reads as a deliberate catalogue-wide change, so it
                   is named as one rather than as a row count. Added after the
                   2026-09-28 incident, where a filtered link affected 184
                   products without that being obvious. */
                allMatchingSelected && isBulkScope
                  ? "This is a bulk operation across the whole filtered set. Link or unlink many products one vehicle at a time unless you mean to change all of them."
                  : null,
                "This cannot be undone from this screen.",
              ]
                .filter(Boolean)
                .join(" ")
            : ""
        }
        confirmLabel={pendingAction === "link" ? "Link" : "Unlink"}
        tone={pendingAction === "link" ? "primary" : "danger"}
        busy={busy !== null}
      />
    </AdminShell>
  );
}
