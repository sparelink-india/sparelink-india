import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo";

/* See app/brands/layout.tsx for why this is a layout: /offers is a client
   component, so the metadata has to live one level up. */
export const metadata = routeMetadata({
  path: "/offers",
  title: "Offers and Deals on Auto Spare Parts",
  description:
    "Current offers and deals on auto spare parts at SpareLink India, with wholesale pricing on braking, engine, electrical and filter parts.",
});

export default function OffersLayout({ children }: { children: ReactNode }) {
  return children;
}