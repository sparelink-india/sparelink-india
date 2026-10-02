import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo";

/* See app/brands/layout.tsx for why this is a layout: /track-order is a client
   component, so the metadata has to live one level up. */
export const metadata = routeMetadata({
  path: "/track-order",
  title: "Track Your Order",
  description:
    "Track the status of your SpareLink India spare parts order, from dispatch through to delivery.",
});

export default function TrackOrderLayout({ children }: { children: ReactNode }) {
  return children;
}