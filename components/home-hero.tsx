"use client";

/* Hero uses pre-cut product rasters; next/image crop would clip edges. */
/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from "react";
import Link from "next/link";

import { useI18n } from "@/components/preferences-provider";
import type { MessageKey } from "@/lib/i18n";

const HERO_CATALOGUE_LINKS = [
  { id: "handles", label: "Outer Handles", href: "/category/outside-door-handle" },
  { id: "cables", label: "Automotive Cables", href: "/category/cables-wires" },
  { id: "regulators", label: "Window Regulators", href: "/category/window-regulator-assy" },
  { id: "pensol", label: "Pensol Lubricants", href: "/?q=Pensol" },
  { id: "uj", label: "Universal Joint Cross & Cross Holder", href: "/?q=Universal%20Joint" },
  { id: "pumps", label: "Water Pump Assemblies", href: "/category/water-pump-assy" },
] as const;

const HERO_LINK_CLASS =
  "hero-catalogue-link cursor-pointer text-inherit no-underline outline-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#f0c14b]";

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
      <div className="hero-reference relative overflow-hidden text-white">
        <img
          src="/images/hero/sparelink-clean-hero-bg.png?v=4"
          alt=""
          className="hero-scene-img pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 hero-scene-veil" aria-hidden />

        <div className="hero-stage relative z-[3]">
          <div className="hero-col hero-col-left hidden lg:flex">
            <ProductPanel
              side="left"
              src="/images/hero/cutouts/outer-handles.png"
              label={t("hero.labelHandles")}
              href={HERO_CATALOGUE_LINKS[0].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[0].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <ProductPanel
              side="left"
              src="/images/hero/cutouts/cables.png"
              label={t("hero.labelCables")}
              href={HERO_CATALOGUE_LINKS[1].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[1].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <ProductPanel
              side="left"
              src="/images/hero/cutouts/window-regulators.png"
              label={t("hero.labelRegulators")}
              href={HERO_CATALOGUE_LINKS[2].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[2].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
          </div>

          <div className="hero-center relative z-[4] mx-auto flex flex-col items-center justify-center px-3 text-center sm:px-4">
            <p className="hero-eyebrow">{t("hero.eyebrow")}</p>
            <h1 className="hero-headline">
              <span className="block text-white">{t("hero.titleLine1")}</span>
              <span className="block text-[#f0c14b]">{t("hero.titleAccent")}</span>
              <span className="block text-white">{t("hero.titleLine3")}</span>
            </h1>
            <p className="hero-subhead">{t("hero.subtitle")}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link href="#categories" className="hero-cta">
                {t("hero.browse")}
              </Link>
              <Link href="/vehicle-fitment" className="hero-cta inline-flex items-center gap-2">
                <CarIcon />
                {t("hero.findVehicle")}
              </Link>
            </div>
            <div className="hero-badges">
              <HeroStat icon={<ShieldMini />} line1={t("hero.statGenuine1")} line2={t("hero.statGenuine2")} />
              <HeroStat icon={<TruckMini />} line1={t("hero.statSupply1")} line2={t("hero.statSupply2")} />
              <HeroStat icon={<RupeeMini />} line1={t("hero.statPrice1")} line2={t("hero.statPrice2")} />
              <HeroStat icon={<HeadsetMini />} line1={t("hero.statDealer1")} line2={t("hero.statDealer2")} />
            </div>
          </div>

          <div className="hero-col hero-col-right hidden lg:flex">
            <PensolPanel
              label={t("hero.labelPensol")}
              href={HERO_CATALOGUE_LINKS[3].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[3].label} catalogue`}
            />
            <ProductPanel
              side="right"
              src="/images/hero/cutouts/uj-cross.png"
              label={t("hero.labelUj")}
              href={HERO_CATALOGUE_LINKS[4].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[4].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <WaterPumpPanel
              label={t("hero.labelPumps")}
              href={HERO_CATALOGUE_LINKS[5].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[5].label} catalogue`}
            />
          </div>

          <div className="hero-mobile-panels z-[3] grid grid-cols-2 gap-2 px-2 pb-3 lg:hidden">
            <ProductPanel
              side="left"
              src="/images/hero/cutouts/outer-handles.png"
              label={t("hero.labelHandles")}
              href={HERO_CATALOGUE_LINKS[0].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[0].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <ProductPanel
              side="right"
              src="/images/hero/cutouts/cables.png"
              label={t("hero.labelCables")}
              href={HERO_CATALOGUE_LINKS[1].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[1].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <ProductPanel
              side="left"
              src="/images/hero/cutouts/window-regulators.png"
              label={t("hero.labelRegulators")}
              href={HERO_CATALOGUE_LINKS[2].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[2].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <PensolPanel
              label={t("hero.labelPensol")}
              href={HERO_CATALOGUE_LINKS[3].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[3].label} catalogue`}
              compact
            />
            <ProductPanel
              side="right"
              src="/images/hero/cutouts/uj-cross.png"
              label={t("hero.labelUj")}
              href={HERO_CATALOGUE_LINKS[4].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[4].label} catalogue`}
              imgClass="hero-cutout-lg"
            />
            <WaterPumpPanel
              label={t("hero.labelPumps")}
              href={HERO_CATALOGUE_LINKS[5].href}
              ariaLabel={`Open ${HERO_CATALOGUE_LINKS[5].label} catalogue`}
              compact
            />
          </div>
        </div>
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

function ProductPanel({
  src,
  label,
  href,
  ariaLabel,
  imgClass,
  side,
}: {
  src: string;
  label: string;
  href: string;
  ariaLabel: string;
  imgClass?: string;
  side: "left" | "right";
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className={`hero-panel hero-panel-${side} ${HERO_LINK_CLASS}`}>
      <span className="hero-product-label">{label}</span>
      <img src={src} alt="" className={`hero-panel-img ${imgClass ?? ""}`} />
    </Link>
  );
}

function PensolPanel({
  label,
  href,
  ariaLabel,
  compact = false,
}: {
  label: string;
  href: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className={`hero-panel hero-panel-right ${HERO_LINK_CLASS}`}>
      <span className="hero-product-label">{label}</span>
      <div className="hero-pensol-row">
        <img
          src="/images/hero/pensol-4st-extra.jpg"
          alt=""
          className={`w-auto max-w-[38%] object-contain hero-photo-knockout ${compact ? "h-[5.35rem]" : "h-[8.15rem]"}`}
        />
        <img
          src="/images/hero/pensol-4st-extra-sl.jpg"
          alt=""
          className={`-ml-1 w-auto max-w-[42%] object-contain hero-photo-knockout ${compact ? "h-[6.1rem]" : "h-[8.85rem]"}`}
        />
        <img
          src="/images/hero/pensol-ap-lr.jpg"
          alt=""
          className={`-ml-1 w-auto max-w-[34%] object-contain hero-photo-knockout ${compact ? "h-[4.5rem]" : "h-[6.85rem]"}`}
        />
      </div>
    </Link>
  );
}

function WaterPumpPanel({
  label,
  href,
  ariaLabel,
  compact = false,
}: {
  label: string;
  href: string;
  ariaLabel: string;
  compact?: boolean;
}) {
  const size = compact ? "h-[4.5rem]" : "h-[5.55rem]";
  return (
    <Link href={href} aria-label={ariaLabel} className={`hero-panel hero-panel-right ${HERO_LINK_CLASS}`}>
      <span className="hero-product-label">{label}</span>
      <div className="hero-pump-grid">
        <img src="/images/hero/pumps/m-547.png" alt="" className={`hero-pump-img w-auto object-contain ${size}`} />
        <img src="/images/hero/pumps/m-516.png" alt="" className={`hero-pump-img w-auto object-contain ${size}`} />
        <img src="/images/hero/pumps/m-518.png" alt="" className={`hero-pump-img w-auto object-contain ${size}`} />
        <img src="/images/hero/pumps/m-522.png" alt="" className={`hero-pump-img w-auto object-contain ${size}`} />
      </div>
    </Link>
  );
}

function HeroStat({ icon, line1, line2 }: { icon: ReactNode; line1: string; line2: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="hero-stat-badge inline-flex h-10 w-10 items-center justify-center rounded-full text-white">
        {icon}
      </span>
      <p className="max-w-[8.5rem] text-[10px] font-semibold leading-tight text-white">
        {line1}
        <br />
        {line2}
      </p>
    </div>
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

function CarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-5h14l2 5M5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 13h16" />
    </svg>
  );
}

function ShieldMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
    </svg>
  );
}

function TruckMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16V7h11v9M14 10h4l3 3v3h-7M7 18a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}

function RupeeMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 6h10M7 10h10M7 6c4 0 6 2 6 4s-2 4-6 4c2.5 0 6 2 8 4" />
    </svg>
  );
}

function HeadsetMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 1116 0v5a2 2 0 01-2 2h-2v-7h4M4 12v5a2 2 0 002 2h2v-7H4" />
    </svg>
  );
}
