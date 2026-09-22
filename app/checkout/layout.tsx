import type { ReactNode } from "react";

import { PasswordReadyLayout } from "@/lib/password-ready-layout";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <PasswordReadyLayout>{children}</PasswordReadyLayout>;
}
