"use client";

import Link from "next/link";
import { useState } from "react";

import { PublicBrandGrid } from "@/components/public-brand-grid";
import { useI18n } from "@/components/preferences-provider";
import { STOREFRONT_CATEGORIES } from "@/lib/storefront-categories";

/**
 * The full catalogue index at /products.
 *
 * WHAT THIS IS. A browse surface, not a result list. Three axes are always
 * present and never pre-filtered:
 *
 *   1. CATEGORY   every storefront category, from the same registry the
 *                 homepage grid and the /category routes read, so the two can
 *                 never disagree about what a category is.
 *   2. BRAND      the same `PublicBrandGrid` the /brands page uses, so a
 *                 product link from here is byte-identical to one from there.
 *   3. VEHICLE    fitment, which is the third axis and has no equivalent in
 *                 either of the other two.
 *
 * Plus a search field, which hands a typed query to the existing result
 * experience. That is the whole design: a catalogue is a set of axes, and
 * narrowing happens when the shopper narrows, not before.
 *
 * WHY NOT ONE BIG RESULT SET. See the note on the page: the search API
 * rejects an unscoped query on purpose, and changing that is a search-backend
 * change.
 *
 * THE VIEW SWITCHER. It is deliberately NOT here. GRID / TILES / LIST /
 * DETAILED switch how a RESULT SET is drawn, and this page has no result set;
 * adding the control would offer four views of the same twelve category tiles.
 * The switcher appears, as it always has, on the results and category pages.
 */
export function ProductsCatalogue({
  heading,
  lead,
}: {
  heading: string;
  lead: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  return (
    <div className="v3-container py-8 sm:py-10">
      {/* Page identity. The burgundy left rule and hairline are the shared
          section device, so this reads as part of the same system as every
          other V3 heading rather than as a new page type. */}
      <div className="v3-head">
        <h1 className="v3-display">{heading}</h1>
      </div>
      <p className="v3-body mt-3 max-w-3xl">{lead}</p>

      {/* Search. A plain GET form, so it works without JavaScript and the
          result is a real, shareable URL. `role="search"` marks the landmark
          for assistive technology. */}
      <form
        role="search"
        action="/"
        method="get"
        className="mt-6 flex max-w-2xl items-center gap-2"
      >
        <label htmlFor="products-search" className="sr-only">
          {t("search.placeholderHeader")}
        </label>
        <input
          id="products-search"
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholderHeader")}
          className="v3-input flex-1"
        />
        <button type="submit" className="v3-btn v3-btn-primary shrink-0">
          {t("search.parts")}
        </button>
      </form>

      {/* AXIS 1: CATEGORY. The complete set, in registry order, so the order
          matches the homepage and the /category breadcrumbs. */}
      <section className="mt-10" aria-labelledby="products-category-heading">
        <div className="v3-head">
          <h2 id="products-category-heading" className="v3-h2">
            {t("category.categories")}
          </h2>
          <Link
            href="/brands"
            className="v3-btn v3-btn-quiet v3-btn-sm ml-auto shrink-0"
          >
            {t("nav.brands")}
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STOREFRONT_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/category/${category.slug}`}
                className="v3-panel v3-panel-hover group flex h-full flex-col p-3"
              >
                {/* The FRAMED derivative, not the source. The sources are
                    1024x1024 canvases with 33-100% of that area empty around
                    the product, which made every product look small in its
                    tile. `object-contain` is retained on purpose: cover would
                    fill the tile by cutting the product, and on a spares site
                    the customer must see the whole part. */}
                <span className="v3-stage aspect-square w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={category.framedImage}
                    alt=""
                    width={280}
                    height={280}
                    className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="v3-h3 mt-3 block transition-colors group-hover:text-[var(--v3-brand-ink)]">
                  {t(category.nameKey)}
                </span>
                <span className="v3-small mt-1 v3-clamp-2 block">
                  {t(category.descKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* AXIS 2: BRAND. The shared grid, so this and /brands cannot drift. */}
      <section className="mt-12" aria-labelledby="products-brand-heading">
        <div className="v3-head">
          <h2 id="products-brand-heading" className="v3-h2">
            {t("brands.heading")}
          </h2>
          <p className="v3-small ml-auto hidden max-w-md text-right md:block">
            {t("brands.lead")}
          </p>
          <Link href="/brands" className="v3-btn v3-btn-quiet v3-btn-sm ml-auto shrink-0 md:ml-0">
            {t("nav.brands")}
          </Link>
        </div>
        <div className="mt-5">
          <PublicBrandGrid />
        </div>
      </section>

      {/* AXIS 3: VEHICLE. A destination, not a list: fitment is a tree, and
          the tree is browsed on its own route. */}
      <section className="mt-12" aria-labelledby="products-vehicle-heading">
        <div className="v3-head">
          <h2 id="products-vehicle-heading" className="v3-h2">
            {t("nav.fitment")}
          </h2>
        </div>
        <p className="v3-body mt-3 max-w-2xl">{t("fitment.hint")}</p>
        <Link
          href="/vehicle-fitment"
          className="v3-btn v3-btn-outline mt-4"
        >
          {t("nav.fitment")}
        </Link>
      </section>
    </div>
  );
}
