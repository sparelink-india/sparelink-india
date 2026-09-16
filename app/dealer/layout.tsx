import type { ReactNode } from "react";

import { requireRole } from "@/lib/require-role";

export default async function DealerLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["dealer"]);
  return children;
}
