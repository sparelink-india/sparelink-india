"use client";

/* Hero uses pre-cut product rasters; next/image crop would clip edges. */

import Link from "next/link";

import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n";

const HERO_LINKS = [
  {
    id: "handles",
    label: "Outer Handles",
    href: "/category/outside-door-handle",
    ariaLabel: "Open Outer Handles catalogue",
    left: "0%",
    top: "5.8%",
    width: "20.5%",
    height: "30.2%",
    hover: true,
  },
  {
    id: "cables",
    label: "Automotive Cables",
    href: "/category/cables-wires",
    ariaLabel: "Open Automotive Cables catalogue",
    left: "0%",
    top: "38.2%",
    width: "25.4%",
    height: "31.5%",
    hover: true,
  },
  {
    id: "regulators",
    label: "Window Regulators",
    href: "/category/window-regulator-assy",
    ariaLabel: "Open Window Regulators catalogue",
    left: "0%",
    top: "69.7%",
    width: "25.7%",
    height: "28.3%",
    hover: true,
  },
  {
    id: "pensol",
    label: "Pensol Lubricants",
    href: "/?q=Pensol",
    ariaLabel: "Open Pensol Lubricants catalogue",
    left: "76.1%",
    top: "5.8%",
    width: "23.9%",
    height: "33.2%",
    hover: true,
  },
  {
    id: "uj",
    label: "Universal Joint Cross & Cross Holder",
    href: "/?q=Universal%20Joint",
    ariaLabel: "Open Universal Joint Cross & Cross Holder catalogue",
    left: "74.0%",
    top: "39.3%",
    width: "26.0%",
    height: "29.8%",
    hover: true,
  },
  {
    id: "pumps",
    label: "Water Pump Assemblies",
    href: "/category/water-pump-assy",
    ariaLabel: "Open Water Pump Assemblies catalogue",
    left: "73.1%",
    top: "69.7%",
    width: "26.9%",
    height: "28.3%",
    hover: true,
  },
  {
    id: "browse",
    label: "Browse Products",
    href: "#categories",
    ariaLabel: "Browse Products",
    left: "33.1%",
    top: "64.3%",
    width: "16.9%",
    height: "8.9%",
    hover: false,
  },
  {
    id: "findVehicle",
    label: "Find by Vehicle",
    href: "/vehicle-fitment",
    ariaLabel: "Find by Vehicle",
    left: "50.8%",
    top: "64.6%",
    width: "16.1%",
    height: "8.5%",
    hover: false,
  },
] as const;

const HERO_HOTSPOT_CLASS =
  "absolute z-10 cursor-pointer border-0 bg-transparent no-underline outline-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#f0c14b]";

const QUICK_SEARCHES = [
  { label: "Water Pump Bolero (M663)", q: "M663" },
  { label: "Door Handle (113)", q: "113" },
  { label: "Engine Oil Filter", q: "Engine Oil Filter" },
  { label: "Brake Pads", q: "Brake Pad" },
  { label: "Clutch Kit", q: "Clutch Kit" },
  { label: "12V Battery", q: "Battery" },
] as const;

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

  return (
    <section id="search" className="relative">
      {/* Single six-panel baked Hero for all viewport sizes and browser zoom levels. */}
      <div className="relative mx-auto w-full max-w-[1635px]">
        <h1 className="sr-only">India&apos;s Trusted Auto Parts Distributor &amp; Dealer</h1>
        <picture className="block w-full">
          <source srcSet="/images/hero/hero-banner-full.webp" type="image/webp" />
          <img
            src="/images/hero/hero-banner-full.png"
            alt="Sparelink India - India's Trusted Auto Parts Distributor & Dealer"
            width={1635}
            height={796}
            fetchPriority="high"
            decoding="async"
            className="block h-auto w-full max-w-full"
            style={{ aspectRatio: "1635 / 796" }}
          />
        </picture>
        {HERO_LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            aria-label={link.ariaLabel}
            className={`${HERO_HOTSPOT_CLASS}${link.hover ? " hover:bg-white/10" : ""}`}
            style={{
              left: link.left,
              top: link.top,
              width: link.width,
              height: link.height,
            }}
          />
        ))}
      </div>

      <div className="hero-vehicle-strip border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[67px] max-w-[1440px] items-center gap-3 overflow-x-auto px-3 sm:justify-center lg:px-6">
          {VEHICLE_TYPES.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex min-w-[4.75rem] flex-col items-center gap-1 px-1 text-slate-800 hover:text-[#7a1233]"
            >
              <VehicleGlyph kind={item.icon} />
              <span className="whitespace-nowrap text-center text-[10px] font-semibold uppercase tracking-wide">
                {t(item.key)}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-2 px-4 py-4 lg:px-8">
          <span className="text-xs font-semibold text-slate-700">{t("hero.quickSearches")}</span>
          {QUICK_SEARCHES.map((item) => (
            <button
              key={item.q}
              type="button"
              onClick={() => onQuickSearch(item.q)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function VehicleGlyph({ kind }: { kind: (typeof VEHICLE_TYPES)[number]["icon"] }) {
  const common = "h-7 w-7 text-slate-800";
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
