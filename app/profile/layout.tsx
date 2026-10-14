import type { ReactNode } from "react";
import type { Metadata } from "next";

import { requireRole } from "@/lib/require-role";

/** The customer's own account area; see app/checkout/layout.tsx. */
export const metadata: Metadata = {
  title: "Your Account",
  robots: { index: false, follow: false },
};

export default async function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["buyer"]);
  return children;
}
