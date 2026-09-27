import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { getTelHref } from "@/lib/support-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

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
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary)] text-sm font-extrabold text-white tabular-nums"
    >
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

export default function AboutUsPage() {
  const whatsappHref = getWhatsAppChatUrl();
  const telHref = getTelHref(PUBLIC_SUPPORT_PHONE);

  return (
    <StorefrontShell wide>
      {/* ---------- HERO ---------- */}
      <div className="relative overflow-hidden rounded-[var(--sl-radius-lg)] bg-[var(--sl-primary-dark)] px-5 py-10 text-white sm:px-10 sm:py-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 100% at 10% 0%, rgba(226,196,140,0.18) 0%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative max-w-3xl">
          <p className="sl-label !text-[var(--sl-gold-soft)]">
            <T k="nav.about" />
          </p>
          <h1 className="sl-display mt-2.5 !text-white">
            <T k="about.title" />
          </h1>
          <p className="sl-body mt-3 !text-white/75">
            <T k="about.subtitle" />
          </p>
        </div>
      </div>

      {/* ---------- INTRODUCTION ---------- */}
      <section className="sl-band" aria-labelledby="about-intro">
        <div className="max-w-[46rem]">
          <h2 id="about-intro" className="sr-only">
            <T k="about.title" />
          </h2>
          <div className="space-y-4">
            <p className="sl-body">
              <T k="about.p1" />
            </p>
            <p className="sl-body">
              <T k="about.p2" />
            </p>
            <p className="sl-body">
              <T k="about.p3" />
            </p>
          </div>
        </div>
      </section>

      {/* ---------- THE THREE FIRMS ----------
          Three distinct proprietorship businesses. Each card states its own
          proprietor and GSTIN so the legal separation is explicit. */}
      <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="about-firms">
        <div className="max-w-2xl">
          <h2 id="about-firms" className="sl-h2">
            <T k="about.partners" />
          </h2>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {FIRMS.map((firm, index) => (
            <article id={firm.id} key={firm.id} className="sl-v2-card sl-v2-rule flex flex-col p-5">
              <div className="flex items-center gap-3">
                <FirmMark index={index} />
                <div className="min-w-0">
                  <h3 className="sl-h3">{firm.name}</h3>
                  <p className="sl-small mt-0.5">
                    <T k="about.proprietor" vars={{ name: firm.proprietor }} />
                  </p>
                </div>
              </div>
              {/* GSTIN is registration data, so it gets the catalogue-code
                  treatment rather than body copy. */}
              <p className="sl-partno mt-3.5">
                <span className="sr-only">GSTIN: </span>
                GSTIN {firm.gstin}
              </p>
              <p className="sl-body mt-3 flex-1 text-[0.875rem]">
                <T k={firm.textKey} />
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- WHAT WE STAND FOR ---------- */}
      <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="about-stand">
        <div className="max-w-2xl">
          <h2 id="about-stand" className="sl-h2">
            <T k="about.stand" />
          </h2>
        </div>

        {/* Grid, not a definition list: these are parallel principles, and a
            3-up grid makes that parallelism visible. */}
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div key={principle.titleKey} className="sl-v2-card p-5">
              <dt className="sl-h3">
                <T k={principle.titleKey} />
              </dt>
              <dd className="sl-body mt-2 text-[0.875rem]">
                <T k={principle.textKey} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- PRODUCT NETWORK ---------- */}
      <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="about-network">
        <div className="max-w-2xl">
          <h2 id="about-network" className="sl-h2">
            <T k="about.network" />
          </h2>
        </div>
        <div className="mt-5 max-w-[46rem] space-y-4">
          <p className="sl-body">
            <T k="about.networkP1" />
          </p>
          <p className="sl-body">
            <T k="about.networkP2" />
          </p>
          <p className="sl-body">
            <T k="about.networkP3" />
          </p>
        </div>
      </section>

      {/* ---------- VISION ---------- */}
      <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="about-vision">
        <div className="max-w-2xl">
          <h2 id="about-vision" className="sl-h2">
            <T k="about.vision" />
          </h2>
        </div>
        <div className="mt-5 max-w-[46rem] space-y-4">
          <p className="sl-body">
            <T k="about.visionP1" />
          </p>
          <p className="sl-body">
            <T k="about.visionP2" />
          </p>
        </div>
      </section>

      {/* ---------- TRUST / CONTACT CTA ----------
          Real contact details only, taken from lib/business-contacts. */}
      <section className="sl-band border-t border-[var(--sl-border)]">
        <div className="sl-v2-card overflow-hidden">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="sl-h3">SpareLink India</p>
              <p className="sl-body mt-1.5">
                <T k="about.tagline" />
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {telHref ? (
                  <a
                    href={telHref}
                    className="sl-v2-focus sl-nav inline-flex min-h-11 items-center gap-2 rounded-[var(--sl-radius-sm)] text-[var(--sl-text-soft)] transition-colors hover:text-[var(--sl-primary)]"
                  >
                    <PhoneIcon />
                    {PUBLIC_SUPPORT_PHONE}
                  </a>
                ) : null}
                <a
                  href={`mailto:${PUBLIC_DISPLAY_EMAIL}`}
                  className="sl-v2-focus sl-nav inline-flex min-h-11 items-center gap-2 rounded-[var(--sl-radius-sm)] text-[var(--sl-text-soft)] transition-colors hover:text-[var(--sl-primary)]"
                >
                  <MailIcon />
                  {PUBLIC_DISPLAY_EMAIL}
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <WhatsAppCta href={whatsappHref} className="sl-v2-btn sl-v2-btn-primary" />
              <a
                href="/contact-us"
                className="sl-v2-btn sl-v2-btn-secondary whitespace-nowrap"
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
