import Link from "next/link";
import { notFound } from "next/navigation";

import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { findFitmentBrand } from "@/lib/vehicle-fitment";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

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
