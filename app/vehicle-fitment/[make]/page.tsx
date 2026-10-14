import { notFound } from "next/navigation";

import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { findFitmentBrand } from "@/lib/vehicle-fitment";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Vehicle-fitment MAKE page (Precision).
 *
 * THE COMPOSITION CHANGED. The first pass framed the make as a compact
 * identity header — a logo plate, the make name and a "N models" pill —
 * sitting above the model grid. That block was a `<header>`, which made this
 * the only route in the storefront carrying two `<header>` elements: the site
 * header from `FitmentShell` plus this one. Two banners on one page means a
 * screen reader announces the landmark twice and gives the customer no way to
 * tell which is the page's own heading. The breadcrumb directly above already
 * carries the route hierarchy, so the element is a plain `<div>` and the site
 * header remains the only banner landmark on the route.
 *
 * It is the head device rebuilt from Precision primitives — a hairline plus
 * the 3px brand rule as an explicit element — and the count is a figure
 * (`.sl-num` over `.sl-metric-label`) rather than a pill, matching the count
 * treatment on the fitment index and the cart.
 *
 * `FitmentShell` already renders the site `<header>`, the `<main>` that owns
 * the page, the footer and the mobile nav, so this route contributes content
 * only. It must not add a second `<main>` or a second `<header>`.
 *
 * The block deliberately does NOT repeat the make logo or the model count:
 * `FitmentModelGrid`'s make band owns both (it renders the logo, the make name
 * as its section heading and the model count against `modelsLabel`). Repeating
 * them here would stack two identical logos and state the model count twice
 * within a few lines. What this block adds is the figure the customer actually
 * came for — how many catalogue parts the make covers in total — computed from
 * the same `loadFitmentCatalog()` data the grid reads, exactly as the fitment
 * index computes its own totals. No new data source and no new API.
 *
 * Heading order is h1 (this page's make) then h2 (the grid's make band), which
 * is the same nesting the fitment index uses between its page title and its
 * per-make bands.
 */
export default async function FitmentMakePage({
  params,
}: {
  params: Promise<{ make: string }>;
}) {
  const { make } = await params;
  const { brands } = await loadFitmentCatalog();
  const brand = findFitmentBrand(brands, make);
  if (!brand) notFound();
  const messages = await getServerMessages();

  /* The page-level figure: catalogue parts across every model of this make.
     `partCount` is already carried on each model, so this is a sum over the
     data the grid is about to render, not a second query. */
  const partCount = brand.models.reduce(
    (sum, model) => sum + model.partCount,
    0,
  );

  return (
    <FitmentShell>
      <div className="sl-container sl-page-main">
        <StorefrontBreadcrumbs
          className="mb-4"
          label={messages["fitment.title"]}
          crumbs={[
            { label: messages["nav.home"], href: "/" },
            { label: messages["fitment.title"], href: "/vehicle-fitment" },
            { label: brand.make },
          ]}
        />

        {/* Page identity, NOT a banner landmark. A plain <div> on purpose: see
            the note above. `FitmentShell`'s site header is the only banner. */}
        <div className="mb-5 flex flex-wrap items-baseline gap-x-3 border-b border-[var(--sl-rule)] pb-3">
          <span
            aria-hidden
            className="w-[3px] shrink-0 self-stretch bg-[var(--sl-brand)]"
          />
          <h1 className="sl-display min-w-0">{brand.make}</h1>
          <span className="ml-auto flex shrink-0 items-baseline gap-2">
            <span className="sl-num text-[1.25rem] font-extrabold leading-none text-[var(--sl-ink)]">
              {partCount}
            </span>
            <span className="sl-metric-label !text-[0.5625rem]">
              {messages["fitment.parts"]}
            </span>
          </span>
        </div>

        <FitmentModelGrid
          brand={brand}
          compatiblePartsLabel={messages["fitment.compatibleParts"]}
          modelsLabel={messages["fitment.models"]}
          partsLabel={messages["fitment.parts"]}
        />

        {/* Photo provenance is retained: the vehicle images are CC-licensed. */}
        <p className="sl-small mt-12 border-t border-[var(--sl-rule)] pt-5">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
