"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * V2 authentication shell — a genuine split-panel composition, not a centred
 * card on a blank page.
 *
 * Desktop is two columns: a brand/trust panel on the left that carries the
 * automotive identity, and the form on the right. Below `lg` the brand panel is
 * dropped entirely so mobile gets one focused, single-column screen with no
 * decorative weight above the fold.
 *
 * The trust panel states only what the business can substantiate (its three
 * distribution firms and what the catalogue actually supports). No invented
 * claims: no customer counts, no years, no awards, no coverage numbers.
 */

export type AuthPanelBullet = { title: string; body: string };

function WrenchIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.7 6.3a4 4 0 105.6 5.6l-2.3-2.3 1.4-1.4-2.5-2.5-1.4 1.4-2.3-2.3z" />
      <path d="M12.6 11.4L4 20a2 2 0 102.8 2.8l8.6-8.6" />
    </svg>
  );
}

export function AuthShell({
  eyebrow,
  heading,
  intro,
  bullets,
  children,
  footerNote,
  variant = "customer",
}: {
  eyebrow: string;
  heading: string;
  intro: string;
  bullets: AuthPanelBullet[];
  children: ReactNode;
  footerNote?: ReactNode;
  /** `dealer` shifts the panel to a cooler, more utilitarian B2B register. */
  variant?: "customer" | "dealer";
}) {
  /* `variant` currently drives no behavioural difference; the distinct B2B
     identity comes from the copy the caller passes in. Kept as an accepted
     prop so a future variant does not need a breaking change. */
  void variant;

  return (
    /* The caller supplies the storefront header and footer; this component owns
       only the split-panel body so it can be reused by pages with different
       shells without nesting two `min-h-screen` wrappers. */
    <div className="flex flex-1 items-stretch">
      {/* ---------- BRAND / TRUST PANEL (desktop only) ---------- */}
        <aside
          className="relative hidden w-[46%] shrink-0 overflow-hidden bg-[var(--sl-primary-dark)] text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14"
          aria-hidden={false}
        >
          {/* Subtle radial lift so the flat burgundy field has depth without a
              second gradient stack fighting the brand colour. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 15% 0%, rgba(226,196,140,0.16) 0%, transparent 55%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(226,196,140,0.5) 50%, transparent 100%)",
            }}
            aria-hidden
          />

          <div className="relative">
            <Link
              href="/"
              className="sl-v2-focus-invert inline-flex items-center gap-2 text-sm font-bold tracking-tight"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--sl-radius-sm)] bg-white/10">
                <WrenchIcon />
              </span>
              SpareLink India
            </Link>

            <p className="sl-label mt-12 !text-[var(--sl-gold-soft)]">{eyebrow}</p>
            <h2 className="sl-display mt-3 !text-white">{heading}</h2>
            <p className="sl-body mt-4 max-w-sm !text-white/70">{intro}</p>

            <ul className="mt-10 max-w-sm space-y-5">
              {bullets.map((bullet) => (
                <li key={bullet.title} className="flex gap-3.5">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-white/10 text-[var(--sl-gold-soft)]">
                    <WrenchIcon />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-white">{bullet.title}</span>
                    <span className="sl-small mt-0.5 block !text-white/60">{bullet.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/*
            No firm line here. The three-firm identity is printed exactly once
            per page, in the SiteFooter legal band. Repeating it in the auth
            panel put "A Group of Firms" twice in one viewport, and both login
            and dealer-login render a footer alongside this panel.
          */}
        </aside>

        {/* ---------- FORM COLUMN ---------- */}
        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[26rem]">
            {/* Mobile-only brand lockup: on phones the aside is hidden, so the
                panel would otherwise have no identity at all. */}
            <div className="mb-8 lg:hidden">
              <Link
                href="/"
                className="sl-v2-focus inline-flex items-center gap-2 text-sm font-bold text-[var(--sl-text)]"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary)] text-white">
                  <WrenchIcon />
                </span>
                SpareLink India
              </Link>
            </div>

            <p className="sl-label">{eyebrow}</p>
            <h1 className="sl-h1 mt-2">{heading}</h1>
            <p className="sl-body mt-2.5">{intro}</p>

            <div className="sl-v2-card mt-7 p-5 sm:p-6">{children}</div>

            {footerNote ? <div className="mt-6">{footerNote}</div> : null}
          </div>
        </main>
    </div>
  );
}

/** Shared inline alert used for auth success/error, so all three pages match. */
export function AuthAlert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  const ok = tone === "success";
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`mt-4 rounded-[var(--sl-radius-sm)] border px-3.5 py-2.5 text-sm ${
        ok
          ? "border-[#bfe3d4] bg-[var(--sl-success-soft)] text-[var(--sl-success)]"
          : "border-[#f0c8c5] bg-[var(--sl-danger-soft)] text-[var(--sl-danger)]"
      }`}
    >
      {children}
    </p>
  );
}
