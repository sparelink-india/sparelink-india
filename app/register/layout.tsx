import type { ReactNode } from "react";

import { routeMetadata } from "@/lib/seo";

/* See app/brands/layout.tsx for why this is a layout: /register is a client
   component, so the metadata has to live one level up. */
export const metadata = routeMetadata({
  path: "/register",
  title: "Create a Buyer Account",
  description:
    "Register as a SpareLink India customer or workshop to order auto spare parts at wholesale prices with pan-India delivery.",
  noIndex: true,
});

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}