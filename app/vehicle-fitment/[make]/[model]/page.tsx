import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import { FitmentModelCatalogue } from "@/components/vehicle-fitment/model-catalogue";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { findFitmentBrand, findFitmentModel } from "@/lib/vehicle-fitment";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";
import { routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* Resolved from the catalogue rather than the raw URL slug, for the same reason
   the page body does: an unknown make or model must not be advertised in a
   title that the route then answers with a 404. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>;
}): Promise<Metadata> {
  const { make, model } = await params;
  const { brands } = await loadFitmentCatalog();
  const brand = findFitmentBrand(brands, make);
  const selected = brand ? findFitmentModel(brand, model) : null;

  if (!brand || !selected) {
    return routeMetadata({
      path: `/vehicle-fitment/${make}/${model}`,
      title: "Vehicle not found",
      description: "We could not find this vehicle in the SpareLink India catalogue.",
      noIndex: true,
    });
  }

  return routeMetadata({
    path: `/vehicle-fitment/${make}/${model}`,
    // `FitmentModel` names the vehicle `model` and its maker `make`.
    title: `${selected.model} Spare Parts - ${brand.make}`,
    description: `Genuine and quality spare parts compatible with the ${selected.model} from ${brand.make}, at wholesale prices with pan-India delivery.`,
  });
}

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
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
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
