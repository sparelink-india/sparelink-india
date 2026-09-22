"use client";

import Image from "next/image";
import Link from "next/link";

import { useI18n } from "@/components/preferences-provider";
import { PUBLIC_BRANDS, type PublicBrand } from "@/lib/public-brands";

function relationshipLabel(
  t: (key: "brands.distributor" | "brands.trader") => string,
  brand: PublicBrand,
) {
  return brand.relationship === "trader" ? t("brands.trader") : t("brands.distributor");
}

export function PublicBrandGrid({
  onSelect,
}: {
  onSelect?: (query: string) => void;
}) {
  const { t } = useI18n();

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
      {PUBLIC_BRANDS.map((brand) => {
        const href = `/?q=${encodeURIComponent(brand.searchQuery)}`;
        const label = `${brand.name}, ${relationshipLabel(t, brand)}`;
        const className =
          "group flex h-full min-h-[11.5rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs outline-none transition hover:border-[#7a1233]/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#7a1233] focus-visible:ring-offset-2";

        const inner = (
          <>
            <div className="relative mx-auto h-24 w-full">
              <Image
                src={brand.logo}
                alt={`${brand.name} logo`}
                fill
                sizes="160px"
                className="object-contain"
                unoptimized
              />
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug text-slate-900">{brand.name}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a1233]">
              {relationshipLabel(t, brand)}
            </p>
          </>
        );

        return (
          <li key={brand.id} className="min-w-0">
            {onSelect ? (
              <button
                type="button"
                aria-label={label}
                className={`${className} w-full`}
                onClick={() => onSelect(brand.searchQuery)}
              >
                {inner}
              </button>
            ) : (
              <Link href={href} aria-label={label} className={className}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PublicBrandsSection({
  onSelect,
  headingId = "brands-heading",
  headingLevel = "h2",
}: {
  onSelect?: (query: string) => void;
  headingId?: string;
  headingLevel?: "h1" | "h2";
}) {
  const { t } = useI18n();
  const Heading = headingLevel;

  return (
    <section id="brands" className="border-b border-slate-200/80 bg-slate-50 py-12 sm:py-16" aria-labelledby={headingId}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#7a1233]">
            {t("brands.kicker")}
          </p>
          <Heading id={headingId} className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {t("brands.heading")}
          </Heading>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{t("brands.lead")}</p>
        </div>
        <div className="mt-8">
          <PublicBrandGrid onSelect={onSelect} />
        </div>
      </div>
    </section>
  );
}
