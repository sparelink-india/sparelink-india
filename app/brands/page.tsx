"use client";

import { PublicBrandsSection } from "@/components/public-brand-grid";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export default function BrandsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex-1">
        <PublicBrandsSection headingId="brands-page-heading" headingLevel="h1" />
      </main>
      <SiteFooter />
    </div>
  );
}
