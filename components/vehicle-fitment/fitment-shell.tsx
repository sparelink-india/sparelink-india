import type { ReactNode } from "react";
import { Suspense } from "react";

import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { T } from "@/components/t";

/**
 * Vehicle-fitment shell (Precision).
 *
 * The fitment routes are a CATALOGUE, not an app, so the shell frames them as
 * one: a skip link so a keyboard user can reach the make selector without
 * tabbing the whole header, a `<main>` that owns the page, and the fitment
 * surface declared once here rather than restated on each of the three routes.
 *
 * The page ground is set on the wrapper rather than inherited, so the
 * catalogue bands always sit on `--sl-page` (warm neutral, never white) even
 * when a route forgets to declare it — the same reason a page-root class
 * exists, applied once for the whole subtree.
 *
 * The skip link is the shared `.sl-skip` device used by `StorefrontShell`: it
 * is off-screen until focused and is the first focusable element on the page.
 * Its label is the shared `a11y.skipToContent` key, so the link is translated
 * exactly like the rest of the chrome; `#fitment-main` is the `<main>` below,
 * which is where the label promises to land.
 *
 * Routing and fitment behaviour are unchanged: this is a layout wrapper only,
 * and it renders exactly the same header, footer and mobile nav as before.
 */
export function FitmentShell({ children }: { children: ReactNode }) {
  return (
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-[var(--sl-page)] text-[var(--sl-ink)]">
      <a href="#fitment-main" className="sl-skip sl-focus">
        <T k="a11y.skipToContent" />
      </a>
      <StorefrontHeader />
      <main id="fitment-main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
