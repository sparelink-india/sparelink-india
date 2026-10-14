import type { ReactNode } from "react";
import type { Metadata } from "next";

import { requireRole } from "@/lib/require-role";

/** A customer's own saved parts; see the note in app/checkout/layout.tsx. */
export const metadata: Metadata = {
  title: "Your Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["buyer"]);
  return children;
}
