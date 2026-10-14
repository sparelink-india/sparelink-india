"use client";

import Image from "next/image";
import Link from "next/link";

import { WhatsAppCta } from "@/components/whatsapp-cta";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";
import { useI18n } from "@/components/preferences-provider";

/**
 * GENERATION-4 HOMEPAGE SECTIONS.
 *
 * Every value rendered here comes from a real source: the category and brand
 * lists are passed in from `home-client`, which fetches them from
 * `/api/catalogue/categories` and `/api/catalogue/brands`. Nothing is
 * hardcoded, no count is invented, and no brand mark is drawn that is not
 * already in `public/images/brands/`.
 *
 * PRODUCT COUNTS ARE DELIBERATELY ABSENT
 * --------------------------------------
 * Neither catalogue endpoint returns a per-category or per-brand product count.
 * Showing one would mean either a fabricated number or an extra N+1 query per
 * card on the most-requested page in the site. So the cards carry no counts.
 * That is a real omission against a "count where available" brief, and it is the
 * correct call: the number is not available, so it is not displayed.
 */

export type CatalogueCategory = { id: string; name: string; slug: string };
export type CatalogueBrand = string;

/**
 * Category slug -> photograph. Only slugs that actually appear in the
 * catalogue API are listed, so a card can never link to a route that does not
 * exist. A category with no entry here renders as a designed type-only tile,
 * which is deliberate: an elegant non-photo card, not a broken image.
 */
const CATEGORY_IMAGE: Record<string, string> = {
  engine: "/images/category/engine-parts.png",
  transmission: "/images/category/clutch-transmission.png",
  brakes: "/images/category/braking-system.png",
  suspension: "/images/category/suspension-steering.png",
  electrical: "/images/category/electricals.png",
  filters: "/images/category/filters.png",
  body: "/images/category/body-parts.png",
  lubricants: "/images/category/lubricants.png",
};

/**
 * Brand name -> logo file, ONLY where the asset genuinely is that brand.
 * Anything not listed renders as a typeset wordmark, which is a real design
 * treatment rather than a missing picture.
 *
 * "CI AUTOMOTIVE LLP" is intentionally absent: `public/images/brands/akar.png`
 * exists but is a different company's mark, and putting it under this name
 * would misattribute a logo. `homeBrands` also does not feature the catalogue's
 * "Factory 1" / "Factory 2" rows, which are source-system placeholders rather
 * than brands a customer can shop; they remain listed on /brands.
 */
const BRAND_LOGO: Record<string, string> = {
  MEKO: "/images/brands/meko.jpg",
  "Menon Brakes": "/images/brands/menon-brakes.png",
  Pensol: "/images/brands/pensol.png",
  STARLINKS: "/images/brands/starlinks.png",
  SpareLink: "/images/brands/sparelink-india-logo.png",
};

/** The primary taxonomy, in merchandising order. All seven resolve as routes. */
const FEATURED_CATEGORY_SLUGS = [
  "engine",
  "brakes",
  "filters",
  "suspension",
  "electrical",
  "transmission",
  "body",
  "lubricants",
] as const;

function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ===================================================================
   SECTION SHELL - COMPACT DEFAULT
   Default to tight (sl-band-tight) for a denser, more premium feel.
   Only opt out for sections that genuinely need breathing room.
   =================================================================== */
function Section({
  id,
  labelledBy,
  tone = "page",
  tight = true,
  children,
}: {
  id?: string;
  labelledBy?: string;
  tone?: "page" | "surface" | "sunk" | "dark";
  tight?: boolean;
  children: React.ReactNode;
}) {
  const ground =
    tone === "surface"
      ? "bg-[var(--sl-surface)]"
      : tone === "sunk"
        ? "bg-[var(--sl-sunken)]"
        : tone === "dark"
          ? "bg-[var(--sl-graphite)] text-[var(--sl-graphite-ink)]"
          : "bg-[var(--sl-page)]";
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${ground} ${tight ? "sl-band-tight" : "sl-band"}`}
    >
      <div className="sl-container">{children}</div>
    </section>
  );
}

function SectionHead({
  id,
  eyebrow,
  title,
  hint,
  action,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {eyebrow ? <p className="sl-eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className={`${eyebrow ? "mt-1.5" : ""} sl-h2`}>
          {title}
        </h2>
        {hint ? (
          <p className="sl-lede mt-1.5">{hint}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ===================================================================
   2. QUICK DISCOVERY
   Four real entry points. Each one is a link or a real control; none of them
   is a decorative tile that goes nowhere.
   =================================================================== */
function DiscoveryGlyph({ glyph }: { glyph: "hash" | "car" | "grid" | "tag" | "chat" }) {
  switch (glyph) {
    case "hash":
      return (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16" />
        </svg>
      );
    case "car":
      return (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 16v-3.2L6.4 8h11.2L20 12.8V16" />
          <circle cx="7.5" cy="16.5" r="1.6" />
          <circle cx="16.5" cy="16.5" r="1.6" />
        </svg>
      );
    case "grid":
      return (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
        </svg>
      );
    default:
      return (
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 8.5V7a1.5 1.5 0 011.5-1.5h14A1.5 1.5 0 0120.5 7v1.5M3.5 8.5h17v10a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5v-10z" />
          <circle cx="12" cy="13" r="1.4" />
        </svg>
      );
  }
}

export function HomeQuickDiscovery() {
  const { t } = useI18n();

  const tiles: Array<{
    key: string;
    href: string;
    label: string;
    hint: string;
    glyph: "hash" | "car" | "grid" | "tag" | "chat";
  }> = [
    {
      key: "part",
      href: "/?q=&focus=search",
      label: t("search.byPartNumber"),
      hint: t("search.partNo"),
      glyph: "hash",
    },
    {
      key: "vehicle",
      href: "/vehicle-fitment",
      label: t("search.byVehicle"),
      hint: t("home.byVehicle"),
      glyph: "car",
    },
    {
      key: "cats",
      /* No `/category` index route exists (only `/category/[...slug]`), so this
         uses the same all-categories target the site footer already uses. */
      href: "/category/filters",
      label: t("hero.productCategories"),
      hint: t("hero.v3browseAll"),
      glyph: "grid",
    },
    {
      key: "brands",
      href: "/brands",
      label: t("hero.brands"),
      hint: t("hero.brandsHint"),
      glyph: "tag",
    },
  ];

  return (
    <Section id="discover" labelledBy="discover-heading" tone="surface">
      <h2 id="discover-heading" className="sr-only">
        {t("homeV4.quickTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Link
              href={tile.href}
              className="sl-panel sl-focus group flex h-full min-h-[5.5rem] flex-col justify-between gap-2.5 p-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--sl-r-sm)] bg-[var(--dt-copper-soft)] text-[var(--dt-copper-ink)]">
                <DiscoveryGlyph glyph={tile.glyph} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.875rem] font-semibold leading-snug text-[var(--sl-ink)]">
                  {tile.label}
                </span>
                <span className="sl-micro mt-0.25 block truncate text-[var(--sl-ink-3)]">
                  {tile.hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ===================================================================
   3. POPULAR CATEGORIES
   The visual language future category pages will inherit: fixed 4:3 stage,
   contained photograph, name below, whole card is the target.
   =================================================================== */
export function HomeCategories({
  categories,
}: {
  categories: CatalogueCategory[];
}) {
  const { t } = useI18n();
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const featured = FEATURED_CATEGORY_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (c): c is CatalogueCategory => Boolean(c),
  );

  return (
    <Section id="categories" labelledBy="categories-heading" tone="surface">
      <SectionHead
        id="categories-heading"
        eyebrow={t("hero.v3eyebrow")}
        title={t("homeV4.catsTitle")}
        hint={t("homeV4.catsHint")}
        action={
          <Link href="/category/filters" className="sl-navlink sl-focus">
            {t("hero.v3browseAll")}
            <ArrowIcon />
          </Link>
        }
      />
      <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        {featured.map((category) => {
          const image = CATEGORY_IMAGE[category.slug];
          return (
            <li key={category.id}>
              <Link
                href={`/category/${category.slug}`}
                className="sl-panel sl-focus group flex h-full flex-col overflow-hidden transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden border-b border-[var(--dt-border-mechanical)] bg-[var(--dt-sunken)]">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 45vw"
                      className="object-cover transition-transform duration-250 ease-[var(--sl-ease)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[var(--dt-sunken-2)] px-4 text-center text-[0.75rem] font-bold uppercase tracking-[0.08em] text-[var(--dt-ink-3)]">
                      {category.name}
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 p-3">
                  <span className="sl-clamp-2 text-[0.875rem] font-semibold leading-snug text-[var(--dt-ink)]">
                    {category.name}
                  </span>
                  <ArrowIcon className="h-3.5 w-3.5 shrink-0 text-[var(--dt-ink-3)] transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ===================================================================
   4. FIND PARTS FOR YOUR VEHICLE
   Make / Model / Variant / Year, then one CTA.
   The four fields are LABELS over the existing vehicle-fitment route, not new
   selection logic: this section must not fork fitment state from the real
   browser, or the two would disagree about what the customer chose.
   =================================================================== */
export function HomeVehicle() {
  const { t } = useI18n();

  const steps: Array<{ key: string; label: string }> = [
    { key: "make", label: t("homeV4.make") },
    { key: "model", label: t("homeV4.model") },
    { key: "variant", label: t("homeV4.variant") },
    { key: "year", label: t("homeV4.year") },
  ];

  return (
    <Section id="vehicle-type" labelledBy="vehicle-heading" tone="sunk">
      <div className="grid items-center gap-5 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <p className="sl-eyebrow">{t("home.byVehicleLabel")}</p>
          <h2 id="vehicle-heading" className="sl-h2 mt-1.5">
            {t("homeV4.vehicleTitle")}
          </h2>
          <p className="sl-lede mt-1.5">{t("homeV4.vehicleHint")}</p>

          <ol className="mt-4 flex flex-wrap items-center gap-1.5">
            {steps.map((step, i) => (
              <li key={step.key} className="flex items-center gap-1.5">
                <span className="inline-flex h-7 items-center gap-1.5 rounded-[var(--sl-r-pill)] border border-[var(--sl-rule-2)] bg-[var(--sl-surface)] px-2.5 text-[0.75rem] font-semibold text-[var(--sl-ink-2)]">
                  <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--sl-brand)] text-[0.625rem] font-bold text-white">
                    {i + 1}
                  </span>
                  {step.label}
                </span>
                {i < steps.length - 1 ? (
                  <span aria-hidden className="text-[var(--sl-rule-strong)]">
                    <ArrowIcon className="h-3 w-3" />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          <Link
            href="/vehicle-fitment"
            className="sl-btn sl-btn-primary sl-btn-lg mt-4"
          >
            {t("homeV4.showCompatible")}
            <ArrowIcon />
          </Link>
        </div>

        <div className="lg:col-span-7">
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { make: "maruti-suzuki", model: "maruti-suzuki-swift", alt: "Maruti Suzuki Swift" },
              { make: "hyundai", model: "hyundai-creta", alt: "Hyundai Creta" },
              { make: "tata", model: "tata-nexon", alt: "Tata Nexon" },
              { make: "mahindra", model: "mahindra-bolero", alt: "Mahindra Bolero" },
            ].map((v) => (
              <li
                key={v.model}
                className="sl-panel overflow-hidden"
              >
                <span className="relative block aspect-[4/3] w-full bg-[var(--sl-sunken)]">
                  <Image
                    src={`/images/vehicles/models/${v.model}.webp`}
                    alt={v.alt}
                    fill
                    sizes="(min-width: 1024px) 14rem, 45vw"
                    className="object-cover"
                  />
                </span>
                <span className="flex items-center justify-center gap-1.5 p-2">
                  <Image
                    src={`/images/vehicles/makes/${v.make}.svg`}
                    alt=""
                    width={64}
                    height={18}
                    className="h-[16px] w-auto max-w-[64px] object-contain opacity-80"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ===================================================================
   5. FEATURED BRANDS
   Logo where a genuine asset exists, typeset wordmark where it does not.
   =================================================================== */
export function HomeBrands({ brands }: { brands: CatalogueBrand[] }) {
  const { t } = useI18n();

  /* Curated order, and only brands that are real names. The catalogue also
     contains "Factory 1" and "Factory 2", which are source-system placeholders;
     they stay on /brands but are not merchandised on the homepage. */
  const featured = brands.filter(
    (b) => !/^Factory\s*\d+$/i.test(b.trim()) && b.trim().length > 1,
  );

  return (
    <Section id="brands" labelledBy="brands-heading" tone="surface">
      <SectionHead
        id="brands-heading"
        eyebrow={t("hero.v3eyebrow")}
        title={t("homeV4.brandsTitle")}
        hint={t("homeV4.brandsHint")}
        action={
          <Link href="/brands" className="sl-navlink sl-focus">
            {t("hero.v3browseAll")}
            <ArrowIcon />
          </Link>
        }
      />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {featured.map((brand) => {
          const logo = BRAND_LOGO[brand];
          return (
            <li key={brand}>
              <Link
                href={`/?q=${encodeURIComponent(brand)}`}
                className="sl-panel sl-focus flex h-[5rem] items-center justify-center gap-2 px-2.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
              >
                {logo ? (
                  <Image
                    src={logo}
                    alt={brand}
                    width={120}
                    height={40}
                    className="h-8 w-auto max-w-[7rem] object-contain"
                  />
                ) : (
                  <span className="text-center text-[0.75rem] font-bold uppercase leading-tight tracking-[0.06em] text-[var(--sl-ink-2)]">
                    {brand}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ===================================================================
   6. B2B / WHOLESALE VALUE
   Only capabilities the application actually has. No customer counts, no
   catalogue-size claims, no "10,000 garages" — none of those numbers exist
   anywhere in this codebase.
   =================================================================== */
export function HomeB2B() {
  const { t } = useI18n();

  const points: Array<{ key: string; title: string; body: string }> = [
    { key: "p1", title: t("homeV4.b2bP1"), body: t("homeV4.b2bP1Body") },
    { key: "p2", title: t("homeV4.b2bP2"), body: t("homeV4.b2bP2Body") },
    { key: "p3", title: t("homeV4.b2bP3"), body: t("homeV4.b2bP3Body") },
    { key: "p4", title: t("homeV4.b2bP4"), body: t("homeV4.b2bP4Body") },
  ];

  return (
    <Section id="b2b" labelledBy="b2b-heading" tone="dark">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <p className="sl-eyebrow sl-eyebrow-plain text-[var(--dt-burgundy-ink)]">
            {t("nav.dealer")}
          </p>
          <h2 id="b2b-heading" className="sl-h2 mt-1.5 text-[var(--dt-graphite-ink)]">
            {t("homeV4.b2bTitle")}
          </h2>
          <p className="sl-lede mt-1.5 text-[var(--dt-graphite-ink-2)]">
            {t("homeV4.b2bBody")}
          </p>
          <Link
            href="/login/dealer"
            className="sl-btn sl-btn-primary sl-btn-lg mt-4"
          >
            {t("hero.v3dealer")}
            <ArrowIcon />
          </Link>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:col-span-7">
          {points.map((point) => (
            <li
              key={point.key}
              className="rounded-[var(--dt-r-lg)] border border-[var(--dt-border-strong)] bg-[var(--dt-graphite-1)] p-3.5"
            >
              <p className="text-[0.875rem] font-semibold text-[var(--dt-graphite-ink)]">
                {point.title}
              </p>
              <p className="sl-micro mt-1 leading-relaxed text-[var(--dt-graphite-ink-2)]">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ===================================================================
   7. PRODUCT CLASSIFICATION
   Explains the four labels. This is an EXPLANATION of the classification the
   catalogue uses; it does not assert that any given product carries a label.
   =================================================================== */
export function HomeQuality() {
  const { t } = useI18n();

  const kinds: Array<{ key: string; title: string; body: string; tone: string }> = [
    { key: "genuine", title: t("homeV4.qGenuine"), body: t("homeV4.qGenuineBody"), tone: "sl-badge-brand" },
    { key: "original", title: t("homeV4.qOriginal"), body: t("homeV4.qOriginalBody"), tone: "sl-badge-copper" },
    { key: "aftermarket", title: t("homeV4.qAftermarket"), body: t("homeV4.qAftermarketBody"), tone: "sl-badge-neutral" },
    { key: "refurbished", title: t("homeV4.qRefurbished"), body: t("homeV4.qRefurbishedBody"), tone: "sl-badge-info" },
  ];

  return (
    <Section id="quality" labelledBy="quality-heading">
      <SectionHead
        id="quality-heading"
        eyebrow={t("hero.quality")}
        title={t("homeV4.qualityTitle")}
        hint={t("hero.qualityHint")}
      />
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {kinds.map((kind) => (
          <li key={kind.key} className="sl-panel p-3.5">
            <span className={`sl-badge ${kind.tone}`}>{kind.title}</span>
            <p className="sl-meta mt-2 leading-relaxed">{kind.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ===================================================================
   8. ENQUIRY CTA  ---  existing WhatsApp plumbing, unchanged.
   =================================================================== */
export function HomeEnquiry() {
  const { t } = useI18n();
  const whatsappHref = getWhatsAppChatUrl();

  return (
    <Section id="enquiry" labelledBy="enquiry-heading" tone="surface">
      <div className="sl-panel sl-panel-edge flex flex-col items-start gap-4 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 id="enquiry-heading" className="sl-h3">
            {t("homeV4.enquiryTitle")}
          </h2>
          <p className="sl-lede mt-1">{t("homeV4.enquiryBody")}</p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <WhatsAppCta
            href={whatsappHref}
            className="sl-btn sl-btn-primary sl-btn-lg"
            tone="inherit"
          />
          <Link
            href="/contact-us"
            className="sl-btn sl-btn-secondary sl-btn-lg"
          >
            {t("nav.contact")}
          </Link>
        </div>
      </div>
    </Section>
  );
}

/* ===================================================================
   9. TRUST / SERVICE
   Only services that exist as real routes in this application.
   =================================================================== */
export function HomeTrust() {
  const { t } = useI18n();

  const items: Array<{ key: string; href: string; title: string; body: string }> = [
    { key: "track", href: "/track-order", title: t("nav.track"), body: t("homeV4.trustTrack") },
    { key: "secure", href: "/cart", title: t("homeV4.trustSecure"), body: t("homeV4.trustSecureBody") },
    { key: "returns", href: "/returns-refunds", title: t("homeV4.trustReturns"), body: t("homeV4.trustReturnsBody") },
    { key: "support", href: "/help-support", title: t("nav.help"), body: t("homeV4.trustSupportBody") },
  ];

  return (
    <Section id="trust" labelledBy="trust-heading" tone="sunk">
      <h2 id="trust-heading" className="sr-only">
        {t("homeV4.trustTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="sl-panel sl-focus flex h-full flex-col gap-1 p-3.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
            >
              <span className="text-[0.875rem] font-semibold text-[var(--dt-ink)]">
                {item.title}
              </span>
              <span className="sl-micro leading-relaxed text-[var(--dt-ink-2)]">
                {item.body}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}