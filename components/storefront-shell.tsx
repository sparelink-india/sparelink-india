"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

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
 * "v3-container", so it never changed a pixel. The only two pages that passed
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
  return (
    <div className="storefront-mobile-pad v3-page-root flex min-h-screen flex-col">
      <StorefrontHeader cartCount={cartCount} />
      <main className="v3-container v3-page-root-main flex-1">{children}</main>
      {showFooter ? <SiteFooter /> : null}
      <Suspense fallback={null}>
        <MobileBottomNav cartCount={cartCount} />
      </Suspense>
      {/* NO floating WhatsApp control here.

          It used to be mounted in this shell, which meant it appeared on the
          six routes that use StorefrontShell and on no other route - 17 of 23
          storefront routes had no floating button at all, and the HOMEPAGE was
          one of them.

          The control now lives in `StorefrontHeader`, because that is the one
          component every customer-facing storefront route renders: this shell
          renders it, `fitment-shell` renders it, and the routes that hand-
          compose the chrome render it directly. One mount, one instance, every
          page. Mounting it here as well would have produced two buttons on
          every shell route. */}
    </div>
  );
}
