"use client";

import { Suspense } from "react";

import { PublicBrandsDirectorySection } from "@/components/public-brand-grid";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { useI18n } from "@/components/preferences-provider";

/**
 * V2 /brands — a filterable, alphabetically grouped brand directory.
 * The data source (PUBLIC_BRANDS) and every destination link are unchanged.
 */
export default function BrandsPage() {
  const { t } = useI18n();
  return (
    <div className="storefront-mobile-pad flex min-h-screen flex-col">
      {/* Keyboard skip link, matching StorefrontShell and the homepage. This
          page hand-rolls its chrome instead of using StorefrontShell, so the
          link and the `id="main-content"` target below both have to be
          repeated here for the link to actually resolve. */}
      <a href="#main-content" className="sl-skip sl-focus">
        {t("a11y.skipToContent")}
      </a>
      <StorefrontHeader />
      <main id="main-content" className="flex-1">
        <PublicBrandsDirectorySection />
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
