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
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
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
        <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
          {brand.make}
        </h2>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {brand.models.map((model) => (
          <Link
            key={model.modelSlug}
            href={`/vehicle-fitment/${brand.slug}/${model.modelSlug}`}
            className="card-hover group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xs"
          >
            <div className="aspect-[16/10] bg-slate-100">
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
              <p className="font-bold text-slate-950">{model.model}</p>
              {model.partCount > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
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
