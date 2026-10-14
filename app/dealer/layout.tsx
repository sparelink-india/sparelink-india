import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth-server";
import { isMustChangePassword } from "@/lib/must-change-password";

/** The dealer portal is private; see the note in app/admin/layout.tsx. */
export const metadata: Metadata = {
  title: { default: "Dealer Portal", template: "%s | SpareLink India Dealer" },
  robots: { index: false, follow: false },
};

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
