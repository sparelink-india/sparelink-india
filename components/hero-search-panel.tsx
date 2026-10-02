"use client";

import Link from "next/link";
import { useI18n } from "@/components/preferences-provider";

/**
 * The search-first band that sits directly beneath the hero artwork.
 *
 * WHY A BAND AND NOT TEXT OVER THE ARTWORK
 * ---------------------------------------
 * The hero bitmap (`hero-final-reference.png`) has its own left column baked into
 * it: a burgundy rule, "AUTO SPARE PARTS", the headline lines, the supporting
 * sentence AND both CTA buttons. Redrawing any of that in HTML would print the
 * text twice on screen. So the headline cannot be made selectable, translatable
 * or crawlable by editing this component - that is a property of the approved
 * artwork, which is not to be regenerated.
 *
 * What IS missing, and what this band adds, is the thing the design brief calls
 * the primary interaction: search, offered three ways, immediately under the
 * artwork rather than below the category grid.
 *
 * THE FORM SUBMITS WITHOUT JAVASCRIPT
 * ----------------------------------
 * `action="/"` with `method="get"` and the input named `q` produces
 * `/?q=<query>`, which is exactly what `app/(public)/page.tsx` already reads:
 *
 *     export default async function HomePage({ searchParams }) {
 *       const initialQuery = firstParam(params.q);
 *
 * So this is a plain GET form. It works with JavaScript disabled, it works before
 * hydration, it is crawlable, and it submits on Enter from any field - with no
 * router, no state and no effect. That is also why the modes that are NOT a
 * free-text query are real links rather than disabled tabs: "by vehicle" is a
 * picker and "by brand" is a list, and pretending they are text fields would
 * send the shopper to a search that cannot possibly match.
 */
export function HeroSearchPanel() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t("search.parts")}
      className="border-t border-[var(--v3-rule)] bg-[var(--v3-page)] py-5 sm:py-7"
    >
      <div className="v3-container">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
          {/* BY PART - the free-text query, and the only mode that can be a
              single field, because part name, part number and HSN all resolve
              through the same `?q=` entry point. */}
          <form action="/" method="get" className="min-w-0" role="search">
            <label htmlFor="hero-part-search" className="v3-label">
              {t("search.byPartNumber")}
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                id="hero-part-search"
                name="q"
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder={t("search.placeholderHero")}
                className="v3-input !min-h-12 flex-1 !text-[0.9375rem]"
              />
              <button
                type="submit"
                className="v3-btn v3-btn-primary v3-focus !min-h-12 shrink-0 !px-6"
              >
                {t("search.parts")}
              </button>
            </div>
          </form>

          {/* BY VEHICLE and BY BRAND - both are navigation, not queries. */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/vehicle-fitment"
              className="v3-chip v3-panel-hover v3-focus !min-h-12 !justify-start !gap-3 !px-4 hover:!border-[var(--v3-brand-line)] hover:!bg-[var(--v3-brand-soft)]"
            >
              <svg
                className="h-5 w-5 shrink-0 text-[var(--v3-brand-ink)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 17h14M6.5 17V9.8L8 6h8l1.5 3.8V17M6.5 12h11"
                />
                <circle cx="8" cy="17.5" r="1.5" />
                <circle cx="16" cy="17.5" r="1.5" />
              </svg>
              <span className="text-sm font-semibold text-[var(--v3-text)]">
                {t("search.byVehicle")}
              </span>
            </Link>

            <Link
              href="/brands"
              className="v3-chip v3-panel-hover v3-focus !min-h-12 !justify-start !gap-3 !px-4 hover:!border-[var(--v3-brand-line)] hover:!bg-[var(--v3-brand-soft)]"
            >
              <svg
                className="h-5 w-5 shrink-0 text-[var(--v3-brand-ink)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.5 9.5 5 4.5h14l1.5 5M4.5 9.5h15v9a1 1 0 01-1 1h-13a1 1 0 01-1-1v-9zM9 19.5v-5h6v5"
                />
              </svg>
              <span className="text-sm font-semibold text-[var(--v3-text)]">
                {t("search.byBrand")}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}