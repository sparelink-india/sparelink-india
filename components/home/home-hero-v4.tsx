"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useEffect, startTransition } from "react";

import { HeaderSearchField } from "@/components/header-search";
import type { HeaderSearchProduct } from "@/components/header-search";
import { useI18n } from "@/components/preferences-provider";

/**
 * COMPACT PREMIUM HOMEPAGE HERO — Mechanical Telemetry Schematic
 *
 * Replaces the tall graphite band with a focused search plate
 * that sits directly under the header. The hero becomes a single
 * high-value row: message + search + primary CTAs on the left,
 * 2 real product shots on the right.
 *
 * Integrates the 3-step vehicle selector (Make/Model/Variant) from
 * HomeVehicle directly into the hero, eliminating the separate section.
 *
 * WHAT IS REUSED
 * --------------
 *   - `HeaderSearchField`, the existing search implementation, untouched.
 *     Its suggestions, keyboard handling, `/api/search/parts` call, analytics
 *     events and result routing are all still the same code. Only
 *     `searchClassName` changes, which is presentation.
 *   - Real product photography from `public/images/hero/cutouts/`.
 *   - Existing translated strings — this component introduces NO new i18n keys.
 *
 * ONE SEARCH FORM
 * ---------------
 * The homepage must not render two search inputs, which is why `hideSearch`
 * is passed to the header by `home-client`: this hero owns the search on
 * the homepage, and the header field is suppressed there rather than duplicated.
 */

const HERO_TILES = [
  { src: "/images/hero/cutouts/pensol-pxt.png", alt: "Pensol PXT 5AE 20W-50 multigrade passenger car engine oil, 3 litre", labelKey: "hero.labelPensol" },
  { src: "/images/hero/cutouts/uj-cross.png", alt: "Universal joint cross (spider) for a drive shaft", labelKey: "hero.labelUj" },
  { src: "/images/hero/cutouts/oil-seals.png", alt: "Rotary shaft oil seals in a range of sizes", labelKey: "hero.labelSeals" },
] as const satisfies ReadonlyArray<{
  src: string;
  alt: string;
  labelKey: "hero.labelPensol" | "hero.labelUj" | "hero.labelSeals";
}>;

type HomeHeroV4Props = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (query: string) => void;
  searchLoading: boolean;
  onOpenProduct: (product: HeaderSearchProduct) => void;
  onAddToCart: (listingId: string, unitPaise: number | null | undefined) => void;
};

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

type VehicleSelectorProps = {
  makes: string[];
  selectedMake: string;
  onMakeChange: (make: string) => void;
  loadingMakes?: boolean;
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  loadingModels?: boolean;
  variants: string[];
  selectedVariant: string;
  onVariantChange: (variant: string) => void;
  loadingVariants?: boolean;
  onSubmit: () => void;
};

function VehicleSelector({ makes, selectedMake, onMakeChange, loadingMakes, models, selectedModel, onModelChange, loadingModels, variants, selectedVariant, onVariantChange, loadingVariants, onSubmit }: VehicleSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl mx-auto">
      {/* Step 1: Make */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor="vehicle-make" className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--dt-burgundy-primary)] mb-1.5">
          {t("homeV4.make")}
        </label>
        <select
          id="vehicle-make"
          value={selectedMake}
          onChange={(e) => onMakeChange(e.target.value)}
          disabled={loadingMakes}
          className="w-full h-11 bg-[var(--dt-graphite-1)] border border-[var(--dt-border-mechanical)] rounded-none text-[var(--dt-on-surface)] text-sm font-medium px-3 focus:outline-none focus:border-[var(--dt-copper-primary)] focus:ring-1 focus:ring-[var(--dt-copper-primary)] appearance-none bg-[var(--dt-graphite-1)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{loadingMakes ? t("homeV4.loading") : t("homeV4.selectMake")}</option>
          {makes.map((make) => (
            <option key={make} value={make}>{make}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Model */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor="vehicle-model" className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--dt-burgundy-primary)] mb-1.5">
          {t("homeV4.model")}
        </label>
        <select
          id="vehicle-model"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={!selectedMake || models.length === 0 || loadingModels}
          className="w-full h-11 bg-[var(--dt-graphite-1)] border border-[var(--dt-border-mechanical)] rounded-none text-[var(--dt-on-surface)] text-sm font-medium px-3 focus:outline-none focus:border-[var(--dt-copper-primary)] focus:ring-1 focus:ring-[var(--dt-copper-primary)] appearance-none bg-[var(--dt-graphite-1)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{loadingModels ? t("homeV4.loading") : t("homeV4.selectModel")}</option>
          {models.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>

      {/* Step 3: Variant */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor="vehicle-variant" className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--dt-burgundy-primary)] mb-1.5">
          {t("homeV4.variant")}
        </label>
        <select
          id="vehicle-variant"
          value={selectedVariant}
          onChange={(e) => onVariantChange(e.target.value)}
          disabled={!selectedModel || variants.length === 0 || loadingVariants}
          className="w-full h-11 bg-[var(--dt-graphite-1)] border border-[var(--dt-border-mechanical)] rounded-none text-[var(--dt-on-surface)] text-sm font-medium px-3 focus:outline-none focus:border-[var(--dt-copper-primary)] focus:ring-1 focus:ring-[var(--dt-copper-primary)] appearance-none bg-[var(--dt-graphite-1)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{loadingVariants ? t("homeV4.loading") : t("homeV4.selectVariant")}</option>
          {variants.map((variant) => (
            <option key={variant} value={variant}>{variant}</option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <div className="flex items-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectedMake || !selectedModel || !selectedVariant}
          className="h-11 w-full max-w-[200px] bg-[var(--dt-copper-primary)] text-[var(--dt-on-primary)] font-semibold text-sm px-4 rounded-none hover:bg-[var(--dt-copper-primary-hover)] active:bg-[var(--dt-copper-primary-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <span>{t("homeV4.showCompatible")}</span>
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}



export function HomeHeroV4({
  query,
  onQueryChange,
  onSearch,
  searchLoading,
  onOpenProduct,
  onAddToCart,
}: HomeHeroV4Props) {
  const { t } = useI18n();
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Vehicle selector state
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Load makes on mount
  useEffect(() => {
    startTransition(() => {
      setLoadingMakes(true);
    });
    fetch("/api/vehicle-fitment/makes", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (Array.isArray(data)) setMakes(data.sort());
      })
      .catch(() => {})
      .finally(() => setLoadingMakes(false));
  }, []);

  // Load models when make changes
  useEffect(() => {
    const make = selectedMake;
    if (!make) return;

    startTransition(() => {
      setModels([]);
      setSelectedModel("");
      setVariants([]);
      setSelectedVariant("");
      setLoadingModels(true);
    });
    fetch(`/api/vehicle-fitment/models?make=${encodeURIComponent(make)}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (Array.isArray(data)) setModels(data.sort());
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false));
  }, [selectedMake]);

  // Load variants when model changes
  useEffect(() => {
    const make = selectedMake;
    const model = selectedModel;
    if (!make || !model) return;

    startTransition(() => {
      setLoadingVariants(true);
    });
    fetch(`/api/vehicle-fitment/variants?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (Array.isArray(data)) setVariants(data.sort());
      })
      .catch(() => {})
      .finally(() => setLoadingVariants(false));
  }, [selectedMake, selectedModel]);

  const handleSubmit = () => {
    if (!selectedMake || !selectedModel || !selectedVariant) return;
    onSearch(`${selectedMake} ${selectedModel} ${selectedVariant}`);
  };

  

  

  

  return (
    <section
      id="search"
      aria-labelledby="hero-heading"
      className="relative isolate bg-[var(--dt-graphite-0)] text-[var(--dt-on-surface)]"
    >
      {/* Ground treatment. Two soft radial washes in the brand hues over the
          graphite base. This is CSS, not an image: no extra bytes, no CLS, and
          it re-themes itself in dark mode because it reads tokens rather than
          hardcoding a burgundy. `pointer-events-none` and `aria-hidden` because it
          carries no information. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(40rem 25rem at 8% -5%, rgb(194 120 53 / 0.18), transparent 55%)" +
            "radial-gradient(30rem 20rem at 92% 8%, rgb(139 30 43 / 0.12), transparent 50%)",
        }}
      />

      <div className="sl-container py-5 sm:py-7 lg:py-8">
        <div className="grid items-start gap-7 lg:grid-cols-12 lg:gap-10">
          {/* ================= LEFT: message + search + primary actions ======== */}
          <div className="lg:col-span-7">
            <p className="sl-eyebrow sl-eyebrow-plain text-[var(--dt-copper-primary)]">
              {t("hero.v3eyebrow")}
            </p>

            {/* The headline is REAL TEXT in both lines, in both languages. In
                V3 the second line was pixels, so a Hindi visitor saw an English
                hero with a hidden Hindi heading. */}
            <h1 id="hero-heading" className="sl-display mt-2 text-[var(--dt-on-surface)]">
              {t("hero.v3title1")}
            </h1>
            <h2 className="sl-display mt-1 text-[var(--dt-copper-primary)]">
              {t("hero.v3title2")}
            </h2>

            <p className="sl-lede mt-4 max-w-[54ch] text-[var(--dt-on-surface-variant)]">
              {t("hero.v3sub")}
            </p>

            {/* ---------- THE SEARCH ----------
                The existing field, restyled. `orderMode`/`orderPage` are left
                at their defaults so the Category/Stock/Clear filter row and the
                second injected cart control do not appear — the hero is not the
                order-search page. */}
            <div
              className="sl-hero-search mt-5"
              ref={(node) => {
                hostRef.current = node;
                setPanelHost(node);
              }}
            >
              <HeaderSearchField
                value={query}
                onChange={onQueryChange}
                onSubmitSearch={(next) => onSearch(next ?? query)}
                searchLoading={searchLoading}
                onOpenProduct={onOpenProduct}
                onAddToCart={onAddToCart}
                panelHost={panelHost}
                searchClassName="sl-hero-search-field"
              />
            </div>

            {/* ---------- VEHICLE SELECTOR (3-STEP) ----------
                Integrated directly into the hero. The selection state is
                managed here and submitted via the existing search flow. */}
            <VehicleSelector
              makes={makes}
              selectedMake={selectedMake}
              onMakeChange={setSelectedMake}
              loadingMakes={loadingMakes}
              models={models}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              loadingModels={loadingModels}
              variants={variants}
              selectedVariant={selectedVariant}
              onVariantChange={setSelectedVariant}
              loadingVariants={loadingVariants}
              onSubmit={handleSubmit}
            />

            {/* ---------- ACTIONS ----------
                One primary action, one alternative. The vehicle route is a real
                existing page, so the secondary is a real link rather than a
                scroll-to-section that pretends to be a destination. */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Link
                href="/category/filters"
                className="sl-btn sl-btn-primary sl-btn-lg sm:w-auto"
              >
                <SearchIcon />
                {t("hero.v3shop")}
              </Link>
              <Link
                href="/vehicle-fitment"
                className="sl-btn sl-btn-lg !border-[var(--dt-border-strong)] !bg-[var(--dt-graphite-1)] !text-[var(--dt-on-surface)] hover:!bg-[var(--dt-graphite-2)]"
              >
                <PinIcon />
                {t("hero.findVehicle")}
              </Link>
            </div>
          </div>

          {/* ================= RIGHT: 2 real product photographs =============
              Three real catalogue photographs, each in its own framed tile.
              They are laid out as a stack rather than a mosaic because a mosaic
              on a phone would crop three real parts into unreadable slivers;
              the stack keeps every one of them identifiable and it collapses
              to a horizontal row below `lg`. */}
          <div className="hidden lg:block lg:col-span-5">
            <ul className="grid grid-cols-1 gap-3">
              {HERO_TILES.map((tile) => (
                <li
                  key={tile.src}
                  className="group relative overflow-hidden rounded-none border border-[var(--dt-border-mechanical)] bg-[var(--dt-graphite-1)] shadow-[var(--dt-elevation-2)] transition-shadow duration-200 hover:shadow-[var(--dt-elevation-3)]"
                >
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={tile.src}
                      alt={tile.alt}
                      fill
                      priority={false}
                      sizes="(min-width: 1024px) 30rem, 33vw"
                      className="object-cover transition-transform duration-300 ease-[var(--sl-ease)] group-hover:scale-[1.02]"
                    />
                  </div>
                  {/* The caption is real text, so the part is named even if the
                      photograph fails to load. */}
                  <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white">
                    {t(tile.labelKey)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}



