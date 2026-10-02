import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { findFitmentBrand } from "@/lib/vehicle-fitment";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";
import { routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* Data-driven, exactly like the page body: the make comes from the fitment
   catalogue, never from the URL string, so the title can never advertise a
   vehicle the route then 404s on. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string }>;
}): Promise<Metadata> {
  const { make } = await params;
  const { brands } = await loadFitmentCatalog();
  const brand = findFitmentBrand(brands, make);
  // `FitmentBrand` carries the display name as `make`, not `name`; slug is what
  // the URL segment matched, so it stays out of the title.
  const name = brand?.make ?? make;

  return routeMetadata({
    path: `/vehicle-fitment/${make}`,
    title: `${name} Spare Parts - Compatible Parts by Model`,
    description: `Browse genuine spare parts for every ${name} model on SpareLink India, filtered to the parts that actually fit your vehicle.`,
  });
}

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

  return (
    <FitmentShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-500">
          <Link href="/vehicle-fitment" className="hover:underline">
            {messages["fitment.title"]}
          </Link>
        </p>
        <FitmentModelGrid
          brand={brand}
          compatiblePartsLabel={messages["fitment.compatibleParts"]}
        />
        <p className="mt-12 text-xs leading-relaxed text-slate-500">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
