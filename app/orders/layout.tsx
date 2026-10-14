import type { ReactNode } from "react";
import type { Metadata } from "next";

import { requireRole } from "@/lib/require-role";

/** A customer's own order history; see the note in app/checkout/layout.tsx. */
export const metadata: Metadata = {
  title: "Your Orders",
  robots: { index: false, follow: false },
};

export default async function OrdersLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["buyer"]);
  return children;
}
