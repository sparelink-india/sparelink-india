import Image from "next/image";
import Link from "next/link";

import type { FitmentBrand } from "@/lib/vehicle-fitment";

export function FitmentModelGrid({
  brand,
  compatiblePartsLabel,
}: {
  brand: FitmentBrand;
  compatiblePartsLabel: string;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-4 border-b border-[var(--v3-rule)] pb-4">
        {brand.logo ? (
          <div className="fitment-logo-plate relative h-12 w-36 shrink-0 sm:w-40">
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
        <h2 className="text-xl font-bold tracking-tight text-[var(--v3-text)] sm:text-2xl">
          {brand.make}
        </h2>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {brand.models.map((model) => (
          <Link
            key={model.modelSlug}
            href={`/vehicle-fitment/${brand.slug}/${model.modelSlug}`}
            className="card-hover group overflow-hidden rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] text-left "
          >
            <div className="aspect-[16/10] bg-[var(--v3-sunk)]">
              <Image
                src={model.photo || "/images/vehicles/placeholder.svg"}
                alt={
                  model.photo
                    ? model.model
                    : `${model.model} photo unavailable`
                }
                width={640}
                height={400}
                className="h-full w-full object-contain"
                unoptimized
              />
            </div>
            <div className="p-3">
              <p className="font-bold text-[var(--v3-text)]">{model.model}</p>
              {model.partCount > 0 ? (
                <p className="mt-1 text-xs text-[var(--v3-text-3)]">
                  {compatiblePartsLabel}: {model.partCount}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
