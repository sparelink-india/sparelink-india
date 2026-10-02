import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { getTelHref } from "@/lib/support-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  path: "/about-us",
  title: "About SpareLink India",
  description:
    "SpareLink India is the digital sales platform of Hind Motors, Ambaji Traders and India Sales, supplying genuine auto spare parts across India.",
});

/**
 * V2 About page — an editorial layout, not a wall of equal-weight headings.
 *
 * Content discipline:
 *  - Every sentence comes from the existing `about.*` messages. Nothing about
 *    years, customer counts, coverage, awards or certifications is stated,
 *    because the project holds no such data.
 *  - The three firms are presented as SEPARATE proprietorship businesses with
 *    their own proprietor and GSTIN, exactly as `about.p3` describes them.
 *    The page never implies they are a single legal entity.
 *  - The old layout rendered three dashed "photograph placeholder" boxes. No
 *    firm photographs exist in the project, so they are removed rather than
 *    replaced with invented imagery; each firm is identified by its real
 *    registration data instead.
 */

const FIRMS = [
  { id: "hind-motors", name: "Hind Motors", proprietor: "Mr. Dharmesh Anand", gstin: "23AARPA8557FZ1M", textKey: "about.hindText" },
  { id: "ambaji-traders", name: "Ambaji Traders", proprietor: "Mr. Ansh Anand", gstin: "23BYNPA1789A1ZQ", textKey: "about.ambajiText" },
  { id: "india-sales", name: "India Sales", proprietor: "Mr. Tanmay Anand", gstin: "23EKAPA4186F1ZL", textKey: "about.indiaText" },
] as const;

const PRINCIPLES = [
  { titleKey: "about.quality", textKey: "about.qualityText" },
  { titleKey: "about.availability", textKey: "about.availabilityText" },
  { titleKey: "about.pricing", textKey: "about.pricingText" },
  { titleKey: "about.service", textKey: "about.serviceText" },
  { titleKey: "about.relations", textKey: "about.relationsText" },
] as const;

/* Contact glyphs. Semantic SVG only. */
function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2.5 6.5L12 13l9.5-6.5" />
    </svg>
  );
}

function FirmMark({ index }: { index: number }) {
  /* A typographic mark built from the firm's real position in the group, not
     a fabricated logo. */
  return (
    <span
      aria-hidden
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] bg-[var(--v3-brand)] text-sm font-extrabold text-white tabular-nums"
    >
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

export default function AboutUsPage() {
  const whatsappHref = getWhatsAppChatUrl();
  const telHref = getTelHref(PUBLIC_SUPPORT_PHONE);

  return (
    <StorefrontShell>
      {/* ---------- PAGE IDENTITY ----------
          No hero panel and no gradient. The V3 head plus a 3px gold rule — the
          one place this page uses gold — and the company record starts
          immediately below. */}
      <div className="v3-head">
        <h1 className="v3-display">
          <T k="about.title" />
        </h1>
        <p className="v3-label ml-auto hidden shrink-0 !text-[0.625rem] sm:block">
          <T k="nav.about" />
        </p>
      </div>
      <p className="v3-body mt-3 max-w-3xl">
        <T k="about.subtitle" />
      </p>

      {/* ---------- INTRODUCTION ---------- */}
      <section className="v3-band" aria-labelledby="about-intro">
        <div className="max-w-[46rem]">
          <h2 id="about-intro" className="sr-only">
            <T k="about.title" />
          </h2>
          {/* The lede gets a burgundy left rule rather than a heading, so the
              three paragraphs read as an opening statement without adding a
              title the page does not have. */}
          <div className="space-y-4 border-l-2 border-[var(--v3-brand)] pl-4 sm:pl-5">
            <p className="v3-body">
              <T k="about.p1" />
            </p>
            <p className="v3-body">
              <T k="about.p2" />
            </p>
            <p className="v3-body">
              <T k="about.p3" />
            </p>
          </div>
        </div>
      </section>

      {/* ---------- THE THREE FIRMS ----------
          A register, not a partners grid. These are three SEPARATE
          proprietorship businesses, each with its own proprietor and GSTIN.
          V2 rendered them as three equal cards, and equal visual weight
          implies a shared identity — the opposite of what the page is
          documenting.

          Each firm is therefore a full-width ruled record: the mark sits in the
          left margin, the name titles the record, and the proprietor, GSTIN
          and description are hairline-divided specification rows. The
          description runs beside the data rather than under it, so a record is
          one object you read top to bottom. */}
      <section className="v3-band border-t border-[var(--v3-rule)]" aria-labelledby="about-firms">
        <div className="v3-head">
          <h2 id="about-firms" className="v3-h2">
            <T k="about.partners" />
          </h2>
          <span className="v3-num ml-auto shrink-0 text-[1.25rem] font-extrabold leading-none text-[var(--v3-brand-ink)]">
            {FIRMS.length}
          </span>
        </div>

        <ul className="mt-5 space-y-3">
          {FIRMS.map((firm, index) => (
            <li key={firm.id}>
              <article
                id={firm.id}
                className="v3-panel scroll-mt-32 overflow-hidden lg:flex"
              >
                {/* Identity column: mark + firm name. */}
                <div className="flex items-center gap-3 border-b border-[var(--v3-rule)] p-4 lg:w-64 lg:shrink-0 lg:flex-col lg:items-start lg:gap-2 lg:border-b-0 lg:border-r lg:p-5">
                  <FirmMark index={index} />
                  <div className="min-w-0">
                    <h3 className="v3-h3">{firm.name}</h3>
                    <p className="v3-small mt-0.5 !text-[0.75rem]">
                      <T k="about.proprietor" vars={{ name: firm.proprietor }} />
                    </p>
                  </div>
                </div>

                {/* Specification column: registration data as a ruled table
                    beside the firm's own description. */}
                <div className="min-w-0 flex-1 p-4 lg:p-5">
                  <dl className="divide-y divide-[var(--v3-rule)] border-y border-[var(--v3-rule)]">
                    <div className="flex items-baseline justify-between gap-4 py-2">
                      <dt className="v3-label !text-[0.5625rem]">GSTIN</dt>
                      <dd className="v3-partno !text-[0.75rem] !text-[var(--v3-text)]">
                        {firm.gstin}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 py-2">
                      <dt className="v3-label !text-[0.5625rem]">
                        <T k="about.proprietor" vars={{ name: "" }} />
                      </dt>
                      <dd className="text-right text-[0.8125rem] font-medium text-[var(--v3-text)]">
                        {firm.proprietor}
                      </dd>
                    </div>
                  </dl>
                  <p className="v3-body mt-3.5 !text-[0.875rem]">
                    <T k={firm.textKey} />
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- WHAT WE STAND FOR ---------- */}
      <section className="v3-band border-t border-[var(--v3-rule)]" aria-labelledby="about-stand">
        <div className="v3-head">
          <h2 id="about-stand" className="v3-h2">
            <T k="about.stand" />
          </h2>
        </div>

        {/* A ruled two-column list, not a grid of boxes. These are parallel
            statements, and boxing each one made them impossible to scan
            against each other. Label left, statement right, one hairline
            between rows — the same device as the cart summary and the order
            financial section. */}
        <dl className="mt-5 divide-y divide-[var(--v3-rule)] border-y border-[var(--v3-rule)]">
          {PRINCIPLES.map((principle) => (
            <div
              key={principle.titleKey}
              className="grid gap-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-baseline sm:gap-6"
            >
              <dt className="v3-label !text-[0.625rem] !text-[var(--v3-text)]">
                <T k={principle.titleKey} />
              </dt>
              <dd className="v3-body !text-[0.875rem]">
                <T k={principle.textKey} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- PRODUCT NETWORK ---------- */}
      <section className="v3-band border-t border-[var(--v3-rule)]" aria-labelledby="about-network">
        <div className="v3-head">
          <h2 id="about-network" className="v3-h2">
            <T k="about.network" />
          </h2>
        </div>
        <div className="mt-5 max-w-[46rem] space-y-4">
          <p className="v3-body">
            <T k="about.networkP1" />
          </p>
          <p className="v3-body">
            <T k="about.networkP2" />
          </p>
          <p className="v3-body">
            <T k="about.networkP3" />
          </p>
        </div>
      </section>

      {/* ---------- VISION ---------- */}
      <section className="v3-band border-t border-[var(--v3-rule)]" aria-labelledby="about-vision">
        <div className="v3-head">
          <h2 id="about-vision" className="v3-h2">
            <T k="about.vision" />
          </h2>
        </div>
        <div className="mt-5 max-w-[46rem] space-y-4">
          <p className="v3-body">
            <T k="about.visionP1" />
          </p>
          <p className="v3-body">
            <T k="about.visionP2" />
          </p>
        </div>
      </section>

      {/* ---------- TRUST / CONTACT CTA ----------
          Real contact details only, taken from lib/business-contacts. */}
      <section className="v3-band border-t border-[var(--v3-rule)]">
        <div className="v3-panel overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="v3-h3">SpareLink India</p>
              <p className="v3-body mt-1.5">
                <T k="about.tagline" />
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {telHref ? (
                  <a
                    href={telHref}
                    className="v3-focus v3-nav inline-flex min-h-11 items-center gap-2 rounded-[2px] text-[var(--v3-text-2)] transition-colors hover:text-[var(--v3-brand-ink)]"
                  >
                    <PhoneIcon />
                    {PUBLIC_SUPPORT_PHONE}
                  </a>
                ) : null}
                <a
                  href={`mailto:${PUBLIC_DISPLAY_EMAIL}`}
                  className="v3-focus v3-nav inline-flex min-h-11 items-center gap-2 rounded-[2px] text-[var(--v3-text-2)] transition-colors hover:text-[var(--v3-brand-ink)]"
                >
                  <MailIcon />
                  {PUBLIC_DISPLAY_EMAIL}
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <WhatsAppCta href={whatsappHref} className="v3-btn v3-btn-primary" />
              <a
                href="/contact-us"
                className="v3-btn v3-btn-outline whitespace-nowrap"
              >
                <T k="nav.contact" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}
