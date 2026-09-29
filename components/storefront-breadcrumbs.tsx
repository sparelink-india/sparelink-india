import Link from "next/link";

/**
 * One shared breadcrumb for the customer storefront.
 *
 * The category page already had its own inline breadcrumb. This extracts that
 * pattern into a single component so every browse/discovery page renders the
 * same compact, accessible, burgundy-linked trail instead of a bespoke
 * implementation per route.
 *
 * Deliberately compact: a single line of small type, no container bar, no
 * heavy background, and it wraps safely on narrow screens.
 *
 * Intentionally has NO "use client" and NO `useI18n()`. Several pages that
 * need it (`/vehicle-fitment/[make]`, `[make]/[model]`) are async Server
 * Components, and a client hook here would throw at runtime. Callers pass the
 * resolved label(s) instead, so it renders correctly in both trees.
 */
export type StorefrontCrumb = {
  label: string;
  /** Omit (or leave undefined) for the current page — it renders as muted text. */
  href?: string;
};

export function StorefrontBreadcrumbs({
  crumbs,
  label = "Breadcrumb",
  className = "",
}: {
  crumbs: StorefrontCrumb[];
  /** Accessible name for the nav landmark. */
  label?: string;
  className?: string;
}) {
  const items = crumbs.filter(Boolean);
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <svg
                  className="h-3 w-3 shrink-0 text-[var(--v3-text-3)]/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="rounded font-medium text-[var(--v3-brand)] underline-offset-2 transition-colors duration-200 hover:text-[var(--v3-brand-hover)] hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-[var(--v3-text-2)]" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
