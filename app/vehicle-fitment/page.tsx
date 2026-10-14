import { FitmentModelGrid } from "@/components/vehicle-fitment/model-grid";
import { FitmentShell } from "@/components/vehicle-fitment/fitment-shell";
import { StorefrontBreadcrumbs } from "@/components/storefront-breadcrumbs";
import { EmptyState } from "@/components/page-states";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import type { FitmentBrand } from "@/lib/vehicle-fitment";
import { getServerMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Find Spare Parts by Vehicle",
  description:
    "Choose your make, model and variant to see the exact spare parts that fit your vehicle, from Ambaji Traders, Hind Motors and India Sales.",
  path: "/vehicle-fitment",
});

/**
 * How many vehicle images this page may preload. Sized to roughly the first
 * visible row: 4 tiles on a desktop four-column grid, 2 on a phone. Every other
 * vehicle image on the page is lazy, so initial load never pulls the whole
 * catalogue.
 */
const FIRST_ROW_IMAGE_BUDGET = 4;

/**
 * Vehicle fitment index (Precision).
 *
 * THE COMPOSITION CHANGED. The first pass opened the page with a full-width
 * burgundy gradient panel roughly 300px tall carrying a title, a paragraph and
 * three "step" pills, then scrolled on to the make bands. That panel was the
 * single largest decorative block on the site, it pushed the actual vehicle
 * data below the fold on a laptop, and its only interactive content was a
 * static progression diagram the customer could not use.
 *
 * The current composition is a catalogue index with a working navigation
 * mechanism:
 *
 *   IDENTITY     breadcrumb, title and the real catalogue totals set as figures
 *                on a hairline. No panel, no gradient, no dead height. The
 *                totals are `.sl-metric-label` + `.sl-num`, the same figure
 *                treatment every migrated surface uses.
 *   MAKE SELECTOR
 *                a sticky rail of make logos. This is the "strong make
 *                selector" the page was missing: it is the only element on the
 *                page that jumps, it works from a 375px screen upward, and it
 *                is generated from the makes that actually have models, so it
 *                can never offer a link that leads nowhere.
 *   MAKE BANDS   one band per make, each with its model grid.
 *
 * The MAKE -> MODEL -> PARTS progression is no longer drawn. It is implied by
 * the structure — a make rail above a list of makes above a grid of models,
 * each of which opens parts — and a diagram of the site's own navigation is
 * noise to anyone who is already using it.
 *
 * `loadFitmentCatalog()` remains the only data source and is untouched. Every
 * count below is computed from what it returns. The empty state is still a
 * designed state (`.sl-panel` + `.sl-state` via the shared `EmptyState`), and
 * the Wikimedia photo credit is retained because the vehicle images are
 * CC-licensed.
 */
export default async function VehicleFitmentPage() {
  const { brands } = await loadFitmentCatalog();
  const messages = await getServerMessages();

  /* Only makes that actually have models get a band or a rail entry. */
  const makes = brands.filter((brand) => brand.models.length > 0);
  const modelCount = makes.reduce((sum, brand) => sum + brand.models.length, 0);
  const partCount = makes.reduce(
    (sum, brand) =>
      sum + brand.models.reduce((inner, model) => inner + model.partCount, 0),
    0,
  );

  /* One shared preload budget for the whole page, spent band by band from the
     top. The index stacks every make, so only the first few tiles are near the
     fold; giving each band its own budget would preload every vehicle on the
     site. Bands past the budget scroll in and load normally.

     Computed up front rather than with a running counter inside the render, so
     it is a pure function of the catalogue rather than hidden render state. */
  const bands = makes.reduce<Array<{ brand: FitmentBrand; priorityCount: number }>>(
    (accumulator, brand) => {
      const spent = accumulator.reduce(
        (sum, item) => sum + item.brand.models.length,
        0,
      );
      accumulator.push({
        brand,
        priorityCount: Math.max(0, FIRST_ROW_IMAGE_BUDGET - spent),
      });
      return accumulator;
    },
    [],
  );

  return (
    <FitmentShell>
      <div className="sl-page-main">
        <div className="sl-container">
          <StorefrontBreadcrumbs
            className="mb-4"
            label={messages["fitment.title"]}
            crumbs={[
              { label: messages["nav.home"], href: "/" },
              { label: messages["fitment.title"] },
            ]}
          />

          {/* ---------- IDENTITY + REAL TOTALS ----------
              The head device is rebuilt from Precision primitives: a hairline,
              the 3px brand rule (now an explicit element so it survives in a
              flex row that may wrap) and the totals as figures. */}
          <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-4 border-b border-[var(--sl-rule)] pb-3">
            <span
              aria-hidden
              className="w-[3px] shrink-0 self-stretch bg-[var(--sl-brand)]"
            />
            <h1 className="sl-display min-w-0">{messages["fitment.title"]}</h1>
            {makes.length > 0 ? (
              <span className="ml-auto flex shrink-0 items-baseline gap-4 sm:gap-6">
                <span className="text-right">
                  <span className="sl-num block text-[1.25rem] font-extrabold leading-none text-[var(--sl-ink)]">
                    {makes.length}
                  </span>
                  <span className="sl-metric-label mt-1 block !text-[0.5625rem]">
                    {messages["fitment.makes"]}
                  </span>
                </span>
                <span className="text-right">
                  <span className="sl-num block text-[1.25rem] font-extrabold leading-none text-[var(--sl-ink)]">
                    {modelCount}
                  </span>
                  <span className="sl-metric-label mt-1 block !text-[0.5625rem]">
                    {messages["fitment.models"]}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="sl-num block text-[1.25rem] font-extrabold leading-none text-[var(--sl-brand-ink)]">
                    {partCount}
                  </span>
                  <span className="sl-metric-label mt-1 block !text-[0.5625rem]">
                    {messages["fitment.parts"]}
                  </span>
                </span>
              </span>
            ) : null}
          </div>
          <p className="sl-body mt-3 max-w-2xl">{messages["fitment.hint"]}</p>
        </div>

        {makes.length === 0 ? (
          <div className="sl-container">
            <div className="mt-8">
              <EmptyState
                title={messages["fitment.empty"]}
                body={messages["fitment.emptyBody"]}
                action={{
                  href: "/category/filters",
                  label: messages["fitment.browseCatalogue"],
                }}
              />
            </div>
          </div>
        ) : (
          <>
            {/* ---------- MAKE SELECTOR ----------
                Sticky, so the customer can jump to another make without
                scrolling back to the top. Horizontally scrollable on a phone
                rather than wrapping to three rows. */}
            <nav
              className="sticky top-[var(--v3-header-h)] z-20 mt-6 border-y border-[var(--sl-rule)] bg-[var(--sl-page)]/95 backdrop-blur"
              aria-label={messages["fitment.stepMake"]}
            >
              <div className="sl-container">
                <ul className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 py-2">
                  {makes.map((brand) => (
                    <li key={brand.slug} className="shrink-0">
                      <a
                        href={`#make-${brand.slug}`}
                        className="sl-focus group flex h-11 min-w-[5.5rem] flex-col items-center justify-center gap-1 rounded-[var(--sl-r-xs)] border border-transparent px-2.5 transition-colors hover:border-[var(--sl-brand-line)] hover:bg-[var(--sl-brand-soft)]"
                      >
                        {brand.logo ? (
                          <span className="relative h-4 w-12">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={brand.logo}
                              alt=""
                              width={96}
                              height={32}
                              className="h-full w-full object-contain"
                            />
                          </span>
                        ) : null}
                        <span className="sl-metric-label sl-clamp-1 !text-[0.5rem] transition-colors group-hover:text-[var(--sl-brand-ink)]">
                          {brand.make}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            {/* ---------- MAKE BANDS ----------
                `priorityCount` is a global budget shared across the whole page,
                not a per-band count: the index stacks every make, so only the
                first few tiles are anywhere near the fold. Handing each band
                its own budget would preload every vehicle on the site, which is
                the thing this budget exists to prevent. Later bands scroll in
                and load normally. */}
            <div className="sl-container">
              <div className="space-y-10 py-8">
                {bands.map(({ brand, priorityCount }) => (
                  <FitmentModelGrid
                    key={brand.slug}
                    brand={brand}
                    compatiblePartsLabel={messages["fitment.compatibleParts"]}
                    modelsLabel={messages["fitment.models"]}
                    partsLabel={messages["fitment.parts"]}
                    priorityCount={priorityCount}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Photo provenance is retained: the vehicle images are CC-licensed. */}
        <div className="sl-container">
          <p className="sl-small border-t border-[var(--sl-rule)] py-5">
            {messages["fitment.photoCredits"]}
          </p>
        </div>
      </div>
    </FitmentShell>
  );
}
