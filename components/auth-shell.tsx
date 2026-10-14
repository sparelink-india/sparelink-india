"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { T } from "@/components/t";

/**
 * PRECISION authentication system (migrated from the V3 shell).
 *
 * SHARED BY /login, /register AND /login/dealer, so the three pages read as one
 * system while remaining distinguishable.
 *
 * The change from V2 is a deletion as much as an addition. V2 put a 46%-width,
 * full-viewport-height burgundy panel on the left carrying the brand story and
 * three icon bullets, with the form in the remaining 54%. That is a "giant
 * empty split panel": on a 1280x800 window it consumed 590px and 800px of
 * surface to communicate three sentences, and on a 1024x800 laptop window the
 * form column was squeezed to ~430px for a set of two inputs.
 *
 * V3 is a single centred column with the context moved BELOW the form as a
 * hairline-divided capability strip:
 *
 *     identity lockup
 *     eyebrow / heading / intro
 *     the form                     <- the only thing above the fold
 *     capability strip (3 cells)   <- stated once, compactly, under the fold
 *     footer note
 *
 * The form is now the largest, first and only thing a customer sees, and it
 * gets the full width of the column on every breakpoint.
 *
 * THE DEALER VARIANT is the same composition in a different register: a
 * charcoal band behind the form and a gold rule instead of a burgundy one, plus
 * a "business access" tag. Same system, unmistakably a different door.
 *
 * The capability strip states only what the business can substantiate. No
 * customer counts, no years, no awards, no coverage figures — all of those
 * would be invented.
 */

export type AuthPanelBullet = { title: string; body: string };

function WrenchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
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
  /** `dealer` switches the accent from burgundy to gold on a charcoal field. */
  variant?: "customer" | "dealer";
}) {
  const isDealer = variant === "dealer";

  return (
    /* The caller supplies the storefront header and footer; this component owns
       only the body column, so it can be reused by pages with different shells
       without nesting two `min-h-screen` wrappers.

       The DEALER difference is the GROUND the column sits on, not the form
       itself. An earlier pass put the form directly on charcoal, which would
       have forced every label, hint and helper string inside all three auth
       forms to be restyled for contrast and would silently break the day a new
       field was added. Instead the whole column sits on a charcoal field and
       the form stays a white panel — unmistakably a different door, one
       composed of the same parts, and no form internals are variant-aware. */
    /* This element is the page's <main>. V2 had one here; the V3 rewrite
       replaced it with a <div>, which left /login, /login/dealer and /register
       with no main landmark while every other storefront route had one.
       Only the element name changes — the classes are untouched. */
    <main
      className={`flex flex-1 justify-center px-4 py-9 sm:px-6 sm:py-12 ${
        isDealer ? "bg-[var(--sl-graphite)]" : "bg-[var(--sl-page)]"
      }`}
    >
      <div className="w-full max-w-[30rem]">
        {/* ---- identity lockup ---- */}
        <Link
          href="/"
          className={`sl-focus inline-flex items-center gap-2 text-[0.8125rem] font-bold tracking-tight ${
            isDealer ? "text-[var(--sl-graphite-ink)]" : "text-[var(--sl-ink)]"
          }`}
        >
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--sl-r-xs)] ${
              isDealer
                ? "bg-[var(--sl-graphite-2)] text-[var(--v3-gold)]"
                : "bg-[var(--sl-brand)] text-[var(--sl-graphite-ink)]"
            }`}
          >
            <WrenchIcon />
          </span>
          SpareLink India
          {isDealer ? (
            <span className="sl-badge sl-badge-copper !text-[0.5625rem]">
              <T k="auth.businessAccess" />
            </span>
          ) : null}
        </Link>

        {/* ---- identity of the form itself ---- */}
        <div className="mt-7">
          <p
            className={`sl-eyebrow sl-eyebrow-plain flex items-center gap-2 ${
              isDealer ? "!text-[var(--v3-gold)]" : ""
            }`}
          >
            <span
              className="inline-block h-[3px] w-[18px] rounded-[2px]"
              style={{
                background: isDealer ? "var(--v3-gold)" : "var(--sl-brand)",
              }}
              aria-hidden
            />
            {eyebrow}
          </p>
          <h1
            className={`sl-display mt-3 ${isDealer ? "!text-[var(--sl-graphite-ink)]" : ""}`}
          >
            {heading}
          </h1>
          <p
            className={`sl-body mt-2.5 ${
              isDealer ? "!text-[var(--sl-graphite-ink-2)]" : ""
            }`}
          >
            {intro}
          </p>
        </div>

        {/* ---- the form ----
            The surface colour for both variants, so the three auth pages share
            one set of field styles and a new field never needs a contrast
            decision. The dealer variant only differs by its accent border. */}
        <div
          className={`sl-panel sl-panel-pad mt-6 border text-[var(--sl-ink)] ${
            isDealer
              ? "border-[var(--v3-gold)]"
              : "border-[var(--sl-rule-2)]"
          }`}
        >
          {children}
        </div>

        {/* ---- capability strip ----
            One hairline-divided row of three cells, below the fold. This is
            where V2's 590px burgundy panel went: the same three facts, in a
            strip roughly 70px tall. */}
        {bullets.length > 0 ? (
          <ul className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--sl-r)] border border-[var(--sl-rule)] bg-[var(--sl-rule)] sm:grid-cols-3">
            {bullets.map((bullet) => (
              <li
                key={bullet.title}
                className="bg-[var(--sl-surface)] px-3 py-3"
              >
                <p className="flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--sl-ink)]">
                  <span
                    className="inline-block h-2.5 w-[3px] shrink-0"
                    style={{
                      background: isDealer
                        ? "var(--v3-gold)"
                        : "var(--sl-brand)",
                    }}
                    aria-hidden
                  />
                  {bullet.title}
                </p>
                <p className="sl-micro mt-1.5 leading-snug">
                  {bullet.body}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {/* The footer note is authored by each page and carries its own colours,
            so the dealer variant cannot restyle it inline. A scoped attribute
            selector handles the contrast once, here, instead of every page
            having to know which ground it is sitting on. */}
        {footerNote ? (
          <div className="mt-5" data-auth-footer={isDealer ? "dark" : "light"}>
            {footerNote}
          </div>
        ) : null}
      </div>
    </main>
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
      className={`mt-4 rounded-[var(--sl-r)] border px-3.5 py-2.5 text-sm ${
        ok
          ? "border-[var(--sl-ok-line)] bg-[var(--sl-ok-soft)] text-[var(--sl-ok)]"
          : "border-[var(--sl-bad-line)] bg-[var(--sl-bad-soft)] text-[var(--sl-bad)]"
      }`}
    >
      {children}
    </p>
  );
}
