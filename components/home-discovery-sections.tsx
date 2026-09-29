"use client";

import Link from "next/link";

import { useI18n } from "@/components/preferences-provider";

/**
 * V3 homepage discovery sections: dealer -> order.
 *
 * `HomeWhySpareLink` has been DELETED. It became dead code when the homepage
 * trust section was rebuilt inline in home-client.tsx, where the five
 * indicators now live as a single hairline-divided strip. Keeping it would have
 * meant maintaining a second, contradictory set of trust claims on the same
 * page. Nothing imports it.
 *
 * `HomeFindByVehicle` has ALSO been DELETED, and this is the fix for the
 * duplicated Vehicle Fitment section. It was the second render of the
 * homepage's vehicle finder: the same `VehicleQuickSelector` panel — the same
 * make selector, model selector, saved-garage list, "Show Compatible Parts"
 * action and save-to-garage behaviour — appearing twice on one page under two
 * different headings ("Find Parts for Your Vehicle" directly under the hero, and
 * "Make, model, year and variant" further down). Both were independent
 * additions: the quick finder was moved up under the hero for the V3 brief and
 * this older section at position 5 was never removed. Two panels with two
 * headings, both offering "find parts by vehicle", is a duplicate regardless of
 * how the strings differ.
 *
 * The surviving block is the one under the hero (`home-client.tsx` section 2).
 * It is the primary: it is the first thing below the headline, it is the one
 * the hero's own search entry points past, and its heading is the clearer of
 * the two. The promotional banner slider now occupies the space this section
 * used to hold, so the page gains a merchandising slot without the page gaining
 * a duplicate finder.
 *
 * The two remaining sections keep their role in the journey but are rebuilt on
 * the V3 section device — a burgundy left rule with a hairline under the
 * heading (`.v3-head`) — and, critically, every string now comes from the
 * dictionary. All eight headings and bodies in this file were previously
 * hardcoded English literals, so the Hindi homepage was rendering English in
 * the vehicle finder, the dealer band and the closing band.
 *
 * The translucent surfaces are also gone. These sections used
 * `bg-white/70` and `border-[var(--v3-rule)]/70`, so each band was a
 * semi-transparent layer stacked on the cream page and the hairlines between
 * bands were 70% opaque — the page read as four translucent sheets rather than
 * a set of distinct sections. V3 uses solid surfaces and full-opacity rules.
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

function TruckGlyph() {
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
      <path d="M3 7h11v8H3V7zm11 3h4l3 3v2h-7v-5zM7 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

/**
 * DEALER / BULK ORDER.
 *
 * The bulk part-number tool lives at /dealer, behind the existing dealer layout
 * guard (session + role === "dealer"). Buyers are sent to /login/dealer rather
 * than straight to /dealer, because /dealer bounces non-dealers to "/" and that
 * would be a confusing dead end.
 *
 * V3 composition change: this was a white card floating on a 70%-opaque white
 * band, so the band and the card were the same colour and the card had no edge
 * to sit against. It is now a full-width charcoal band with a gold rule — the
 * one place on the homepage that changes register, which is what separates the
 * B2B proposition from the retail sections above it.
 */
export function HomeDealerCta() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden bg-[var(--v3-inverse)] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "var(--v3-gold)" }}
        aria-hidden
      />
      <div className="v3-container py-9 sm:py-11">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] bg-white/10 text-[var(--v3-gold)]"
              aria-hidden
            >
              <TruckGlyph />
            </span>
            <div className="min-w-0">
              <h2 className="v3-h2 !text-white">{t("homeDealer.title")}</h2>
              <p className="mt-1.5 max-w-xl text-[0.8125rem] leading-relaxed text-white/65">
                {t("homeDealer.body")}
              </p>
            </div>
          </div>
          <Link
            href="/login/dealer"
            className="v3-btn v3-btn-inverse shrink-0 self-start lg:self-auto"
          >
            {t("homeDealer.cta")}
            <ArrowGlyph className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * CLOSING ORDER BAND.
 *
 * Flat charcoal with a gold rule, replacing V2's two stacked decorative
 * gradients whose only purpose was to make a full-bleed block look premium.
 *
 * The action set is reduced to two. V3 offered Browse / Cart / Help, where
 * "Cart" and "Help" are both reachable from the header on every page, so a
 * third and fourth button in the closing band duplicated persistent navigation
 * and pushed the primary action off the right edge at 1024px.
 */
export function HomeOrderCta() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden bg-[var(--v3-inverse)] text-white">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "var(--v3-gold)" }}
        aria-hidden
      />
      <div className="v3-container py-12 sm:py-14">
        <div className="max-w-2xl">
          <h2 className="v3-h2 !text-white">{t("homeOrder.title")}</h2>
          <p className="mt-2.5 text-[0.875rem] leading-relaxed text-white/70">
            {t("homeOrder.body")}
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Link href="/?focus=search" className="v3-btn v3-btn-primary sm:w-auto">
              {t("hero.browse")}
              <ArrowGlyph />
            </Link>
            <Link href="/cart" className="v3-btn v3-btn-inverse sm:w-auto">
              {t("nav.cart")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
