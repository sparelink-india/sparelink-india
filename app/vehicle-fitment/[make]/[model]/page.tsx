import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FitmentModelCatalogue } from "@/components/vehicle-fitment/model-catalogue";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { findFitmentBrand, findFitmentModel } from "@/lib/vehicle-fitment";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";
import { Skeleton } from "@/components/page-states";
import { T } from "@/components/t";

export const dynamic = "force-dynamic";

/** Skeleton mirroring the real catalogue layout: identity block + part grid. */
function FitmentModelSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <div className="sl-panel p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-24 shrink-0 sm:h-24 sm:w-36" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="sl-panel overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full !rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">
        <T k="states.loadingCompatible" />
      </span>
    </div>
  );
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
      <div className="sl-container sl-page-main">
        <StorefrontBreadcrumbs
          className="mb-4"
          label={messages["fitment.title"]}
          crumbs={[
            { label: messages["nav.home"], href: "/" },
            { label: messages["fitment.title"], href: "/vehicle-fitment" },
            {
              label: brand.make,
              href: `/vehicle-fitment/${brand.slug}`,
            },
            { label: selected.model },
          ]}
        />
        {/*
          A designed skeleton, not a bare "Loading..." string. The catalogue
          streams in behind a Suspense boundary, and the fallback now mirrors its
          real shape (identity block + part grid) so the layout does not jump.
          Each block is the shared `.sl-skel` shimmer inside a `.sl-panel`, the
          same skeleton vocabulary `components/page-states.tsx` uses.
        */}
        <Suspense fallback={<FitmentModelSkeleton />}>
          <FitmentModelCatalogue
            model={selected}
            fuel={fuel}
            variant={variant}
            page={page}
          />
        </Suspense>
        <p className="sl-small mt-12 border-t border-[var(--sl-rule)] pt-5">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
