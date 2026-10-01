"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { COPYRIGHT_YEAR, FIRM_STRIP } from "@/lib/brand";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

/**
 * A link in the footer index. `label` is already resolved so the arrays below
 * can be built in one place and read as data, not markup.
 */
type FooterLink = { href: string; label: string };

/** The link arrays, built once per render from the active dictionary. */
type FooterIndex = {
  shop: FooterLink[];
  categories: FooterLink[];
  vehicle: FooterLink[];
  dealer: FooterLink[];
  utility: FooterLink[];
};

/**
 * The storefront footer, rebuilt to the approved reference.
 *
 * Three bands:
 *
 *   1. DIRECTORY  brand block + four link columns, one row on desktop.
 *   2. UTILITY    one horizontal row of seven inline links, no labels.
 *   3. BAR        warm gold: the three-firm identity and the copyright.
 *
 * THE GROUND IS LIGHT. The previous footer was charcoal with a 2px burgundy
 * top rule, burgundy ticks on the column headings, a catalogue-fitment
 * caveat and a green underlined WhatsApp link. On a dark ground every one
 * of those accents had to fight the background, and the four burgundy
 * heading ticks read as a bar chart rather than as structure. On the light
 * cool grey the logo, the headings and the links are one quiet block using
 * the same tokens as the page, and the only saturated colour left in the
 * component is the gold bar - which is what makes it an accent.
 *
 * THE CATEGORIES COLUMN IS ONE LINK, ON PURPOSE. The reference shows a
 * single "All Categories" entry, so that is all this renders. The previous
 * version fetched `/api/catalogue/categories` after mount to pin three live
 * catalogue group landing pages above that link; with the groups gone the
 * request had no consumer, so it is gone with them. The endpoint itself is
 * untouched and every other page that reads it still does.
 *
 * NO PHONE NUMBER. WhatsApp Us and Contact Us are the two routes that
 * actually carry a request, and the published support number is already on
 * the contact page and in the header's help entry. Printing it a third time
 * in the footer is a third place to keep it correct, and it is the single
 * largest line of type in the old design.
 *
 * NO LABELS ON THE UTILITY ROW. A heading like "SUPPORT" above seven links
 * that are all, without exception, support pages is redundant, and a heading
 * above a one-line row is the one thing guaranteed to cost height without
 * buying meaning. The fitment caveat that used to sit beside it is gone for
 * the same reason; the warning still lives where a buyer reads it, on the
 * fitment route and in the product view.
 */
export function SiteFooter() {
  const { t } = useI18n();
  const whatsappHref = getWhatsAppChatUrl();

  const index: FooterIndex = {
    shop: [
      { href: "/", label: t("nav.home") },
      { href: "/offers", label: t("nav.offers") },
      { href: "/cart", label: t("nav.cart") },
      { href: "/orders", label: t("nav.orders") },
    ],
    /* One entry, the catalogue's own landing page. The individual group
       names (Water Pump Assy, Automotive Cables, Filters) are reachable
       from the header's category menu and from /category/filters; the
       footer column is a shortcut, not a second sitemap. */
    categories: [{ href: "/category/filters", label: t("footer.allCategories") }],
    vehicle: [
      { href: "/vehicle-fitment", label: t("nav.fitment") },
      { href: "/brands", label: t("nav.brands") },
    ],
    dealer: [
      /* Dealer Login is deliberately absent.
         It was a link in this column on every page, which put a trade-portal
         entry point in the same list as Contact Us and About Us. The ROUTE is
         untouched: /login/dealer still resolves for a direct visit, and the
         homepage's Dealer / Bulk Order band still links to it. */
      { href: "/dealer", label: t("footer.quickOrder") },
    ],
    /* The seven utility destinations in one flat row, in reference
       order. Each name is self-describing, so there are no group labels. */
    utility: [
      { href: "/help-support", label: t("nav.help") },
      { href: "/returns-refunds", label: t("legal.returns") },
      { href: "/shipping-policy", label: t("legal.shipping") },
      { href: "/terms-and-conditions", label: t("legal.terms") },
      { href: "/privacy-policy", label: t("legal.privacy") },
      { href: "/about-us", label: t("nav.about") },
      { href: "/contact-us", label: t("nav.contact") },
    ],
  };

  return (
    <footer className="v3-footer relative mt-auto">
      {/* ---------- BAND 1: DIRECTORY ----------
          4 + 2 + 2 + 2 + 2 across on desktop, so the brand block is four
          columns wide and the four link columns are equal and flush. The
          link columns get `auto-rows` from the shared `items-start`, which
          is what keeps all four headings on one baseline: the columns are
          top-aligned inside one grid row, so a one-link column and a
          four-link column start at the same y. */}
      <div className="v3-container grid grid-cols-2 items-start gap-x-5 gap-y-6 py-8 md:grid-cols-4 lg:grid-cols-12 lg:gap-x-6">
        <div className="col-span-2 md:col-span-4 lg:col-span-4">
          {/* The full logo, not the header's compact lockup: this is the
              largest mark on the site outside the header itself, and it is
              the one place the footer's brand block is the subject. No
              `invert` - the ground is light, so it is the same asset the
              header renders, unmodified. */}
          <BrandLogo />

          {/* Two lines, hard ceiling. See `.v3-footer-blurb`. */}
          <p className="v3-footer-blurb v3-clamp-2 mt-2.5 max-w-xs">
            {t("footer.blurb")}
          </p>

          {/* Two routes, one row, both icon-led. Deliberately not two
              buttons: at 13px these are links, and a filled WhatsApp pill
              here is the loudest thing in a band whose job is to be
              quiet. `WhatsAppCta` still owns the destination and the
              unconfigured-number state; `.v3-footer-link` overrides its
              green and its underline so it matches Contact Us. */}
          <address className="mt-3 flex flex-wrap items-center gap-x-5 not-italic">
            <WhatsAppCta
              href={whatsappHref}
              /* `WhatsAppCta` hardcodes its own green and `hover:underline`.
                 `.v3-footer-link` is unlayered CSS loading after Tailwind's
                 utility layer, so it wins on both and the two rows in this
                 address read as the same kind of link. */
              className="v3-footer-link v3-focus"
            />
            <Link
              href="/contact-us"
              className="v3-footer-link v3-focus gap-2 font-semibold"
            >
              <ContactIcon />
              {t("nav.contact")}
            </Link>
          </address>
        </div>

        <FooterColumn
          className="lg:col-span-2"
          title={t("footer.shop")}
          links={index.shop}
        />

        <FooterColumn
          className="lg:col-span-2"
          title={t("footer.categories")}
          links={index.categories}
        />

        <FooterColumn
          className="lg:col-span-2"
          title={t("footer.vehicle")}
          links={index.vehicle}
        />

        <FooterColumn
          className="lg:col-span-2"
          title={t("footer.dealer")}
          links={index.dealer}
        />
      </div>

      {/* ---------- BAND 2: UTILITY ROW ----------
          Seven links, one row, no label, no caveat. The leading four
          columns are held empty on desktop so the row starts under the
          SHOP column rather than under the logo - the reference places
          it in the right-hand two thirds - and right-aligns to the
          container edge. Below lg the spacer collapses and the row simply
          wraps from the left, which is the only sane behaviour for seven
          links on a phone. */}
      <div className="v3-footer-rule border-t">
        <nav
          aria-label={t("nav.help")}
          className="v3-container grid gap-y-0.5 py-4 lg:grid-cols-12 lg:py-5"
        >
          <span className="hidden lg:col-span-4 lg:block" aria-hidden />
          <ul className="flex flex-wrap items-baseline lg:col-span-8 lg:justify-end">
            {index.utility.map((link, position) => (
              <li key={link.href} className="flex items-baseline">
                {position > 0 ? (
                  <span className="v3-footer-sep" aria-hidden>
                    |
                  </span>
                ) : null}
                <FooterLink href={link.href}>{link.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* ---------- BAND 3: IDENTITY + COPYRIGHT ----------
          The three-firm identity is printed exactly ONCE, here, and shares
          a line with the copyright instead of stacking on two. Gold
          appears here and nowhere else in the footer. */}
      <div className="v3-footer-bar">
        <div className="v3-container flex flex-col items-center gap-1 py-4 text-center sm:flex-row sm:justify-between sm:text-left lg:py-5">
          <p className="v3-footer-firms">{FIRM_STRIP}</p>
          <p className="v3-footer-note">
            &copy; {COPYRIGHT_YEAR} {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * One band-1 column: a heading and a short stack of links.
 *
 * The heading is a plain `<h2>` in tracked caps. It is not a `.v3-head`,
 * which carries a burgundy tick in the left margin - four of those side by
 * side is the bar-chart effect the previous revision shipped, and the
 * reference has no mark of any kind on its headings.
 */
function FooterColumn({
  title,
  links,
  className = "",
}: {
  title: string;
  links: FooterLink[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="v3-footer-heading">{title}</h2>
      <nav className="mt-2 flex flex-col items-start">
        {links.map((link) => (
          <FooterLink key={link.href} href={link.href}>
            {link.label}
          </FooterLink>
        ))}
      </nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="v3-footer-link v3-focus whitespace-nowrap">
      {children}
    </Link>
  );
}

/**
 * The handset that stands in for "Contact Us". Same 24x24 stroke geometry as
 * the contact page's phone icon so the two are the same mark at two sizes.
 */
function ContactIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
    </svg>
  );
}
