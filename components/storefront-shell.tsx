import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export function StorefrontShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main
        className={`mx-auto w-full flex-1 px-4 py-10 ${wide ? "max-w-4xl" : "max-w-3xl"}`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
