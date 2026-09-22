"use client";

import { Suspense } from "react";

import { PublicBrandsSection } from "@/components/public-brand-grid";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";

export default function BrandsPage() {
  return (
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex-1">
        <PublicBrandsSection headingId="brands-page-heading" headingLevel="h1" />
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
