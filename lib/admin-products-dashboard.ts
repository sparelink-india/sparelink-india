/**
 * Pure view model for the admin Products workspace.
 *
 * Extracted from the page so the filtering, sorting and summary logic can be
 * unit tested (the test runner only globs the test files under lib) and so the
 * page holds no business rules of its own.
 *
 * Honesty rules encoded here:
 *  - every figure is derived from the rows the API actually returned
 *  - no trend or percentage-change is ever produced, because no prior snapshot
 *    of the catalogue is stored to compare against
 *  - a missing brand/category is reported as absent, never invented
 */

export type AdminProduct = {
  id: string;
  partNumber: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  listingCount: number;
  createdAt: string;
};

/** Value used when the catalogue has no row for a field. Never a guess. */
export const ABSENT = "—";

export function productBrand(product: AdminProduct): string {
  const value = (product.brand ?? "").trim();
  return value || ABSENT;
}

export function productCategory(product: AdminProduct): string {
  const value = (product.category ?? "").trim();
  return value || ABSENT;
}

export type ProductSort = "listings" | "name" | "part" | "newest";

export const PRODUCT_SORTS: readonly ProductSort[] = ["listings", "name", "part", "newest"];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  listings: "Most listed",
  name: "Name A-Z",
  part: "Part number",
  newest: "Newest",
};

export type ProductFilter = "all" | "listed" | "unlisted";

export const PRODUCT_FILTERS: readonly ProductFilter[] = ["all", "listed", "unlisted"];

export const PRODUCT_FILTER_LABELS: Record<ProductFilter, string> = {
  all: "All products",
  listed: "Has listings",
  unlisted: "No listings",
};

export function matchesProductFilter(
  product: AdminProduct,
  filter: ProductFilter,
): boolean {
  if (filter === "listed") return product.listingCount > 0;
  if (filter === "unlisted") return product.listingCount === 0;
  return true;
}

/**
 * Free-text match across every field the catalogue returns, so an admin can
 * find a row by part number, name, brand, category or description.
 */
export function matchesProductQuery(product: AdminProduct, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    product.partNumber,
    product.name,
    product.brand ?? "",
    product.category ?? "",
    product.description ?? "",
  ].some((field) => field.toLowerCase().includes(needle));
}

export function sortProducts(
  products: readonly AdminProduct[],
  sort: ProductSort,
): AdminProduct[] {
  const rows = [...products];
  if (sort === "listings") {
    // Highest listing count first; part number keeps the order deterministic.
    rows.sort(
      (a, b) =>
        b.listingCount - a.listingCount ||
        a.partNumber.localeCompare(b.partNumber, "en", { numeric: true }),
    );
    return rows;
  }
  if (sort === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    return rows;
  }
  if (sort === "part") {
    rows.sort((a, b) => a.partNumber.localeCompare(b.partNumber, "en", { numeric: true }));
    return rows;
  }
  rows.sort((a, b) => {
    const left = Date.parse(a.createdAt);
    const right = Date.parse(b.createdAt);
    const l = Number.isNaN(left) ? 0 : left;
    const r = Number.isNaN(right) ? 0 : right;
    return r - l || a.partNumber.localeCompare(b.partNumber, "en", { numeric: true });
  });
  return rows;
}

export function filterProducts(
  products: readonly AdminProduct[],
  options: { query: string; filter: ProductFilter; sort: ProductSort },
): AdminProduct[] {
  return sortProducts(
    products.filter(
      (product) =>
        matchesProductFilter(product, options.filter) &&
        matchesProductQuery(product, options.query),
    ),
    options.sort,
  );
}

export function hasActiveProductFilters(options: {
  query: string;
  filter: ProductFilter;
}): boolean {
  return options.query.trim().length > 0 || options.filter !== "all";
}

/* ----------------------------------------------------------------- summary */

export type ProductSummary = {
  /** Rows the API returned. */
  total: number;
  /** Rows that currently have at least one dealer listing. */
  listed: number;
  /** Rows with no listing at all. */
  unlisted: number;
  /** Sum of listingCount across the returned rows. */
  listings: number;
  /** Distinct non-empty brands present in the returned rows. */
  brands: number;
  /** Distinct non-empty categories present in the returned rows. */
  categories: number;
};

export function summariseProducts(products: readonly AdminProduct[]): ProductSummary {
  const brands = new Set<string>();
  const categories = new Set<string>();
  let listings = 0;
  let listed = 0;

  for (const product of products) {
    listings += product.listingCount;
    if (product.listingCount > 0) listed += 1;
    const brand = (product.brand ?? "").trim();
    if (brand) brands.add(brand.toLowerCase());
    const category = (product.category ?? "").trim();
    if (category) categories.add(category.toLowerCase());
  }

  return {
    total: products.length,
    listed,
    unlisted: products.length - listed,
    listings,
    brands: brands.size,
    categories: categories.size,
  };
}

/* ------------------------------------------------------------------ states */

export function productsEmptyMessage(input: {
  loading: boolean;
  hasData: boolean;
  filtered: boolean;
}): { title: string; description: string } {
  if (input.loading) {
    return { title: "Loading products", description: "Reading the catalogue." };
  }
  if (input.filtered) {
    return {
      title: "No products match",
      description: "No product matches the current search or filter. Clear the filters to see the whole catalogue.",
    };
  }
  if (input.hasData) {
    return {
      title: "No products found",
      description: "The catalogue returned no parts. Import a source catalogue to add products.",
    };
  }
  return {
    title: "No products yet",
    description: "Once parts are imported they will appear here, with the number of dealer listings for each.",
  };
}

export function productsErrorMessage(raw: unknown): string {
  const message = raw instanceof Error ? raw.message.trim() : "";
  return message || "Unable to load the product catalogue.";
}
