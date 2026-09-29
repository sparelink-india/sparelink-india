/**
 * Pure view model for the admin Inventory command center.
 *
 * Kept out of the page so the stock-banding, search, filtering and summary
 * rules are unit testable, and so the page holds no business logic.
 *
 * Honesty rules:
 *  - the low-stock band is the same declared constant the Command Center uses
 *  - every headline figure is counted from the rows the API returned
 *  - no trend percentages, because no prior stock snapshot is stored
 *  - a missing dealer or price is shown as absent, never substituted
 */

import { LOW_STOCK_THRESHOLD } from "@/lib/admin-dashboard";

export type AdminInventoryRow = {
  id: string;
  dealerListingId: string;
  partName: string;
  dealerName: string;
  quantity: number;
  /** Selling price in paise. */
  price: number;
  lastUpdated: string;
};

export const INVENTORY_ABSENT = "—";

export function inventoryDealer(row: AdminInventoryRow): string {
  const value = (row.dealerName ?? "").trim();
  return value || INVENTORY_ABSENT;
}

export function inventoryPart(row: AdminInventoryRow): string {
  const value = (row.partName ?? "").trim();
  return value || INVENTORY_ABSENT;
}

/* --------------------------------------------------------------- banding */

export type StockBand = "out" | "low" | "healthy";

export interface StockBandInfo {
  band: StockBand;
  label: string;
  /** Pill classes, matching the Command Center's status scale. */
  className: string;
}

/**
 * Stock health bands.
 *
 * `low` uses the shared LOW_STOCK_THRESHOLD constant (5 units) so this page and
 * the Command Center can never disagree about what counts as low stock.
 */
export function stockBand(quantity: number): StockBandInfo {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      band: "out",
      label: "Out of stock",
      className: "bg-rose-50 text-rose-700 ring-rose-600/20",
    };
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return {
      band: "low",
      label: `Low · ${LOW_STOCK_THRESHOLD} or fewer`,
      className: "bg-amber-50 text-amber-800 ring-amber-600/20",
    };
  }
  return {
    band: "healthy",
    label: "In stock",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  };
}

/* ---------------------------------------------------------------- search */

export function matchesInventoryQuery(row: AdminInventoryRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.partName, row.dealerName, String(row.quantity)]
    .some((field) => (field ?? "").toLowerCase().includes(needle));
}

/* ---------------------------------------------------------------- filter */

export type InventoryFilter = "all" | "low" | "out" | "healthy";

export const INVENTORY_FILTERS: readonly InventoryFilter[] = [
  "all",
  "low",
  "out",
  "healthy",
];

export const INVENTORY_FILTER_LABELS: Record<InventoryFilter, string> = {
  all: "All stock",
  low: `Low ≤ ${LOW_STOCK_THRESHOLD}`,
  out: "Out of stock",
  healthy: "In stock",
};

export function matchesInventoryFilter(
  row: AdminInventoryRow,
  filter: InventoryFilter,
): boolean {
  const band = stockBand(row.quantity).band;
  if (filter === "low") return band === "low";
  if (filter === "out") return band === "out";
  if (filter === "healthy") return band === "healthy";
  return true;
}

/* ------------------------------------------------------------------ sort */

export type InventorySort = "stock" | "part" | "updated" | "dealer";

export const INVENTORY_SORTS: readonly InventorySort[] = [
  "stock",
  "part",
  "updated",
  "dealer",
];

export const INVENTORY_SORT_LABELS: Record<InventorySort, string> = {
  stock: "Lowest stock first",
  part: "Part name",
  updated: "Recently updated",
  dealer: "Dealer",
};

function timeOf(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortInventory(
  rows: readonly AdminInventoryRow[],
  sort: InventorySort,
): AdminInventoryRow[] {
  const list = [...rows];
  if (sort === "stock") {
    list.sort(
      (a, b) =>
        a.quantity - b.quantity ||
        (a.partName ?? "").localeCompare(b.partName ?? "", "en", { sensitivity: "base" }),
    );
    return list;
  }
  if (sort === "part") {
    list.sort((a, b) =>
      (a.partName ?? "").localeCompare(b.partName ?? "", "en", { sensitivity: "base" }),
    );
    return list;
  }
  if (sort === "dealer") {
    list.sort((a, b) =>
      (a.dealerName ?? "").localeCompare(b.dealerName ?? "", "en", { sensitivity: "base" }),
    );
    return list;
  }
  list.sort((a, b) => timeOf(b.lastUpdated) - timeOf(a.lastUpdated));
  return list;
}

export function filterInventory(
  rows: readonly AdminInventoryRow[],
  options: { query: string; filter: InventoryFilter; sort: InventorySort },
): AdminInventoryRow[] {
  return sortInventory(
    rows.filter(
      (row) =>
        matchesInventoryFilter(row, options.filter) && matchesInventoryQuery(row, options.query),
    ),
    options.sort,
  );
}

export function hasActiveInventoryFilters(options: {
  query: string;
  filter: InventoryFilter;
}): boolean {
  return options.query.trim().length > 0 || options.filter !== "all";
}

/* ---------------------------------------------------------------- summary */

export type InventorySummary = {
  totalRows: number;
  /** Units on hand across every returned row. */
  totalUnits: number;
  low: number;
  out: number;
  healthy: number;
  /** Distinct dealers present in the returned rows. */
  dealers: number;
};

export function summariseInventory(
  rows: readonly AdminInventoryRow[],
): InventorySummary {
  const dealers = new Set<string>();
  let totalUnits = 0;
  let low = 0;
  let out = 0;
  let healthy = 0;

  for (const row of rows) {
    const quantity = Number.isFinite(row.quantity) ? row.quantity : 0;
    totalUnits += quantity;
    const band = stockBand(quantity).band;
    if (band === "out") out += 1;
    else if (band === "low") low += 1;
    else healthy += 1;
    const dealer = (row.dealerName ?? "").trim();
    if (dealer) dealers.add(dealer.toLowerCase());
  }

  return {
    totalRows: rows.length,
    totalUnits,
    low,
    out,
    healthy,
    dealers: dealers.size,
  };
}

/* ------------------------------------------------------ adjustment input */

/**
 * Validate an absolute quantity before it is sent to the API.
 *
 * The server enforces an integer >= 0; this mirrors that so the admin gets an
 * inline message instead of a round-trip rejection. Returns null when valid.
 */
export function validateAdjustmentQuantity(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "Enter a quantity.";
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return "Quantity must be a number.";
  if (!Number.isInteger(value)) return "Quantity must be a whole number of units.";
  if (value < 0) return "Quantity cannot be negative.";
  return null;
}

export function validateAdjustmentReason(raw: string): string | null {
  return raw.trim().length > 0 ? null : "A reason is required for every adjustment.";
}

/* ----------------------------------------------------------------- states */

export function inventoryEmptyMessage(input: {
  loading: boolean;
  hasData: boolean;
  filtered: boolean;
}): { title: string; description: string } {
  if (input.loading) {
    return { title: "Loading inventory", description: "Reading live stock levels." };
  }
  if (input.filtered) {
    return {
      title: "No stock matches",
      description:
        "No inventory row matches the current search or filter. Clear the filters to see all stock.",
    };
  }
  if (input.hasData) {
    return {
      title: "No stock recorded",
      description: "Stock appears here once a listing carries inventory.",
    };
  }
  return {
    title: "No inventory yet",
    description:
      "No listing currently carries stock. Import a catalogue or receive goods to create stock rows.",
  };
}

export function inventoryErrorMessage(raw: unknown, fallback: string): string {
  const message = raw instanceof Error ? raw.message.trim() : "";
  return message || fallback;
}

/** Human sentence describing a completed adjustment, using the server's delta. */
export function describeAdjustment(input: {
  partName: string;
  quantity: number;
  delta: number;
}): string {
  const name = input.partName.trim() || "Listing";
  if (input.delta === 0) {
    return `${name} stock set to ${input.quantity}. No net change.`;
  }
  const direction = input.delta > 0 ? "increased" : "decreased";
  return `${name} stock ${direction} by ${Math.abs(input.delta)} to ${input.quantity}.`;
}
