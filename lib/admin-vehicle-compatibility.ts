/**
 * Vehicle compatibility browser - pure logic.
 *
 * Everything here is a pure function over plain data: no database, no
 * filesystem, no network. The API route turns these descriptors into Drizzle
 * expressions, and the browser turns the same descriptors into labels and
 * badges. Because both sides share this module, the tests exercise the logic
 * that actually ships rather than a parallel reimplementation.
 *
 * WHY DESCRIPTORS INSTEAD OF QUERY BUILDERS. Building a `where()` clause here
 * would tie the module to a live Drizzle instance, and the tests would need a
 * database. A predicate is plain data, so `buildProductPredicates` is testable
 * in isolation and the route's translation to `and(eq(...))` is a few obvious
 * lines with no branching worth testing twice.
 *
 * READ-ONLY BY CONSTRUCTION. There is no write in this module, and the test
 * suite asserts that. `part_vehicle_compatibility` is the single authority: a
 * product is LINKED exactly when a row exists for its `part_id` and the
 * selected `vehicle_id`. Nothing here consults `vehicle_types`,
 * `specifications`, the source catalogue or Typesense.
 */

export type CompatibilityStatus = "linked" | "not_linked";

export type CompatibilityFilter = "all" | CompatibilityStatus;

export const COMPATIBILITY_FILTERS: readonly CompatibilityFilter[] = [
  "all",
  "linked",
  "not_linked",
];

export const COMPATIBILITY_FILTER_LABELS: Record<CompatibilityFilter, string> = {
  all: "All",
  linked: "Linked",
  not_linked: "Not Linked",
};

export const COMPATIBILITY_STATUS_LABEL: Record<CompatibilityStatus, string> = {
  linked: "LINKED",
  not_linked: "NOT LINKED",
};

/** A part, as the compatibility grid needs it. One row per part, never joined out. */
export type CompatProduct = {
  id: string;
  partNumber: string;
  name: string;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** True when a real part_vehicle_compatibility row exists for this vehicle. */
  isLinked: boolean;
  /** Catalogue image path, or null. Never invented, never another product's. */
  imageUrl: string | null;
  listingCount: number;
};

export type VehicleOption = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  linkCount: number;
};

/** "Maruti Suzuki Swift" - the variant is deliberately not folded in. */
export function vehicleOptionLabel(vehicle: Pick<VehicleOption, "make" | "model">): string {
  return `${vehicle.make} ${vehicle.model}`.trim();
}

/** The sub-line under a vehicle: its variant, or a dash when it has none. */
export function vehicleVariantLabel(vehicle: Pick<VehicleOption, "variant">): string {
  const variant = vehicle.variant?.trim();
  return variant ? variant : "—";
}

export function vehicleLinkLabel(count: number): string {
  return `${count} linked ${count === 1 ? "product" : "products"}`;
}

/** Case-insensitive substring match across make, model and variant. */
export function filterVehicleOptions(
  options: readonly VehicleOption[],
  query: string,
): VehicleOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter((option) =>
    [option.make, option.model, option.variant ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

/**
 * The badge for one product row. Sourced from the real join result, so the grid
 * never claims a product is compatible without a row behind it.
 */
export function rowCompatibilityStatus(row: Pick<CompatProduct, "isLinked">): CompatibilityStatus {
  return row.isLinked ? "linked" : "not_linked";
}

export function summariseCompatibility(rows: readonly CompatProduct[]): {
  linked: number;
  notLinked: number;
  total: number;
} {
  return {
    linked: rows.filter((row) => row.isLinked).length,
    notLinked: rows.filter((row) => !row.isLinked).length,
    total: rows.length,
  };
}

/* ------------------------------------------------------------------ filters */

export type ProductFilters = {
  q: string;
  brand: string;
  categoryId: string;
  status: CompatibilityFilter;
};

export const EMPTY_PRODUCT_FILTERS: ProductFilters = {
  q: "",
  brand: "",
  categoryId: "",
  status: "all",
};

/** Trims every field and rejects an unknown status, so a hand-typed query cannot widen the filter. */
export function normaliseProductFilters(raw: unknown): ProductFilters {
  const source = (raw ?? {}) as Record<string, unknown>;
  const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
  const status = text(source.status);
  return {
    q: text(source.q),
    brand: text(source.brand),
    categoryId: text(source.categoryId),
    status: (COMPATIBILITY_FILTERS as readonly string[]).includes(status)
      ? (status as CompatibilityFilter)
      : "all",
  };
}

export function hasActiveProductFilters(filters: ProductFilters): boolean {
  return (
    filters.q !== "" ||
    filters.brand !== "" ||
    filters.categoryId !== "" ||
    filters.status !== "all"
  );
}

/* --------------------------------------------------------------- predicates */

export type ProductPredicate =
  /** `q` matches the part number or the name, the two things a buyer types. */
  | { kind: "text"; columns: readonly ["partNumber", "name"]; value: string }
  | { kind: "brand"; value: string }
  | { kind: "category"; value: string }
  /** Derived from the LEFT JOIN, not from a stored flag. */
  | { kind: "compatibility"; value: CompatibilityStatus };

/**
 * The complete filter description for one request.
 *
 * `vehicleId` is passed in rather than read from the filters because the
 * compatibility status is meaningless without it: without a vehicle there is no
 * join to test, so a linked/not-linked filter is silently dropped instead of
 * returning a misleading half-result.
 */
export function buildProductPredicates(
  filters: ProductFilters,
  vehicleId: string | null,
): ProductPredicate[] {
  const predicates: ProductPredicate[] = [];

  if (filters.q) {
    predicates.push({ kind: "text", columns: ["partNumber", "name"], value: filters.q });
  }
  if (filters.brand) {
    predicates.push({ kind: "brand", value: filters.brand });
  }
  if (filters.categoryId) {
    predicates.push({ kind: "category", value: filters.categoryId });
  }
  if (vehicleId && filters.status !== "all") {
    predicates.push({ kind: "compatibility", value: filters.status });
  }

  return predicates;
}

/* -------------------------------------------------------------- pagination */

export const PER_PAGE_DEFAULT = 25;
export const PER_PAGE_MAX = 50;

export type Pagination = {
  page: number;
  perPage: number;
  offset: number;
  total: number;
  totalPages: number;
  /** True when the requested page was past the end and has been pulled back. */
  clamped: boolean;
};

/**
 * Page arithmetic over a known total. The page is clamped rather than trusted,
 * so a hand-edited `?page=9999` returns the last page instead of an empty grid
 * that looks like a search failure.
 */
export function resolvePagination(input: {
  page: unknown;
  perPage: unknown;
  total: number;
}): Pagination {
  const total = Number.isFinite(Number(input.total)) ? Math.max(0, Math.floor(Number(input.total))) : 0;

  const requestedPerPage = Number(input.perPage);
  const perPage = Number.isFinite(requestedPerPage)
    ? Math.min(PER_PAGE_MAX, Math.max(1, Math.floor(requestedPerPage)))
    : PER_PAGE_DEFAULT;

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const requestedPage = Number(input.page);
  const wanted = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const page = Math.min(wanted, totalPages);

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
    total,
    totalPages,
    clamped: page !== wanted,
  };
}

/* ------------------------------------------------- action availability (UI) */

/**
 * What the Link and Unlink buttons should offer, given the active status filter
 * and the current selection.
 *
 * WHY THIS IS UI-ONLY LOGIC. The status filter describes what the GRID is
 * showing, and the mutation endpoints are deliberately blind to it: they accept
 * a whole filtered scope and report how many rows were newly linked versus
 * already linked. That authority stays where it is. This function only stops
 * the admin being offered an action that cannot do anything.
 *
 * - `status = "linked"` means every visible row is already linked, so Link is
 *   meaningless and Unlink is the only real action.
 * - `status = "not_linked"` is the mirror image.
 * - `status = "all"` offers both, because a mixed selection can contain both.
 *
 * `count` is how many rows the action will submit. `exact` says whether all of
 * them will actually change: it is true whenever the status filter makes the
 * scope uniform, and false for a mixed filtered scope, where the split is only
 * known after the server has read the table. Guessing that split client-side
 * would mean a second count query, and the result summary already reports it.
 */
export type ActionPlan = {
  enabled: boolean;
  /** Rows this action would submit. */
  count: number;
  /** True when every submitted row is guaranteed to change. */
  exact: boolean;
  /** Why the action is unavailable, when it is. */
  reason: string | null;
};

export type ActionPlans = { link: ActionPlan; unlink: ActionPlan };

export function resolveActionAvailability(input: {
  status: CompatibilityFilter;
  /** True when the selection is "all matching results" rather than row ids. */
  scopeIsFiltered: boolean;
  /** Total of the current filtered result set, from the paginated endpoint. */
  scopeTotal: number;
  /** The explicitly ticked rows, when the selection is by id. */
  selectedProducts: ReadonlyArray<{ isLinked: boolean }>;
}): ActionPlans {
  const { status, scopeIsFiltered, scopeTotal, selectedProducts } = input;

  /* The status filter is the whole point: a grid showing only linked rows has
     nothing for Link to do. */
  const linkBlockedByFilter = status === "linked";
  const unlinkBlockedByFilter = status === "not_linked";

  if (!scopeIsFiltered) {
    const linkCount = selectedProducts.filter((row) => !row.isLinked).length;
    const unlinkCount = selectedProducts.filter((row) => row.isLinked).length;
    return {
      link: {
        enabled: !linkBlockedByFilter && linkCount > 0,
        count: linkCount,
        exact: true,
        reason: linkBlockedByFilter
          ? "This view shows only products that are already linked."
          : linkCount === 0
            ? "Select a product that is not already linked."
            : null,
      },
      unlink: {
        enabled: !unlinkBlockedByFilter && unlinkCount > 0,
        count: unlinkCount,
        exact: true,
        reason: unlinkBlockedByFilter
          ? "This view shows only products that are not linked."
          : unlinkCount === 0
            ? "Select a product that is currently linked."
            : null,
      },
    };
  }

  /* Filtered scope: the whole result set is the target. When the status filter
     pins the scope to one state, every row is genuinely actionable. Under
     "all" the set is mixed and the split is the server's to report. */
  const uniform = status === "not_linked" ? "link" : status === "linked" ? "unlink" : null;

  return {
    link: {
      enabled: !linkBlockedByFilter && scopeTotal > 0,
      count: scopeTotal,
      exact: uniform === "link",
      reason: linkBlockedByFilter
        ? "This view shows only products that are already linked, so there is nothing to link."
        : scopeTotal === 0
          ? "No products match the current filter."
          : null,
    },
    unlink: {
      enabled: !unlinkBlockedByFilter && scopeTotal > 0,
      count: scopeTotal,
      exact: uniform === "unlink",
      reason: unlinkBlockedByFilter
        ? "This view shows only products that are not linked, so there is nothing to unlink."
        : scopeTotal === 0
          ? "No products match the current filter."
          : null,
    },
  };
}
