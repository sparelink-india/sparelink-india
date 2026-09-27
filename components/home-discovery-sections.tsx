"use client";

import Link from "next/link";

import { useI18n } from "@/components/preferences-provider";
import { VehicleQuickSelector } from "@/components/vehicle-quick-selector";

/**
 * Homepage discovery sections that complete the customer journey:
 * find by vehicle -> why trust -> order -> support.
 *
 * Trust rule: every statement here is a verifiable fact about the actual
 * product (real payment methods, real fulfilment firms, real policies).
 * No invented statistics, no "10,000+ customers", no "India's #1".
 */

function ArrowGlyph({ className = "h-4 w-4" }: { className?: string }) {
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

function ShieldGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
    </svg>
  );
}

function RupeeGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" d="M7 6h10M7 10h10M7 6c4 0 6 2 6 4s-2 4-6 4c2.5 0 6 2 8 4" />
    </svg>
  );
}

function TruckGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v8H3V7zm11 3h4l3 3v2h-7v-5zM7 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

function HeadsetGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 1116 0v5a2 2 0 01-2 2h-2v-7h4M4 12v5a2 2 0 002 2h2v-7H4" />
    </svg>
  );
}

function CarGlyph() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-5h14l2 5M5 17a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 13h16" />
    </svg>
  );
}

/** FIND BY VEHICLE — reuses the existing, real VehicleQuickSelector. */
export function HomeFindByVehicle() {
  const { t } = useI18n();

  return (
    <section id="find-vehicle" className="sl-band border-b border-[var(--sl-border)]/70 bg-white/60">
      <div className="sl-container sl-container-wide">
        <div className="max-w-2xl">
          <p className="sl-label">{t("hero.findVehicle")}</p>
          <h2 className="sl-h2 mt-1.5">Make, model, year and variant</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--sl-muted)]">
            Select your vehicle to see parts that actually fit it.
          </p>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="sl-surface p-4 sm:p-5">
            {/*
              `limit={6}` keeps this homepage affordance compact: at most six
              saved vehicles, with a "N more" link to the full experience. The
              full /vehicle-fitment page is untouched and still lists every
              vehicle and model.
            */}
            <VehicleQuickSelector limit={6} />
          </div>
          <Link
            href="/vehicle-fitment"
            className="sl-v2-btn sl-v2-btn-secondary w-full shrink-0 lg:w-auto"
          >
            <CarGlyph />
            {t("vehicleSelect.browseAll")}
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Dealer / bulk-order entry point.
 *
 * The bulk part-number tool now lives at /dealer, behind the existing dealer
 * layout guard (session + role === "dealer"). Buyers are sent to
 * /login/dealer rather than straight to /dealer, because /dealer bounces
 * non-dealers to "/" and that would be a confusing dead end. Buyers who
 * already hold a dealer account simply sign in there.
 */
export function HomeDealerCta() {
  return (
    <section className="sl-band border-b border-[var(--sl-border)]/70 bg-white/70">
      <div className="sl-container sl-container-wide">
        <div className="sl-surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--sl-radius)] bg-[var(--sl-primary)] text-white"
              aria-hidden
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16V7h11v9M14 10h4l3 3v3h-7M7 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
                />
              </svg>
            </span>
            <div>
              <h2 className="sl-h2 text-lg">Dealer / Bulk Order</h2>
              <p className="mt-1 text-sm text-[var(--sl-muted)]">
                Login for faster bulk ordering. Enter part numbers with
                quantities and build a bulk cart in one go.
              </p>
            </div>
          </div>
          <Link href="/login/dealer" className="sl-v2-btn sl-v2-btn-primary shrink-0">
            Dealer login
            <svg
              className="h-4 w-4"
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
          </Link>
        </div>
      </div>
    </section>
  );
}

/** WHY SPARELINK — verifiable facts only. */
export function HomeWhySpareLink() {
  const { t } = useI18n();

  const reasons = [
    {
      icon: <RupeeGlyph />,
      title: "All prices include GST",
      body: "Every listed price is the final payable amount, so what you see is what you pay.",
      href: "/offers",
      cta: t("nav.offers"),
    },
    {
      icon: <TruckGlyph />,
      title: "Pay how you prefer",
      body: "Cash on delivery, bank transfer, or online payment through a secure gateway.",
      href: "/help-support",
      cta: t("nav.help"),
    },
    {
      icon: <ShieldGlyph />,
      title: "Documented policies",
      body: "Clear shipping, returns and terms published before you order.",
      href: "/shipping-policy",
      cta: t("legal.shipping"),
    },
    {
      icon: <HeadsetGlyph />,
      title: "Dealer-grade support",
      body: "Talk to us on WhatsApp or raise a support request from your account.",
      href: "/contact-us",
      cta: t("nav.contact"),
    },
  ];

  return (
    <section id="why-sparelink" className="sl-band border-b border-[var(--sl-border)]/70 bg-[var(--sl-primary-soft)]/30">
      <div className="sl-container sl-container-wide">
        <div className="max-w-2xl">
          <p className="sl-label">{t("trust.title")}</p>
          <h2 className="sl-h2 mt-1.5">Why trade through SpareLink India</h2>
          <p className="sl-body mt-2 max-w-prose">
            {/*
              The full three-firm tagline is printed exactly ONCE, in the
              footer legal band. Repeating it here put "A Group of Firms" twice
              in a single viewport, so this line now states the distribution
              relationship without restating the firm roster.
            */}
            {t("trust.fulfilledBy")}
          </p>
        </div>

        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <li key={reason.title} className="sl-v2-card sl-v2-card-hover sl-v2-rule flex flex-col p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--sl-radius)] bg-[var(--sl-primary)] text-white">
                {reason.icon}
              </span>
              <h3 className="sl-h3 mt-4">{reason.title}</h3>
              <p className="sl-small mt-1.5 flex-1">{reason.body}</p>
              <Link
                href={reason.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--sl-primary)] transition-colors duration-200 hover:text-[var(--sl-primary)]"
              >
                {reason.cta}
                <ArrowGlyph className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** ORDER + SUPPORT closing band. */
export function HomeOrderCta() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden" style={{ background: "var(--sl-grad-hero)" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--sl-grad-sheen)" }}
        aria-hidden
      />
      <div className="sl-container sl-container-wide py-12 sm:py-16">
        <div className="max-w-2xl">
          {/*
            Contrast fix. The type roles in globals.css are UNLAYERED, which
            means they outrank Tailwind's layered `text-white`. Without the
            `!` important modifier the heading rendered in --sl-text (near
            black) straight onto the burgundy band. The paragraph was also
            tinted at 80% opacity, which is too weak on a dark ground; it now
            uses an opaque high-luminance tint.
          */}
          <h2 className="sl-h2 !text-white">Ready to order your parts?</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-[#f0d9e1]">
            Search the catalogue, add parts to your cart, and choose the payment option that
            works for you. Existing customers can sign in to see past orders and saved vehicles.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/?focus=search" className="sl-v2-btn sl-v2-btn-primary sm:w-auto">
              {t("hero.browse")}
              <ArrowGlyph />
            </Link>
            <Link href="/cart" className="sl-v2-btn sl-v2-btn-ghost-invert sm:w-auto">
              {t("nav.cart")}
            </Link>
            <Link href="/help-support" className="sl-v2-btn sl-v2-btn-ghost-invert sm:w-auto">
              {t("nav.help")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
