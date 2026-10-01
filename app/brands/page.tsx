"use client";

import { Suspense } from "react";

import { PublicBrandsDirectorySection } from "@/components/public-brand-grid";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";

/**
 * V2 /brands — a filterable, alphabetically grouped brand directory.
 * The data source (PUBLIC_BRANDS) and every destination link are unchanged.
 */
export default function BrandsPage() {
  return (
    <div className="storefront-mobile-pad v3-page-root flex min-h-screen flex-col">
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
