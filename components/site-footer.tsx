"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { FIRM_STRIP, COPYRIGHT_YEAR } from "@/lib/brand";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

type FooterNavGroup = { id: string; name: string; href: string | null };

/**
 * V2 footer.
 *
 * Structured column directory over the seven groups the storefront actually
 * needs: Shop, Categories, Vehicle, Brands, Support, Company, Dealer.
 *
 * The Categories column is populated from the SAME endpoint the header's
 * category menu already reads (`/api/catalogue/categories`), so the footer can
 * never drift from the real catalogue taxonomy and no category is invented.
 * That endpoint is read-only here — it is not modified.
 */
export function SiteFooter() {
  const { t } = useI18n();
  const whatsappHref = getWhatsAppChatUrl();
  const [groups, setGroups] = useState<FooterNavGroup[]>([]);

  useEffect(() => {
    let active = true;
    void fetch("/api/catalogue/categories", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        const list: FooterNavGroup[] = Array.isArray(data?.groups) ? data.groups : [];
        // A directory must stay scannable: cap the column and point the rest of
        // the catalogue at the real index rather than rendering 40 links.
        setGroups(list.filter((group) => Boolean(group.href)).slice(0, 8));
      })
      .catch(() => {
        if (active) setGroups([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="relative mt-auto bg-[var(--sl-primary-dark)] text-white">
      {/* Single hairline seam. Depth comes from the flat burgundy field, not
          from stacked gradients. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(226,196,140,0.45) 50%, transparent 100%)",
        }}
        aria-hidden
      />

      {/* Vertical rhythm tightened after screenshot review. Column architecture,
          order and every link are unchanged \u2014 only the block padding and row
          gap were reduced, which removes the dead space at the bottom of the
          desktop footer without touching the layout. */}
      <div className="sl-container grid gap-x-8 gap-y-8 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:py-11">
        {/* Identity */}
        <div>
          <BrandLogo invert />
          <p className="sl-body mt-3 !text-white/70">{t("footer.blurb")}</p>
          <div className="mt-5">
            <WhatsAppCta href={whatsappHref} className="sl-v2-btn !border-white/25 !bg-white/10 !text-white hover:!bg-white/20" />
          </div>
        </div>

        <FooterColumn title={t("footer.shop")}>
          <FooterLink href="/">{t("nav.home")}</FooterLink>
          <FooterLink href="/offers">{t("nav.offers")}</FooterLink>
          <FooterLink href="/cart">{t("nav.cart")}</FooterLink>
          <FooterLink href="/wishlist">{t("nav.wishlist")}</FooterLink>
          <FooterLink href="/orders">{t("nav.orders")}</FooterLink>
          <FooterLink href="/track-order">{t("nav.track")}</FooterLink>
        </FooterColumn>

        {/* Real catalogue taxonomy, read live from the existing endpoint. */}
        <FooterColumn title={t("footer.categories")}>
          {groups.length > 0 ? (
            groups.map((group) => (
              <FooterLink key={group.id} href={group.href ?? "/category/filters"}>
                {group.name}
              </FooterLink>
            ))
          ) : (
            /* Reserve the column height so the footer never reflows when the
               catalogue request resolves. No placeholder names invented. */
            <span className="text-white/40">&nbsp;</span>
          )}
          <FooterLink href="/category/filters">{t("footer.allCategories")}</FooterLink>
        </FooterColumn>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
          <FooterColumn title={t("footer.vehicle")}>
            <FooterLink href="/vehicle-fitment">{t("nav.fitment")}</FooterLink>
            <FooterLink href="/brands">{t("nav.brands")}</FooterLink>
            <FooterLink href="/help-support">{t("nav.help")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("footer.company")}>
            <FooterLink href="/about-us">{t("nav.about")}</FooterLink>
            <FooterLink href="/about-us#hind-motors">Hind Motors</FooterLink>
            <FooterLink href="/about-us#ambaji-traders">Ambaji Traders</FooterLink>
            <FooterLink href="/about-us#india-sales">India Sales</FooterLink>
            <FooterLink href="/contact-us">{t("nav.contact")}</FooterLink>
          </FooterColumn>
        </div>

        <FooterColumn title={t("footer.dealer")}>
          <FooterLink href="/login/dealer">{t("nav.dealer")}</FooterLink>
          <FooterLink href="/dealer">Quick Order</FooterLink>
          <FooterLink href="/register">{t("nav.register")}</FooterLink>
          <FooterLink href="/login">{t("nav.login")}</FooterLink>
        </FooterColumn>

        <FooterColumn title={t("footer.support")}>
          <FooterLink href="/help-support">{t("nav.help")}</FooterLink>
          <FooterLink href="/returns-refunds">{t("legal.returns")}</FooterLink>
          <FooterLink href="/shipping-policy">{t("legal.shipping")}</FooterLink>
          <FooterLink href="/terms-and-conditions">{t("legal.terms")}</FooterLink>
          <FooterLink href="/privacy-policy">{t("legal.privacy")}</FooterLink>
        </FooterColumn>
      </div>

      {/*
        The three-firm identity is printed exactly ONCE, here in the legal band.
        It previously also appeared in the brand column, so the tagline rendered
        twice in one viewport.
      */}
      <div className="sl-container border-t border-white/10 py-4">
        <p className="sl-nav text-center text-[var(--sl-gold-soft)]">{FIRM_STRIP}</p>
        <p className="mt-1.5 text-center text-xs text-white/55">
          &copy; {COPYRIGHT_YEAR} {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="sl-label !text-white/85">{title}</h2>
      {/* Short gold rule: the accent is a separator, never a fill. */}
      <div className="mt-2 mb-3.5 h-px w-8 bg-[var(--sl-gold)]/70" aria-hidden />
      <nav className="flex flex-col items-start gap-2.5">{children}</nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded text-sm text-white/70 transition-colors duration-200 hover:text-white"
    >
      {children}
    </Link>
  );
}
