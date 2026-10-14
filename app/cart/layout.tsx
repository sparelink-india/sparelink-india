import type { ReactNode } from "react";
import type { Metadata } from "next";

import { PasswordReadyLayout } from "@/lib/password-ready-layout";

/** Per-visitor and transactional; see the note in app/checkout/layout.tsx. */
export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: { children: ReactNode }) {
  return <PasswordReadyLayout>{children}</PasswordReadyLayout>;
}
