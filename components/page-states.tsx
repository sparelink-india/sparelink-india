import type { ReactNode } from "react";
import Link from "next/link";

/**
 * V2 global page states.
 *
 * Requirement: no page may render a bare "Loading..." or "Searching..." string.
 * Every data-driven surface uses one of these three so the storefront states
 * read as a designed system rather than debug output.
 */

/** Shimmering block. `className` sets the final geometry. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`sl-skeleton ${className}`}
      aria-hidden
    />
  );
}

/** A grid of product-shaped skeletons, used while catalogue data resolves. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="sl-v2-card overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full !rounded-none" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="mt-3 h-11 w-full !rounded-[var(--sl-radius-sm)]" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading products</span>
    </div>
  );
}

/** Generic skeleton for non-catalogue panels (forms, tables, sidebars). */
export function PanelSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Empty state. Always pairs the explanation with a real next action, so the
 * user is never left at a dead end. Nothing here is invented content \u2014 the
 * caller supplies the copy.
 */
export function EmptyState({
  title,
  body,
  action,
  secondaryAction,
  icon,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
  icon?: ReactNode;
}) {
  return (
    <div className="sl-v2-card flex flex-col items-center px-6 py-14 text-center">
      {icon ? (
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[var(--sl-radius)] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
          {icon}
        </span>
      ) : null}
      <h2 className="sl-h2">{title}</h2>
      <p className="sl-body mt-2 max-w-md">{body}</p>
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {action ? (
            <Link href={action.href} className="sl-v2-btn sl-v2-btn-primary">
              {action.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="sl-v2-btn sl-v2-btn-secondary"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Error state with an optional retry that re-runs the page's own loader. */
export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  action,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      role="alert"
      className="rounded-[var(--sl-radius)] border border-[#f0c8c5] bg-[var(--sl-danger-soft)] px-5 py-6"
    >
      <div className="flex items-start gap-3.5">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sl-danger)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4.5M12 16h.01" />
        </svg>
        <div className="min-w-0 flex-1">
          <h2 className="sl-h3 !text-[var(--sl-danger)]">{title}</h2>
          <p className="sl-body mt-1">{body}</p>
          {onRetry || action ? (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="sl-v2-btn sl-v2-btn-secondary !min-h-10 !text-[0.8125rem]"
                >
                  {retryLabel}
                </button>
              ) : null}
              {action ? (
                <Link
                  href={action.href}
                  className="sl-v2-btn sl-v2-btn-ghost !min-h-10 !text-[0.8125rem]"
                >
                  {action.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Inline success/confirmation note. */
export function Notice({
  tone = "success",
  children,
}: {
  tone?: "success" | "error" | "info";
  children: ReactNode;
}) {
  const map = {
    success:
      "border-[#bfe3d4] bg-[var(--sl-success-soft)] text-[var(--sl-success)]",
    error: "border-[#f0c8c5] bg-[var(--sl-danger-soft)] text-[var(--sl-danger)]",
    info: "border-[var(--sl-border-strong)] bg-[var(--sl-surface-sunk)] text-[var(--sl-text-soft)]",
  } as const;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[var(--sl-radius-sm)] border px-3.5 py-2.5 text-sm ${map[tone]}`}
    >
      {children}
    </p>
  );
}

/** Common glyphs for empty states. Semantic SVG only, no emoji. */
export const StateIcons = {
  wishlist: (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.3 12.3L12 20l7.7-7.7a4.5 4.5 0 00-6.4-6.4L12 7.2l-1.3-1.3a4.5 4.5 0 00-6.4 6.4z" />
    </svg>
  ),
  search: (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  ),
  orders: (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h6M9 16h4" />
    </svg>
  ),
  offers: (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 12l-8 8-8-8V4h8z" />
      <circle cx="12" cy="9" r="1.4" />
    </svg>
  ),
};
