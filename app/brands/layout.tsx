import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo";

/* WHY A LAYOUT AND NOT THE PAGE.
   /brands is a client component - it filters the brand grid in the browser -
   and a "use client" module cannot export `metadata`. Without this file the
   route inherited the site-wide fallback and rendered the bare title
   "SpareLink India", identical to the homepage's.

   A layout is the one place in the App Router that both a client page and its
   server-rendered shell share, so it is where per-route metadata belongs when
   the page itself cannot carry it. This layout renders `children` unchanged and
   adds no wrapper element, so it cannot affect layout or the DOM tree. */
export const metadata = routeMetadata({
  path: "/brands",
  title: "Auto Spare Part Brands",
  description:
    "Browse the automotive spare part brands stocked by SpareLink India, from OE and OEM suppliers to quality aftermarket manufacturers.",
});

export default function BrandsLayout({ children }: { children: ReactNode }) {
  return children;
}