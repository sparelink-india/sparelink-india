import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth-server";
import { isMustChangePassword } from "@/lib/must-change-password";

export default async function DealerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login/dealer");
  }
  if (session.user.role !== "dealer") {
    redirect("/");
  }
  if (await isMustChangePassword(session.user.id)) {
    redirect("/account/change-password");
  }
  return children;
}
