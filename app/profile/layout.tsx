import type { ReactNode } from "react";

import { requireRole } from "@/lib/require-role";

export default async function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["buyer"]);
  return children;
}
