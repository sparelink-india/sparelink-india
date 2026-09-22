import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FitmentModelCatalogue } from "@/components/vehicle-fitment/model-catalogue";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { findFitmentBrand, findFitmentModel } from "@/lib/vehicle-fitment";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function FitmentModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ make: string; model: string }>;
  searchParams: Promise<{ fuel?: string; variant?: string; page?: string }>;
}) {
  const { make, model } = await params;
  const query = await searchParams;
  const { brands } = await loadFitmentCatalog();
  const brand = findFitmentBrand(brands, make);
  const selected = brand ? findFitmentModel(brand, model) : null;
  if (!brand || !selected) notFound();
  const messages = await getServerMessages();
  const fuel = (query.fuel ?? "").trim();
  const variant = (query.variant ?? "").trim();
  const page = Math.max(1, Number(query.page || "1") || 1);

  return (
    <FitmentShell>
      <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-10">
        <p className="text-sm text-slate-500">
          <Link href="/vehicle-fitment" className="hover:underline">
            {messages["fitment.title"]}
          </Link>
          {" / "}
          <Link href={`/vehicle-fitment/${brand.slug}`} className="hover:underline">
            {brand.make}
          </Link>
        </p>
        <Suspense fallback={<p className="mt-6 text-sm text-slate-500">{messages["common.loading"]}</p>}>
          <FitmentModelCatalogue
            model={selected}
            fuel={fuel}
            variant={variant}
            page={page}
          />
        </Suspense>
        <p className="mt-12 text-xs leading-relaxed text-slate-500">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
