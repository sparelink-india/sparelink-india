import type { ReactNode } from "react";

import { requirePasswordReadyPage } from "@/lib/require-role";

export async function PasswordReadyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePasswordReadyPage();
  return children;
}
