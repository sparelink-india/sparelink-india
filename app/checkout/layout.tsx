import type { ReactNode } from "react";
import type { Metadata } from "next";

import { PasswordReadyLayout } from "@/lib/password-ready-layout";

/**
 * Checkout is per-visitor and transactional: it has nothing a search result
 * should point at, and an indexed checkout URL invites abuse. The page itself is
 * a client component, so the directive is declared here.
 */
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <PasswordReadyLayout>{children}</PasswordReadyLayout>;
}
