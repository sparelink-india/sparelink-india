import { notFound } from "next/navigation";
import Image from "next/image";

import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
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
      <div className="sl-container sl-container-wide sl-page-main">
        <StorefrontBreadcrumbs
          className="mb-4"
          label={messages["fitment.title"]}
          crumbs={[
            { label: messages["nav.home"], href: "/" },
            { label: messages["fitment.title"], href: "/vehicle-fitment" },
            { label: brand.make },
          ]}
        />
        {/*
          V2 make page. A compact identity header (logo plate + make + real
          model count) sits above the same FitmentModelGrid, so a user who
          deep-links to a make still gets the make context and a way back. The
          breadcrumb above already carries the route hierarchy.
        */}
        <header className="mb-6 flex flex-wrap items-center gap-4 rounded-[var(--sl-radius)] border border-[var(--sl-border)] bg-white p-4 sm:p-5">
          {brand.logo ? (
            <div className="fitment-logo-plate relative h-10 w-28 shrink-0 sm:w-36">
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
          <div className="min-w-0">
            <p className="sl-label">{messages["fitment.stepMake"]}</p>
            <h1 className="sl-h1 mt-1">{brand.make}</h1>
          </div>
          <span className="sl-v2-badge sl-v2-badge-brand ml-auto shrink-0">
            {brand.models.length} {messages["fitment.models"]}
          </span>
        </header>

        <FitmentModelGrid
          brand={brand}
          compatiblePartsLabel={messages["fitment.compatibleParts"]}
        />
        <p className="sl-small mt-12 border-t border-[var(--sl-border)] pt-5">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
