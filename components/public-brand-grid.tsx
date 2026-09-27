"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { EmptyState, StateIcons } from "@/components/page-states";
import { PUBLIC_BRANDS, type PublicBrand } from "@/lib/public-brands";

/**
 * V2 brand directory.
 *
 * This is a directory, not a logo wall. It adds, all derived from the existing
 * PUBLIC_BRANDS array only:
 *   - a text filter over brand name and tagline,
 *   - a relationship filter (distributor / trader) using the real
 *     `relationship` field,
 *   - alphabetical grouping so a long list is scannable,
 *   - a live result count.
 *
 * No brand, logo, relationship or status is invented. `PUBLIC_BRANDS` remains
 * the single source of truth, and every card still links to the same search
 * query it always did.
 */

function relationshipLabel(
  t: (key: "brands.distributor" | "brands.trader") => string,
  brand: PublicBrand,
) {
  if (brand.tagline) return brand.tagline;
  return brand.relationship === "trader" ? t("brands.trader") : t("brands.distributor");
}

/** Uppercase letter an entry files under, or "" for digits/symbols. */
function groupLetter(name: string) {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

type Filter = "all" | "distributor" | "trader";

export function PublicBrandDirectory({
  onSelect,
}: {
  onSelect?: (query: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { groups, total } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = PUBLIC_BRANDS.filter((brand) => {
      if (filter !== "all" && brand.relationship !== filter) return false;
      if (!needle) return true;
      const tagline = relationshipLabel(t, brand);
      return (
        brand.name.toLowerCase().includes(needle) ||
        tagline.toLowerCase().includes(needle)
      );
    }).sort((a, b) => a.name.localeCompare(b.name));

    /* Collapse into alphabetical buckets. */
    const buckets = new Map<string, PublicBrand[]>();
    for (const brand of matched) {
      const letter = groupLetter(brand.name);
      const list = buckets.get(letter) ?? [];
      list.push(brand);
      buckets.set(letter, list);
    }
    return {
      groups: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)),
      total: matched.length,
    };
  }, [query, filter, t]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("brands.filterAll") },
    { id: "distributor", label: t("brands.distributor") },
    { id: "trader", label: t("brands.trader") },
  ];

  return (
    <div>
      {/* ---------- CONTROLS ---------- */}
      <div className="flex flex-col gap-3 border-b border-[var(--sl-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="brand-filter" className="sl-label mb-1.5 block">
            {t("brands.filterLabel")}
          </label>
          <input
            id="brand-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("brands.filterPlaceholder")}
            className="sl-v2-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={active}
                className={`sl-v2-focus sl-nav min-h-11 rounded-[var(--sl-radius-sm)] border px-3 transition-colors ${
                  active
                    ? "border-[var(--sl-primary)] bg-[var(--sl-primary)] text-white"
                    : "border-[var(--sl-border)] bg-white text-[var(--sl-text-soft)] hover:border-[var(--sl-border-strong)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="sl-small mt-3.5" role="status" aria-live="polite">
        {total} {total === 1 ? t("brands.brand") : t("brands.brands")}
      </p>

      {/* ---------- RESULTS ---------- */}
      {total === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={StateIcons.search}
            title={t("brands.noMatchTitle")}
            body={t("brands.noMatchBody")}
            action={{ href: "/", label: t("search.catalog") }}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(([letter, brands]) => (
            <section key={letter} aria-labelledby={`brand-group-${letter}`}>
              {/* Only rendered when there is more than one bucket, so a short
                  list is not broken up by single-letter headings. */}
              {groups.length > 1 ? (
                <h3
                  id={`brand-group-${letter}`}
                  className="sl-label flex items-center gap-3"
                >
                  <span>{letter}</span>
                  <span className="h-px flex-1 bg-[var(--sl-border)]" aria-hidden />
                </h3>
              ) : null}

              <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {brands.map((brand) => {
                  const href = `/?q=${encodeURIComponent(brand.searchQuery)}`;
                  const tagline = relationshipLabel(t, brand);
                  const label = `${brand.name}, ${tagline}`;
                  const shell =
                    "sl-v2-card sl-v2-card-hover sl-v2-rule group flex h-full w-full flex-col items-center justify-center p-3 text-center";

                  const inner = (
                    <>
                      {/* One fixed logo well for every card, so a wide wordmark
                          and a round mark carry the same optical weight. */}
                      <div className="relative h-12 w-full shrink-0">
                        <Image
                          src={brand.logo}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-contain transition-transform duration-300 group-hover:scale-[1.05]"
                          unoptimized
                        />
                      </div>
                      <span className="sl-nav mt-2.5 block leading-snug text-[var(--sl-text)] transition-colors duration-200 group-hover:text-[var(--sl-primary)]">
                        {brand.name}
                      </span>
                      <span className="sl-v2-badge sl-v2-badge-brand mt-1.5">
                        {tagline}
                      </span>
                    </>
                  );

                  return (
                    <li key={brand.id} className="min-w-0">
                      {onSelect ? (
                        <button
                          type="button"
                          aria-label={label}
                          className={shell}
                          onClick={() => onSelect(brand.searchQuery)}
                        >
                          {inner}
                        </button>
                      ) : (
                        <Link href={href} aria-label={label} className={shell}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact grid used on the homepage, where the filter UI would be noise. */
export function PublicBrandGrid({
  onSelect,
}: {
  onSelect?: (query: string) => void;
}) {
  const { t } = useI18n();

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {PUBLIC_BRANDS.map((brand) => {
        const href = `/?q=${encodeURIComponent(brand.searchQuery)}`;
        const tagline = relationshipLabel(t, brand);
        const label = `${brand.name}, ${tagline}`;
        const shell =
          "sl-v2-card sl-v2-card-hover sl-v2-rule group flex h-full w-full flex-col items-center justify-center p-3 text-center";

        const inner = (
          <>
            <div className="relative h-12 w-full shrink-0">
              <Image
                src={brand.logo}
                alt=""
                fill
                sizes="96px"
                className="object-contain transition-transform duration-300 group-hover:scale-[1.05]"
                unoptimized
              />
            </div>
            <span className="sl-nav mt-2.5 block leading-snug text-[var(--sl-text)] transition-colors duration-200 group-hover:text-[var(--sl-primary)]">
              {brand.name}
            </span>
            <span className="sl-v2-badge sl-v2-badge-brand mt-1.5">{tagline}</span>
          </>
        );

        return (
          <li key={brand.id} className="min-w-0">
            {onSelect ? (
              <button
                type="button"
                aria-label={label}
                className={shell}
                onClick={() => onSelect(brand.searchQuery)}
              >
                {inner}
              </button>
            ) : (
              <Link href={href} aria-label={label} className={shell}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PublicBrandsSection({
  onSelect,
  headingId = "brands-heading",
  headingLevel = "h2",
  showBreadcrumb = false,
}: {
  onSelect?: (query: string) => void;
  headingId?: string;
  headingLevel?: "h1" | "h2";
  /**
   * The breadcrumb belongs to the dedicated /brands page only. This section is
   * ALSO rendered inside the homepage, where a "Home / Brands" trail is wrong
   * and read as if homepage content had bled into the brands route.
   */
  showBreadcrumb?: boolean;
}) {
  const { t } = useI18n();
  const Heading = headingLevel;

  return (
    <section
      id="brands"
      className="sl-band border-b border-[var(--sl-border)] bg-white"
      aria-labelledby={headingId}
    >
      <div className="sl-container sl-container-wide">
        {showBreadcrumb ? (
          <StorefrontBreadcrumbs
            className="mb-3"
            label={t("nav.brands")}
            crumbs={[
              { label: t("nav.home"), href: "/" },
              { label: t("nav.brands") },
            ]}
          />
        ) : null}
        <div className="max-w-2xl">
          <p className="sl-label">{t("brands.kicker")}</p>
          <Heading id={headingId} className="sl-h2 mt-1.5">
            {t("brands.heading")}
          </Heading>
          <p className="sl-body mt-2">{t("brands.lead")}</p>
        </div>
        <div className="mt-6">
          <PublicBrandGrid onSelect={onSelect} />
        </div>
      </div>
    </section>
  );
}

/** The full directory, used only by /brands. */
export function PublicBrandsDirectorySection() {
  const { t } = useI18n();

  return (
    <section
      id="brands"
      className="sl-band"
      aria-labelledby="brands-page-heading"
    >
      <div className="sl-container sl-container-wide">
        <StorefrontBreadcrumbs
          className="mb-4"
          label={t("nav.brands")}
          crumbs={[
            { label: t("nav.home"), href: "/" },
            { label: t("nav.brands") },
          ]}
        />

        <div className="max-w-2xl">
          <p className="sl-label">{t("brands.kicker")}</p>
          <h1 id="brands-page-heading" className="sl-h1 mt-1.5">
            {t("brands.heading")}
          </h1>
          <p className="sl-body mt-2">{t("brands.lead")}</p>
        </div>

        <div className="mt-6">
          <PublicBrandDirectory />
        </div>
      </div>
    </section>
  );
}
