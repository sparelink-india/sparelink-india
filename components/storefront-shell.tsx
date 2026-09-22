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
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader cartCount={cartCount} />
      <main
        className={`mx-auto w-full flex-1 px-4 py-8 sm:py-10 ${wide ? "max-w-4xl" : "max-w-3xl"}`}
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
