"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useI18n } from "@/components/preferences-provider";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { FIRM_STRIP, COPYRIGHT_YEAR } from "@/lib/brand";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

export function SiteFooter() {
  const { t } = useI18n();
  const whatsappHref = getWhatsAppChatUrl();

  return (
    <footer className="bg-[#111111] py-12 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <BrandLogo invert />
          <p className="mt-3 text-sm text-slate-400">{t("footer.blurb")}</p>
          <p className="mt-4 text-xs font-semibold text-[#e7b4c3]">{FIRM_STRIP}</p>
          <div className="mt-4">
            <WhatsAppCta href={whatsappHref} />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">{t("footer.quick")}</h2>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/" className="hover:text-white">
              {t("nav.home")}
            </Link>
            <Link href="/cart" className="hover:text-white">
              {t("nav.cart")}
            </Link>
            <Link href="/track-order" className="hover:text-white">
              {t("nav.track")}
            </Link>
            <Link href="/help-support" className="hover:text-white">
              {t("nav.help")}
            </Link>
            <Link href="/login" className="hover:text-white">
              {t("nav.login")}
            </Link>
            <Link href="/login/dealer" className="hover:text-white">
              {t("nav.dealer")}
            </Link>
            <Link href="/about-us" className="hover:text-white">
              {t("nav.about")}
            </Link>
            <Link href="/contact-us" className="hover:text-white">
              {t("nav.contact")}
            </Link>
          </nav>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">{t("footer.firms")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/about-us#hind-motors" className="hover:text-white">
                Hind Motors
              </Link>
            </li>
            <li>
              <Link href="/about-us#ambaji-traders" className="hover:text-white">
                Ambaji Traders
              </Link>
            </li>
            <li>
              <Link href="/about-us#india-sales" className="hover:text-white">
                India Sales
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">{t("footer.support")}</h2>
          <nav className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/track-order" className="hover:text-white">
              {t("nav.track")}
            </Link>
            <Link href="/help-support" className="hover:text-white">
              {t("nav.help")}
            </Link>
            <Link href="/returns-refunds" className="hover:text-white">
              {t("legal.returns")}
            </Link>
            <Link href="/shipping-policy" className="hover:text-white">
              {t("legal.shipping")}
            </Link>
            <Link href="/terms-and-conditions" className="hover:text-white">
              {t("legal.terms")}
            </Link>
            <Link href="/privacy-policy" className="hover:text-white">
              {t("legal.privacy")}
            </Link>
          </nav>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-slate-500">
        &copy; {COPYRIGHT_YEAR} {t("footer.rights")}
        <span className="mt-2 block">{FIRM_STRIP}</span>
      </p>
    </footer>
  );
}
