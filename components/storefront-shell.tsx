"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";

import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export function StorefrontShell({
  children,
  wide = false,
  cartCount,
  showFooter = true,
}: {
  children: ReactNode;
  wide?: boolean;
  cartCount?: number;
  showFooter?: boolean;
}) {
  return (
    <div className="storefront-mobile-pad sl-page flex min-h-screen flex-col">
      <StorefrontHeader cartCount={cartCount} />
      {/*
       * One container for every shell page. `wide` is the only knob, and both
       * variants come from the shared container system so these pages align
       * with the header, footer and the rest of the storefront.
       */}
      <main
        className={`sl-container sl-page-main flex-1 ${wide ? "sl-container-prose-lg" : "sl-container-prose"}`}
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
