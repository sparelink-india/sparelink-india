import Image from "next/image";
import Link from "next/link";

import { VehicleModelImage } from "@/components/vehicle-fitment/vehicle-model-image";
import type { FitmentBrand } from "@/lib/vehicle-fitment";

/**
 * Fitment model tile and make band (Precision).
 *
 * The first pass rendered each model as a tall card: a 16:10 photo well, then
 * the model name, then a burgundy pill reading "Compatible parts: 42" — a
 * badge for a single number. Ten models produced a grid of ~340px-tall boxes
 * where the photography, which is the only thing that identifies a vehicle,
 * occupied less than half the tile.
 *
 * The current form is a catalogue entry:
 *
 *   THE PHOTO CARRIES THE WEIGHT   a taller well, and the model name sits on a
 *                                  ruled footer rather than floating in a card
 *   THE COUNT IS A FIGURE, NOT A BADGE
 *                                  a part count is a number, so it is set in
 *                                  tabular figures (`.sl-num`) against a
 *                                  tracked label (`.sl-metric-label`) on the
 *                                  right of the footer. A pill for one number
 *                                  was the single most badge-like element on
 *                                  the page.
 *   ZERO IS STATED, NOT DASHED OUT
 *                                  the first pass printed a corrupted em-dash
 *                                  for models with no catalogue parts, which
 *                                  read as a rendering fault. This states it
 *                                  plainly.
 *
 * The make band keeps its logo plate but presents the model count as a figure
 * with a label, matching the count treatment on the category and search pages.
 * Its head is built from Precision primitives rather than the legacy V3 head
 * class: a hairline, and the 3px brand rule as an explicit element so it
 * survives the flex row wrapping at 430px.
 */
export function FitmentModelGrid({
  brand,
  compatiblePartsLabel,
  modelsLabel,
  partsLabel,
  priorityCount = 4,
}: {
  brand: FitmentBrand;
  compatiblePartsLabel: string;
  /** Short count labels, threaded from the server-rendered i18n dictionary so
   *  the Hindi fitment page shows Devanagari rather than an English word. */
  modelsLabel: string;
  partsLabel: string;
  /** How many of this make's images to load eagerly. Only the first visible
   *  row is worth preloading; everything below it is lazy so the page does not
   *  pull every vehicle's full-resolution file on initial load. */
  priorityCount?: number;
}) {
  const eager = Math.max(0, priorityCount);

  return (
    <section aria-labelledby={`make-${brand.slug}`}>
      {/* ---- make band ---- */}
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 border-b border-[var(--sl-rule)] pb-3">
        <span
          aria-hidden
          className="w-[3px] shrink-0 self-stretch bg-[var(--sl-brand)]"
        />
        {brand.logo ? (
          <span className="relative -my-1 h-9 w-24 shrink-0 sm:h-10 sm:w-32">
            <Image
              src={brand.logo}
              alt={`${brand.make} logo`}
              width={320}
              height={96}
              className="h-full w-full object-contain object-left"
              unoptimized
            />
          </span>
        ) : null}
        <h2 id={`make-${brand.slug}`} className="sl-h2">
          {brand.make}
        </h2>
        <span className="ml-auto flex shrink-0 items-baseline gap-1.5">
          <span className="sl-num text-[1.125rem] font-extrabold leading-none text-[var(--sl-ink)]">
            {brand.models.length}
          </span>
          <span className="sl-metric-label !text-[0.625rem]">{modelsLabel}</span>
        </span>
      </div>

      {/* ---- model grid ----
          2 / 3 / 4 columns (an explicit ramp rather than `.sl-grid-4`, whose
          1 / 2 / 4 collapse would drop the phone from two columns to one and
          invalidate the `sizes` hint below). The well is 4:3 rather than 16:10
          because vehicle photography is landscape but the crop needs headroom,
          and 16:10 was cutting the roofline off several of the sourced
          images. */}
      <ul className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
        {brand.models.map((model, index) => (
          <li key={model.modelSlug} className="min-w-0">
            <Link
              href={`/vehicle-fitment/${brand.slug}/${model.modelSlug}`}
              className="sl-panel sl-focus group flex h-full flex-col overflow-hidden transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
            >
              <div className="sl-panel-sunk relative aspect-[4/3] w-full overflow-hidden">
                <VehicleModelImage
                  model={model}
                  priority={index < eager}
                  sizes="(min-width: 1024px) 280px, (min-width: 768px) 220px, 45vw"
                  className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </div>

              {/* Ruled footer: identity left, catalogue count right. */}
              <div className="mt-auto flex items-end justify-between gap-2 border-t border-[var(--sl-rule)] px-3 py-2.5">
                <span className="sl-clamp-2 min-w-0 text-[0.9375rem] font-semibold leading-snug text-[var(--sl-ink)] transition-colors group-hover:text-[var(--sl-brand-ink)]">
                  {model.model}
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`sl-num block text-[0.9375rem] font-extrabold leading-none ${
                      model.partCount > 0
                        ? "text-[var(--sl-brand-ink)]"
                        : "text-[var(--sl-ink-3)]"
                    }`}
                  >
                    {model.partCount}
                  </span>
                  <span className="sl-metric-label mt-1 block !text-[0.5rem]">
                    {partsLabel}
                  </span>
                </span>
              </div>

              {/* Screen-reader context for the count, since the visible label
                  is a single word. */}
              <span className="sr-only">
                {compatiblePartsLabel}: {model.partCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
