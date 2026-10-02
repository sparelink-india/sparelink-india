import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo";

/* See app/brands/layout.tsx for why this is a layout: /help-support is a client
   component, so the metadata has to live one level up. */
export const metadata = routeMetadata({
  path: "/help-support",
  title: "Customer Support and Help",
  description:
    "Get help with orders, delivery, invoices, returns and vehicle compatibility from SpareLink India customer support.",
});

export default function HelpSupportLayout({ children }: { children: ReactNode }) {
  return children;
}