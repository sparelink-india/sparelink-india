"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function PasswordChangeGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (
      pathname === "/account/change-password" ||
      pathname === "/login" ||
      pathname === "/login/dealer" ||
      pathname.startsWith("/api/")
    ) {
      return;
    }

    void fetch("/api/auth/session-flags", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated && data.mustChangePassword) {
          router.replace("/account/change-password");
        }
      })
      .catch(() => undefined);
  }, [pathname, router]);

  return null;
}
