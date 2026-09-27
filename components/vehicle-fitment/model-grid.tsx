import Image from "next/image";
import Link from "next/link";

import type { FitmentBrand } from "@/lib/vehicle-fitment";

/**
 * One make band on the fitment index: a logo plate + make name header, then
 * the model grid.
 *
 * Image treatment: a single `aspect-[16/10]` well for every model, `object-contain`
 * on a clean sunk surface. The previous version used a burgundy gradient wash
 * behind each photo, which tinted the vehicle photography and made the grid look
 * inconsistent depending on the source image.
 */
export function FitmentModelGrid({
  brand,
  compatiblePartsLabel,
}: {
  brand: FitmentBrand;
  compatiblePartsLabel: string;
}) {
  return (
    <section aria-labelledby={`make-${brand.slug}`}>
      <div className="flex items-center gap-4 border-b border-[var(--sl-border)] pb-4">
        {brand.logo ? (
          <div className="fitment-logo-plate relative h-11 w-32 shrink-0 sm:w-40">
            <Image
              src={brand.logo}
              alt={`${brand.make} logo`}
              width={320}
              height={96}
              className="h-full w-full object-contain object-left"
              unoptimized
            />
          </div>
        ) : null}
        <h2 id={`make-${brand.slug}`} className="sl-h2">
          {brand.make}
        </h2>
        <span className="sl-v2-badge ml-auto shrink-0">
          {brand.models.length}
        </span>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {brand.models.map((model) => (
          <li key={model.modelSlug} className="min-w-0">
            <Link
              href={`/vehicle-fitment/${brand.slug}/${model.modelSlug}`}
              className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex h-full flex-col overflow-hidden"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--sl-surface-sunk)]">
                <Image
                  src={model.photo || "/images/vehicles/placeholder.svg"}
                  alt={model.photo ? model.model : `${model.model} photo unavailable`}
                  width={640}
                  height={400}
                  className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
                  unoptimized
                />
              </div>

              <div className="flex flex-1 flex-col p-3">
                <span className="sl-h3 transition-colors duration-200 group-hover:text-[var(--sl-primary)]">
                  {model.model}
                </span>
                {model.partCount > 0 ? (
                  <span className="sl-v2-badge sl-v2-badge-brand mt-2 w-fit">
                    {compatiblePartsLabel}: {model.partCount}
                  </span>
                ) : (
                  <span className="sl-small mt-2">—</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
