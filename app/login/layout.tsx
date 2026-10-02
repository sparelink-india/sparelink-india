import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo";

/* See app/brands/layout.tsx for why this is a layout: /login is a client
   component, so the metadata has to live one level up.

   `noIndex` here because a sign-in screen is not a page anyone searches for,
   and several of its query-string variants (?next=, redirects) would otherwise
   be indexed as separate thin URLs pointing at the same form. */
export const metadata = routeMetadata({
  path: "/login",
  title: "Sign In",
  description:
    "Sign in to your SpareLink India account to track orders, download invoices and reorder spare parts.",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}