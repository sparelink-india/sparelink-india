import Link from "next/link";
import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import { getServerMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * V2 vehicle fitment index.
 *
 * The progression is stated explicitly in the hero: make -> model ->
 * compatible parts. Below it, each make becomes a labelled band with its own
 * logo plate and model grid.
 *
 * `loadFitmentCatalog()` is the only data source and is untouched. The empty
 * case is a designed state rather than a bare sentence, and the photo-credit
 * note is kept because the vehicle images are Wikimedia-licensed.
 */
export default async function VehicleFitmentPage() {
  const { brands } = await loadFitmentCatalog();
  const messages = await getServerMessages();

  /* Only makes that actually have models get a band. */
  const makes = brands.filter((brand) => brand.models.length > 0);
  const modelCount = makes.reduce((sum, brand) => sum + brand.models.length, 0);

  return (
    <FitmentShell>
      <div className="sl-container sl-container-wide sl-page-main">
        <StorefrontBreadcrumbs
          className="mb-4"
          label={messages["fitment.title"]}
          crumbs={[
            { label: messages["nav.home"], href: "/" },
            { label: messages["fitment.title"] },
          ]}
        />

        {/* ---------- HERO ---------- */}
        <div className="relative overflow-hidden rounded-[var(--sl-radius-lg)] bg-[var(--sl-primary-dark)] px-5 py-9 text-white sm:px-10 sm:py-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 100% at 12% 0%, rgba(226,196,140,0.18) 0%, transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative max-w-2xl">
            <p className="sl-label !text-[var(--sl-gold-soft)]">
              {messages["fitment.kicker"]}
            </p>
            <h1 className="sl-h1 mt-2 !text-white">{messages["fitment.title"]}</h1>
            <p className="sl-body mt-2.5 !text-white/75">
              {messages["fitment.hint"]}
            </p>

            {/* Progression, stated rather than implied. */}
            <ol className="mt-6 flex flex-wrap items-center gap-2">
              {(
                [
                  ["fitment.stepMake", messages["fitment.stepMake"]],
                  ["fitment.stepModel", messages["fitment.stepModel"]],
                  ["fitment.stepParts", messages["fitment.compatibleParts"]],
                ] as const
              ).map(([key, label], index) => (
                <li key={key} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span className="text-white/35" aria-hidden>
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 rounded-[var(--sl-radius-sm)] border border-white/20 bg-white/10 px-2.5 py-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[0.625rem] font-bold tabular-nums">
                      {index + 1}
                    </span>
                    <span className="sl-nav !text-white/85">{label}</span>
                  </span>
                </li>
              ))}
            </ol>

            {/* Real counts from the loaded catalogue, not invented figures. */}
            {makes.length > 0 ? (
              <p className="sl-small mt-5 !text-white/55">
                {makes.length} {messages["fitment.makes"]} &middot; {modelCount}{" "}
                {messages["fitment.models"]}
              </p>
            ) : null}
          </div>
        </div>

        {/* ---------- MAKES ---------- */}
        {makes.length === 0 ? (
          <div className="mt-8 rounded-[var(--sl-radius)] border border-dashed border-[var(--sl-border-strong)] bg-white px-6 py-12 text-center">
            <p className="sl-h3">{messages["fitment.empty"]}</p>
            <p className="sl-body mt-2">{messages["fitment.emptyBody"]}</p>
            <Link href="/category/filters" className="sl-v2-btn sl-v2-btn-primary mt-5">
              {messages["fitment.browseCatalogue"]}
            </Link>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {makes.map((brand) => (
              <FitmentModelGrid
                key={brand.slug}
                brand={brand}
                compatiblePartsLabel={messages["fitment.compatibleParts"]}
              />
            ))}
          </div>
        )}

        {/* Photo provenance is retained: the vehicle images are CC-licensed. */}
        <p className="sl-small mt-12 border-t border-[var(--sl-border)] pt-5">
          {messages["fitment.photoCredits"]}
        </p>
      </div>
    </FitmentShell>
  );
}
