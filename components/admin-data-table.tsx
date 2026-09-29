"use client";

/**
 * The admin data table.
 *
 * Every list inside /admin renders through this so they all behave the same on
 * a phone and read the same in a spreadsheet-style review:
 *  - a sticky, uppercase header with real scope="col" for screen readers
 *  - a horizontally scrollable body with a min-width, so columns compress into
 *    a scroll instead of collapsing into unreadable stacked cells
 *  - tabular figures so amounts and quantities line up down the column
 *  - an optional mobile card view, because a 9-column ERP table on a 375px
 *    screen is unusable otherwise
 *  - row count and an explicit loading / empty / error state
 */

import type { ReactNode } from "react";

import { AdminEmptyState, AdminSkeleton, panelClass } from "@/components/admin-ui";

export type AdminColumn<T> = {
  key: string;
  header: string;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Extra classes on both the header cell and the body cell. */
  className?: string;
  /** Hide below the given breakpoint on wide screens only. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Right-align numeric columns. */
  numeric?: boolean;
};

const HIDE_CLASS: Record<NonNullable<AdminColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export function AdminDataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
  skeletonRows = 5,
  emptyTitle = "Nothing to show",
  emptyDescription,
  emptyIcon,
  emptyAction,
  error,
  onRetry,
  minWidthClass = "min-w-[52rem]",
  /** Rendered instead of the table below the `lg` breakpoint. */
  mobileCard,
  footer,
}: {
  rows: T[];
  columns: ReadonlyArray<AdminColumn<T>>;
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  error?: string;
  onRetry?: () => void;
  minWidthClass?: string;
  mobileCard?: (row: T) => ReactNode;
  footer?: ReactNode;
}) {
  if (error) {
    return (
      <div className={panelClass}>
        <div className="p-4">
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${panelClass} overflow-hidden`}>
      {/* Desktop / tablet: the real table. */}
      <div className="hidden lg:block">
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: skeletonRows }).map((_, index) => (
              <AdminSkeleton key={index} className="h-9" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <AdminEmptyState
              title={emptyTitle}
              description={emptyDescription}
              icon={emptyIcon}
              action={emptyAction}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${minWidthClass} text-left text-sm`}>
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`whitespace-nowrap px-3 py-2.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500 ${
                        column.numeric ? "text-right" : ""
                      } ${column.hideBelow ? HIDE_CLASS[column.hideBelow] : ""} ${
                        column.className ?? ""
                      }`}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100" aria-busy={loading}>
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="transition-colors hover:bg-zinc-50/70">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-3 py-2.5 align-middle ${
                          column.numeric ? "text-right tabular-nums" : ""
                        } ${column.hideBelow ? HIDE_CLASS[column.hideBelow] : ""} ${
                          column.className ?? ""
                        }`}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Phone: the same data as cards, not a squeezed table. */}
      <div className="lg:hidden">
        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <AdminSkeleton key={index} className="h-24" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <AdminEmptyState
              title={emptyTitle}
              description={emptyDescription}
              icon={emptyIcon}
              action={emptyAction}
            />
          </div>
        ) : mobileCard ? (
          <ul className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <li key={rowKey(row)} className="p-4">
                {mobileCard(row)}
              </li>
            ))}
          </ul>
        ) : (
          // No card view supplied: fall back to a definition list per row so the
          // data is still readable rather than horizontally scrolled.
          <ul className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <li key={rowKey(row)} className="p-4">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {columns.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                        {column.header}
                      </dt>
                      <dd className="mt-0.5 truncate text-xs text-zinc-800">
                        {column.cell(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      {footer && !loading && rows.length > 0 && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2.5 text-[11px] text-zinc-500">
          {footer}
        </div>
      )}
    </div>
  );
}
