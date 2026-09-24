import type { ReactNode } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import { requireRole } from "@/lib/require-role";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["admin"]);

  return (
    <>
      <div className="fixed right-4 top-3 z-50 sm:right-6">
        <SignOutButton className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-60" />
      </div>
      <div className="min-h-screen pt-12">{children}</div>
    </>
  );
}