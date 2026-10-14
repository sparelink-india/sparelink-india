"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { useI18n } from "@/components/preferences-provider";

/**
 * The storefront chrome: header, the page's <main>, footer, and the mobile
 * bottom nav. One composer for every page so no route has to hand-roll its own
 * header or footer, and no route can end up with two <header> landmarks.
 *
 * `showFooter` is the only knob. It exists for a genuinely terminal screen -
 * the order confirmation, where a footer full of links is noise between the
 * customer and their receipt. Everything else takes the footer.
 *
 * There used to be a `wide` prop whose two branches were both the string
 * "sl-container", so it never changed a pixel. The only two pages that passed
 * it, /about-us and /contact-us, cap their own measure internally
 * (max-w-3xl / max-w-[46rem] / max-w-2xl) inside the 1280px container, so they
 * did not need it either. It has been removed rather than given a real
 * behaviour: inventing a wider container nobody asked for would be new CSS
 * with no consumer.
 */
export function StorefrontShell({
  children,
  cartCount,
  showFooter = true,
}: {
  children: ReactNode;
  cartCount?: number;
  showFooter?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">
      {/* Keyboard skip link. The header is ~150px of focusable links before the
          page content begins, so a keyboard user had to tab through the whole
          masthead on every page. It is off-screen until focused, so it never
          affects the visual layout, and it is the first focusable element on the
          page so it is reachable with a single Tab. */}
      <a href="#main-content" className="sl-skip sl-focus">
        {t("a11y.skipToContent")}
      </a>
      <StorefrontHeader cartCount={cartCount} />
      <main
        id="main-content"
        className="sl-container flex-1"
      >
        {children}
      </main>
      {showFooter ? <SiteFooter /> : null}
      <Suspense fallback={null}>
        <MobileBottomNav cartCount={cartCount} />
      </Suspense>
    </div>
  );
}
