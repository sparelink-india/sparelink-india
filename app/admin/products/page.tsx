"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminDataTable, type AdminColumn } from "@/components/admin-data-table";
import { FeatureIcon } from "@/components/admin-feature-icon";
import {
  IconBoxes,
  IconCart,
  IconGauge,
  IconList,
  IconPackage,
} from "@/components/admin-icons";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminActionButton,
  AdminDialog,
  AdminError,
  AdminFeatureCard,
  AdminFilterBar,
  AdminFilterChips,
  AdminInlineLink,
  AdminSearch,
  AdminSection,
  AdminStat,
  panelClass,
} from "@/components/admin-ui";
import {
  PRODUCT_FILTERS,
  PRODUCT_FILTER_LABELS,
  PRODUCT_SORT_LABELS,
  PRODUCT_SORTS,
  filterProducts,
  hasActiveProductFilters,
  productBrand,
  productCategory,
  productsEmptyMessage,
  productsErrorMessage,
  summariseProducts,
  type AdminProduct,
  type ProductFilter,
  type ProductSort,
} from "@/lib/admin-products-dashboard";
import { formatCount, formatRelativeTime, titleCase } from "@/lib/admin-dashboard";

const FILTER_OPTIONS = PRODUCT_FILTERS.map((id) => ({
  id,
  label: PRODUCT_FILTER_LABELS[id],
}));

const SORT_OPTIONS = PRODUCT_SORTS.map((id) => ({
  id,
  label: PRODUCT_SORT_LABELS[id],
}));

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [sort, setSort] = useState<ProductSort>("listings");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/products", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error);
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (cause) {
      setError(productsErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summariseProducts(products), [products]);

  const visible = useMemo(
    () => filterProducts(products, { query, filter, sort }),
    [products, query, filter, sort],
  );

  const filtered = hasActiveProductFilters({ query, filter });
  const preview = useMemo(
    () => products.find((product) => product.id === previewId) ?? null,
    [products, previewId],
  );

  const empty = productsEmptyMessage({
    loading,
    hasData: products.length > 0,
    filtered,
  });

  const columns: ReadonlyArray<AdminColumn<AdminProduct>> = useMemo(
    () => [
      {
        key: "part",
        header: "Part number",
        className: "whitespace-nowrap",
        cell: (product) => (
          <span className="font-mono text-xs font-semibold text-zinc-900">
            {product.partNumber}
          </span>
        ),
      },
      {
        key: "name",
        header: "Product",
        cell: (product) => (
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{product.name}</p>
            {product.description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500" title={product.description}>
                {product.description}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "brand",
        header: "Brand",
        hideBelow: "md",
        cell: (product) => (
          <span className="text-xs text-zinc-700">{productBrand(product)}</span>
        ),
      },
      {
        key: "category",
        header: "Category",
        hideBelow: "lg",
        cell: (product) => (
          <span className="text-xs text-zinc-700">{productCategory(product)}</span>
        ),
      },
      {
        key: "listings",
        header: "Listings",
        numeric: true,
        className: "whitespace-nowrap",
        cell: (product) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
              product.listingCount > 0
                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                : "bg-zinc-100 text-zinc-500 ring-zinc-500/20"
            }`}
          >
            {formatCount(product.listingCount)}
          </span>
        ),
      },
      {
        key: "added",
        header: "Added",
        hideBelow: "xl",
        cell: (product) => (
          <span className="whitespace-nowrap text-[11px] text-zinc-500">
            {formatRelativeTime(product.createdAt, new Date())}
          </span>
        ),
      },
      {
        key: "action",
        header: "",
        className: "text-right",
        cell: (product) => (
          <AdminActionButton
            onClick={() => setPreviewId(product.id)}
            aria-label={`Preview ${product.partNumber}`}
          >
            Preview
          </AdminActionButton>
        ),
      },
    ],
    [],
  );

  return (
    <AdminShell
      title="Products"
      subtitle="Catalogue of every part, with dealer listing coverage"
      activeHref="/admin/products"
    >
      {/* ------------------------------------------------------------- summary */}
      <section aria-label="Catalogue summary">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStat
            label="Products"
            value={formatCount(summary.total)}
            hint="Parts returned by the catalogue"
            tone="brand"
            icon={<IconBoxes className="h-5 w-5" />}
          />
          <AdminStat
            label="Dealer listings"
            value={formatCount(summary.listings)}
            hint="Sum of listings across all products"
            icon={<IconList className="h-5 w-5" />}
          />
          <AdminStat
            label="Unlisted"
            value={formatCount(summary.unlisted)}
            hint="Products with no dealer listing yet"
            tone={summary.unlisted > 0 ? "warn" : "good"}
            icon={<IconPackage className="h-5 w-5" />}
          />
          <AdminStat
            label="Brands / Categories"
            value={`${formatCount(summary.brands)} / ${formatCount(summary.categories)}`}
            hint="Distinct values present in the catalogue"
            icon={<IconGauge className="h-5 w-5" />}
          />
        </div>
      </section>

      {error && (
        <div className="mt-4">
          <AdminError message={error} onRetry={() => void load()} />
        </div>
      )}

      {/* ------------------------------------------------------------- filters */}
      <div className="mt-5">
        <AdminFilterBar>
          <AdminSearch
            value={query}
            onChange={setQuery}
            label="Search products"
            placeholder="Part number, name, brand, category…"
            className="min-w-[14rem] flex-1"
          />
          <AdminFilterChips
            label="Filter products by listing coverage"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(id) => setFilter(id as ProductFilter)}
          />
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="product-sort"
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500"
            >
              Sort
            </label>
            <select
              id="product-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as ProductSort)}
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
      <section aria-label="Products" className="mt-4">
        <AdminSection
          eyebrow="Catalogue"
          title="All products"
          description={
            filtered
              ? `${formatCount(visible.length)} of ${formatCount(products.length)} products match.`
              : undefined
          }
          action={
            <div className="flex items-center gap-3">
              <AdminInlineLink href="/admin/listings">Manage listings</AdminInlineLink>
              <AdminInlineLink href="/admin/import">Import catalogue</AdminInlineLink>
            </div>
          }
        />
        <AdminDataTable
          rows={visible}
          columns={columns}
          rowKey={(product) => product.id}
          caption="Product catalogue with dealer listing coverage"
          loading={loading}
          minWidthClass="min-w-[54rem]"
          emptyTitle={empty.title}
          emptyDescription={empty.description}
          emptyIcon={<IconBoxes className="h-5 w-5" />}
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
            ) : (
              <AdminInlineLink href="/admin/import">Import a source catalogue</AdminInlineLink>
            )
          }
          footer={
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Showing {formatCount(visible.length)} of {formatCount(products.length)} products
              </span>
              {filtered && <span>Filtered view</span>}
            </span>
          }
          mobileCard={(product) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-zinc-500">
                    {product.partNumber}
                  </p>
                  <p className="mt-0.5 text-sm font-bold leading-tight text-zinc-900">
                    {product.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-700">
                  {formatCount(product.listingCount)} listings
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <dt className="text-zinc-400">Brand</dt>
                  <dd className="text-zinc-700">{productBrand(product)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Category</dt>
                  <dd className="text-zinc-700">{productCategory(product)}</dd>
                </div>
              </dl>
              <AdminActionButton
                onClick={() => setPreviewId(product.id)}
                className="w-full"
              >
                Preview product
              </AdminActionButton>
            </div>
          )}
        />
      </section>

      {/* ------------------------------------------------------------- actions */}
      <section aria-label="Related workspaces" className="mt-6">
        <AdminSection
          eyebrow="Continue"
          title="Catalogue workspaces"
          description="Every part action in the console, in one place."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminFeatureCard
            href="/admin/listings"
            title="Listings"
            description="Assign every listing to a fulfilment firm"
            icon={<IconList className="h-[22px] w-[22px]" />}
          />
          <AdminFeatureCard
            href="/admin/inventory"
            title="Inventory"
            description="Live stock, low stock and adjustments"
            icon={<FeatureIcon id="inventory" className="h-[22px] w-[22px]" />}
          />
          <AdminFeatureCard
            href="/admin/stock-adjustments"
            title="Stock adjustments"
            description="Ledger of every recorded stock movement"
            icon={<FeatureIcon id="stock-adjustments" className="h-[22px] w-[22px]" />}
          />
          <AdminFeatureCard
            href="/admin/orders"
            title="Orders"
            description="What has been ordered against this catalogue"
            icon={<IconCart className="h-[22px] w-[22px]" />}
          />
        </div>
      </section>

      {/* -------------------------------------------------------------- preview */}
      <AdminDialog
        open={preview !== null}
        onClose={() => setPreviewId(null)}
        title={preview?.name ?? "Product"}
        description={preview ? `Part number ${preview.partNumber}` : undefined}
        footer={
          <>
            {preview && (
              <AdminInlineLink href="/admin/listings">View dealer listings</AdminInlineLink>
            )}
            <AdminActionButton tone="primary" onClick={() => setPreviewId(null)}>
              Close
            </AdminActionButton>
          </>
        }
      >
        {preview && (
          <div className="space-y-4">
            {preview.description && (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700">
                {preview.description}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Part number", value: preview.partNumber },
                { label: "Brand", value: productBrand(preview) },
                { label: "Category", value: productCategory(preview) },
                {
                  label: "Dealer listings",
                  value: formatCount(preview.listingCount),
                },
                { label: "Added", value: titleCase(new Date(preview.createdAt).toISOString().slice(0, 10)) },
                { label: "Product ID", value: preview.id },
              ].map((field) => (
                <div key={field.label} className={`rounded-xl border border-zinc-200 p-3 ${panelClass}`}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    {field.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-zinc-900">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </AdminDialog>
    </AdminShell>
  );
}
