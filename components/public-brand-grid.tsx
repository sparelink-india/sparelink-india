"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import { getBrandDisplayName } from "@/lib/brand-display-names";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { EmptyState, StateIcons } from "@/components/page-states";
import type { PublicBrand } from "@/lib/public-brands";
import { useResolvedBrands } from "@/components/use-resolved-brands";

/**
 * Brand directory used by /brands.
 *
 * V3 presented this directory as an ALPHABETICAL INDEX: a 26-key A-Z rail that
 * jumped to per-letter buckets, plus letter headings, per-letter counts, a
 * relationship segmented filter and a matched-brand tally. With nine brands that
 * produced six single-letter groups and twenty permanently disabled letter keys
 * — an alphabet, dressed as navigation, for a list short enough to read at a
 * glance.
 *
 * It is now a plain brand CATALOGUE:
 *
 *   IDENTITY  page title and the existing lead, unchanged
 *   SEARCH    one "Find a brand" field — the only control on the page
 *   GRID      one card per brand: logo, name, relationship, an approved
 *             description when one exists, and a "View Products" action
 *             pointing at the search query the row always used
 *
 * The letter rail, letter grouping, letter headings, per-letter counts,
 * relationship segmented filter and matched-brand count are removed.
 *
 * `PUBLIC_BRANDS` remains the single source of truth. No brand, logo,
 * relationship, tagline, description or count is invented: the grid renders
 * without a description block because no approved copy exists yet, and the
 * destination of every card is unchanged.
 */

function relationshipLabel(
  t: (key: "brands.distributor" | "brands.trader") => string,
  brand: PublicBrand,
) {
  if (brand.tagline) return brand.tagline;
  return brand.relationship === "trader" ? t("brands.trader") : t("brands.distributor");
}

export function PublicBrandDirectory({
  onSelect,
}: {
  onSelect?: (query: string) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  /* The registry merged with the admin's presentation overrides. Shared with the
     homepage grid so the two can never disagree about what a brand looks like,
     and it falls back to the static registry rather than depending on the
     fetch. See the hook for the full reasoning. */
  const brands = useResolvedBrands();

  /**
   * Same matching rule as before — brand name or relationship/tagline — so the
   * search behaves exactly as it did. Only the grouping and the extra controls
   * were removed; the result is one flat, alphabetised list.
   */
  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((brand) => {
      const tagline = relationshipLabel(t, brand);
      return (
        brand.name.toLowerCase().includes(needle) ||
        tagline.toLowerCase().includes(needle)
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, t, brands]);

  return (
    <div>
      {/* ---------- SEARCH ----------
          The only control on the page. It keeps the ruled bar the letter rail
          and the segmented filter used to share, so the section rhythm above
          and below it is unchanged — one hairline, compact vertical padding. */}
      <div className="border-y border-[var(--v3-rule)] py-3">
        <label htmlFor="brand-filter" className="v3-label mb-1.5 block">
          {t("brands.filterLabel")}
        </label>
        <input
          id="brand-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("brands.filterPlaceholder")}
          className="v3-input max-w-sm"
        />
      </div>

      {/* ---------- DIRECTORY ---------- */}
      {matched.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={StateIcons.search}
            title={t("brands.noMatchTitle")}
            body={t("brands.noMatchBody")}
            action={{ href: "/", label: t("search.catalog") }}
          />
        </div>
      ) : (
        /* ---------- GRID ----------
           One card per brand. Columns: 1 on mobile, 2 on tablet, 3 on a
           standard laptop and 4 on a wide desktop. Hairline-ruled panels with
           the shared 3px radius and a restrained lift on hover — no oversized
           radius, no gradient, no pill badge. */
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matched.map((brand) => {
            const href = `/?q=${encodeURIComponent(brand.searchQuery)}`;
            const tagline = relationshipLabel(t, brand);
            /* Display name only. The href above still uses `searchQuery`, the
               exact string Typesense and the catalogue match on, so switching to
               Hindi changes what a customer READS and never what a search
               MATCHES. */
            const displayName = getBrandDisplayName(brand.name, locale);
            const label = `${displayName}, ${tagline}`;

            const shell =
              "v3-panel v3-panel-hover group flex h-full w-full flex-col p-3.5 text-left";

            const inner = (
              <>
                {/* Fixed 64px well on the shared sunken stage, so wordmarks of
                    any proportion sit on one consistent block. */}
                <span className="v3-sunk relative block h-16 w-full overflow-hidden">
                  <Image
                    src={brand.logo}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 40vw, 90vw"
                    className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-[1.04]"
                    unoptimized
                  />
                </span>

                <span className="mt-3 block">
                  <span className="v3-nav v3-clamp-1 block text-[var(--v3-text)] transition-colors group-hover:text-[var(--v3-brand-ink)]">
                    {displayName}
                  </span>
                  <span className="v3-small mt-1 block">{tagline}</span>
                </span>

                {/* Rendered only when approved copy exists. No brand is given
                    one today, so the card simply stops after the relationship
                    line rather than being padded to a fixed height. A tagline
                    is a relationship label, never a description. */}
                {brand.description ? (
                  <span className="v3-small v3-clamp-2 mt-2 block">
                    {brand.description}
                  </span>
                ) : null}

                {/* The action points at the same search query the old row did,
                    so clicking the card is byte-for-byte identical behaviour. */}
                <span className="mt-auto flex items-center gap-1.5 border-t border-[var(--v3-rule)] pt-3 text-[0.8125rem] font-semibold text-[var(--v3-brand-ink)]">
                  {t("brands.viewProducts")}
                  <svg
                    className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
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
      )}
    </div>
  );
}

/**
 * Compact tile grid used on the homepage, where the filter UI and the A-Z rail
 * would be noise.
 *
 * Denser than V2: a 3/4/6-column grid of 64px logo tiles with the name
 * underneath, no relationship badge (the relationship is stated in the section
 * lead and on /brands). Ten brands now occupy 2 rows at 1280px rather than 2
 * rows of 180px-tall cards.
 */
export function PublicBrandGrid({
  onSelect,
}: {
  onSelect?: (query: string) => void;
}) {
  const { t, locale } = useI18n();
  /* Same override-aware source as the /brands directory. The homepage grid and
     the brands page used to read the registry independently, which is how a
     storefront ends up showing a brand name the admin never saved. */
  const brands = useResolvedBrands();

  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
      {brands.map((brand) => {
        const href = `/?q=${encodeURIComponent(brand.searchQuery)}`;
        const tagline = relationshipLabel(t, brand);
        const displayName = getBrandDisplayName(brand.name, locale);
        const label = `${displayName}, ${tagline}`;

        const shell =
          "v3-panel v3-panel-hover group flex h-full w-full flex-col items-center justify-center gap-2 px-2 py-3 text-center";

        const inner = (
          <>
            <span className="relative h-11 w-full shrink-0">
              <Image
                src={brand.logo}
                alt=""
                fill
                sizes="88px"
                className="object-contain transition-transform duration-300 group-hover:scale-[1.06]"
                unoptimized
              />
            </span>
            {/* Brand name.

                This was `v3-label !text-[0.5625rem]`, i.e. 9px, uppercase,
                letter-spaced 0.14em, clamped to two lines. All four of those
                were wrong for the job:

                  9px        unreadable on a phone and marginal on a laptop
                  uppercase   a no-op for Devanagari, and brand wordmarks are
                             proper nouns that should not be shouted
                  0.14em     the worst attribute here: Devanagari is an
                             abugida, so inter-character tracking pulls the
                             matra and the consonant apart and makes
                             conjuncts look misspelled
                  clamp-2    a two-word brand was being silently truncated

                So the size is now stepped per breakpoint rather than fixed, the
                tracking/case utilities are dropped in favour of the plain body
                treatment, and the line-height is generous enough that the
                Devanagari ascenders and the descenders of ज/ड/ष are not
                clipped. Two lines are still allowed, because
                "शिवाजी इंडस्ट्रीज़ / सिप्पी" genuinely needs them - the fix
                is legibility, not truncation. */}
            <span className="v3-clamp-2 block text-[0.8125rem] font-semibold leading-[1.5] tracking-normal text-[var(--v3-text)] transition-colors group-hover:text-[var(--v3-brand-ink)] sm:text-[0.875rem] lg:text-[0.9375rem]">
              {displayName}
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
      className="v3-band border-b border-[var(--v3-rule)] bg-white"
      aria-labelledby={headingId}
    >
      <div className="v3-container">
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
        {/* Burgundy left rule + hairline, the V3 section-heading device. */}
        <div className="v3-head">
          <Heading id={headingId} className="v3-h2">
            {t("brands.heading")}
          </Heading>
          <p className="v3-small ml-auto hidden max-w-md text-right md:block">
            {t("brands.lead")}
          </p>
          <Link
            href="/brands"
            className="v3-btn v3-btn-quiet v3-btn-sm ml-auto shrink-0 md:ml-0"
          >
            {t("nav.brands")}
          </Link>
        </div>
        <p className="v3-body mt-3 max-w-2xl md:hidden">{t("brands.lead")}</p>
        <div className="mt-5">
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
    <section id="brands" className="v3-band" aria-labelledby="brands-page-heading">
      <div className="v3-container">
        <StorefrontBreadcrumbs
          className="mb-4"
          label={t("nav.brands")}
          crumbs={[
            { label: t("nav.home"), href: "/" },
            { label: t("nav.brands") },
          ]}
        />

        {/* Page identity + the directory's own count, stated once. */}
        <div className="v3-head">
          <h1 id="brands-page-heading" className="v3-display">
            {t("brands.heading")}
          </h1>
        </div>
        <p className="v3-body mt-3 max-w-2xl">{t("brands.lead")}</p>

        <div className="mt-6">
          <PublicBrandDirectory />
        </div>
      </div>
    </section>
  );
}

