import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";

export function FitmentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
