"use client";

/* Hero uses pre-cut product rasters; next/image crop would clip edges. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n";

type SearchModeIcon = "hash" | "tag" | "badge" | "car" | "code";

/**
 * Discoverability hints for the real search box below. These do NOT create a
 * second search path — tapping one seeds the same query the customer would
 * have typed, which flows through the existing `onQuickSearch` handler.
 */
/**
 * Prominent "search by" affordances.
 *
 * Reduced to four. HSN is deliberately NOT a prominent pill — it would make the
 * row a five-pill strip and dilute the primary action. HSN search still works
 * exactly as before: the input is free text, the same endpoint parses it, and
 * the header search exposes HSN in its own placeholder. Only its prominence
 * changed, never its behaviour.
 */
const SEARCH_MODES: {
  label: string;
  example: string;
  q: string;
  icon: SearchModeIcon;
}[] = [
  { label: "Part Number", example: "856, M-856, 101", q: "856", icon: "hash" },
  { label: "Part Name", example: "water pump, brake pad", q: "Water Pump", icon: "tag" },
  { label: "Vehicle", example: "Bolero, Swift, Creta", q: "Bolero", icon: "car" },
  { label: "Brand", example: "CI Automotive, Pensol", q: "CI Automotive", icon: "badge" },
];

const VEHICLE_TYPES: {
  key: MessageKey;
  href: string;
  icon: "car" | "suv" | "muv" | "lcv" | "hcv" | "bike" | "tractor" | "off";
}[] = [
  { key: "hero.vehCars", href: "/vehicle-fitment", icon: "car" },
  { key: "hero.vehSuvs", href: "/vehicle-fitment", icon: "suv" },
  { key: "hero.vehMuvs", href: "/vehicle-fitment", icon: "muv" },
  { key: "hero.vehLcvs", href: "/vehicle-fitment", icon: "lcv" },
  { key: "hero.vehHcvs", href: "/vehicle-fitment", icon: "hcv" },
  { key: "hero.vehTwo", href: "/vehicle-fitment", icon: "bike" },
  { key: "hero.vehTractors", href: "/vehicle-fitment", icon: "tractor" },
  { key: "hero.vehOff", href: "/vehicle-fitment", icon: "off" },
];

export function HomeHero({
  onQuickSearch,
}: {
  onQuickSearch: (query: string) => void;
}) {
  const { t } = useI18n();
  const [heroQuery, setHeroQuery] = useState("");

  const submitHeroSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onQuickSearch(trimmed);
  };

  return (
    <section id="search" className="relative">
      <div className="hero-reference relative overflow-hidden text-white">
        <img
          src="/images/hero/sparelink-clean-hero-bg.png?v=4"
          alt=""
          className="hero-scene-img pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 hero-scene-veil" aria-hidden />
        {/*
          Burgundy identity wash — lightened after screenshot review.

          Screenshot review showed the automotive photography was still not
          readable through the overlay. The wash is now
          0.56 / 0.16 / 0.28 / 0.68 (previously 0.72 / 0.30 / 0.42 / 0.80),
          which opens the middle band to 0.16 so the vehicle photo reads through
          clearly, while the top and bottom bands still anchor the burgundy
          identity and preserve white-text contrast for the headline, the
          search field and the CTAs.
          */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(42,8,18,0.56) 0%, rgba(42,8,18,0.16) 34%, rgba(74,12,32,0.28) 68%, rgba(42,8,18,0.68) 100%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--sl-grad-sheen)" }}
          aria-hidden
        />

        {/*
          DESIGN RESET — the hero is now ONE purpose: find the right spare part.
          The previous build stacked six decorative product cut-out panels and
          three clipped "hero-panel" figures around the search (12 <img>, 6
          <figure>, 16 chips and ~23 CTA elements inside the hero band). They
          competed with the single most important element on the page and read
          as collage rather than premium. The real product photography now
          lives in the page background only, and the search owns the frame.
        */}
        {/*
          Content wrapper. `justify-center` with padding, and no fixed height,
          so the block always fits its content — the CTAs were previously
          clipped because the container had a large py on top of a fixed
          desktop hero height.
        */}
        <div className="relative z-[3] mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-10 text-center sm:py-12 lg:py-9">
          <p className="sl-label !text-[var(--sl-gold-soft)]">{t("hero.eyebrow")}</p>
          {/*
            Headline reflowed from three forced lines to two. The previous
            `block` span per line fragmented "India's Trusted / Auto Parts /
            Distributor & Dealer" into a tall narrow stack; rendering the first
            two segments as one flowing line lets the browser break where the
            text actually needs it.
          */}
          <h1 className="sl-display !text-white max-w-2xl">
            <span className="text-white">
              {t("hero.titleLine1")} {t("hero.titleLine3")}
            </span>{" "}
            <span className="sl-text-grad">{t("hero.titleAccent")}</span>
          </h1>
          <p className="sl-body !text-white/80 max-w-xl">{t("hero.subtitle")}</p>

          {/* Primary interaction: the real search. Submits through the same
              onQuickSearch handler the quick chips already use. */}
          <form
            className="mt-6 w-full sm:mt-7"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitHeroSearch(heroQuery);
            }}
          >
            <label htmlFor="hero-search-input" className="sr-only">
              Search automotive spare parts by part number, name, brand, vehicle or HSN
            </label>
              <div className="sl-search sl-search-invert shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85)]">
                <span className="sl-search-icon">
                  <SearchGlyph />
                </span>
                <input
                  id="hero-search-input"
                  type="search"
                  value={heroQuery}
                  onChange={(event) => setHeroQuery(event.target.value)}
                  placeholder="Search part number, name, brand or vehicle…"
                  autoComplete="off"
                  className="sl-search-input"
                />
                <button
                  type="submit"
                  disabled={!heroQuery.trim()}
                  className="sl-search-submit"
                >
                  <span className="hidden sm:inline">Search</span>
                  <SearchGlyph className="h-4 w-4 sm:hidden" />
                </button>
              </div>

              {/* Horizontally scrollable on narrow screens so 320px never
                  overflows; wraps naturally from sm upward. */}
              <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
                <span className="sr-only">Search by</span>
                <span
                  className="hidden shrink-0 items-center pr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 sm:inline-flex"
                  aria-hidden
                >
                  Search by
                </span>
                {SEARCH_MODES.map((mode) => (
                  <button
                    key={mode.label}
                    type="button"
                    onClick={() => {
                      setHeroQuery(mode.q);
                      submitHeroSearch(mode.q);
                    }}
                    title={mode.example}
                    className="sl-chip sl-chip-invert h-8 min-h-8 shrink-0 px-3 text-[11px] font-semibold"
                  >
                    <SearchModeGlyph kind={mode.icon} />
                    {mode.label}
                  </button>
                ))}
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:mt-6 sm:gap-3">
              <Link href="#categories" className="sl-v2-btn sl-v2-btn-ghost-invert text-[13px] sm:text-sm">
                {t("hero.browse")}
              </Link>
              <Link
                href="/vehicle-fitment"
                className="sl-v2-btn sl-v2-btn-ghost-invert inline-flex items-center gap-2 text-[13px] sm:text-sm"
              >
                <CarIcon />
                {t("hero.findVehicle")}
              </Link>
            </div>
        </div>
      </div>

      {/*
        Vehicle discovery strip. Previously a bare row of 8 bare icon links,
        which read as an old catalogue nav bar. It now has a clear label and
        each type is a proper compact card with a consistent hover state. The
        vehicle types themselves are unchanged and still link to the real
        /vehicle-fitment route.
      */}
      <div className="border-b border-[var(--sl-border)]/70 bg-[var(--sl-cream)]">
        <div className="sl-container py-5">
          <p className="sl-label">Find parts for your vehicle</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {VEHICLE_TYPES.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[var(--sl-radius-sm)] border border-[var(--sl-border)] bg-white px-2 py-2 text-center transition-colors duration-200 hover:border-brand-300 hover:bg-white hover:shadow-[0_4px_14px_-8px_rgba(42,8,18,0.35)]"
                >
                  <span className="text-[var(--sl-primary)] transition-transform duration-200 group-hover:scale-110">
                    <VehicleGlyph kind={item.icon} />
                  </span>
                  <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--sl-text-soft)] group-hover:text-[var(--sl-primary)]">
                    {t(item.key)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        DESIGN RESET: the standalone "quick searches" chip band is removed.
        It duplicated the "Search by" chips directly under the search field —
        two chip rows in one band was the single biggest source of clutter in
        the hero. The five "Search by" chips (Part Number / Part Name / Brand /
        Vehicle / HSN) remain, they are the restrained discovery affordance, and
        they submit through the same real `onQuickSearch` handler. The vehicle
        strip above keeps every vehicle entry point.
      */}
    </section>
  );
}

function SearchGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`${className} shrink-0 text-white/75`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.6-3.6" />
    </svg>
  );
}

function SearchModeGlyph({ kind }: { kind: SearchModeIcon }) {
  const common = "h-3.5 w-3.5 shrink-0";
  return (
    <svg
      className={common}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden
    >
      {kind === "hash" ? (
        <path strokeLinecap="round" d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
      ) : kind === "tag" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12.5V4h8.5L21 13.5 13.5 21 3 12.5Zm4-4h.01"
        />
      ) : kind === "badge" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z"
        />
      ) : kind === "car" ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13l2-5h14l2 5M5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 13h16"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"
        />
      )}
    </svg>
  );
}

function VehicleGlyph({ kind }: { kind: (typeof VEHICLE_TYPES)[number]["icon"] }) {
  const common = "h-7 w-7 text-current";
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      {kind === "bike" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 17a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM8 14l4-7h3l2 4" />
      ) : kind === "hcv" || kind === "lcv" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16V8h11v8M14 10h4l3 4v2h-7M6 18a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
      ) : kind === "tractor" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 17a3 3 0 106 0M14 17a4 4 0 108 0M7 17V8h6l3 4h4" />
      ) : kind === "off" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l3-6h10l3 6M7 16a2 2 0 100 0zm10 0a2 2 0 100 0zM3 20h18" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-5h14l2 5M5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 13h16" />
      )}
    </svg>
  );
}

function CarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-5h14l2 5M5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 13h16" />
    </svg>
  );
}
