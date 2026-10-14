"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/preferences-provider";
import { authClient } from "@/lib/auth-client";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message || "Unable to sign out.");
      }
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      router.replace("/login");
      router.refresh();
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={isSigningOut}
      className={
        className ??
        // The defaults were fixed zinc values (border-zinc-300 / text-zinc-700),
        // so the button stayed dark-on-dark once `html.dark` was set: 1.85:1.
        // Swapped for the Precision tokens the rest of the account chrome uses
        // (--sl-rule-2 / --sl-ink-2 / --sl-sunken). The surface stays
        // transparent, as it was, rather than gaining a background it never
        // had; `.sl-focus` replaces the old hand-rolled focus ring so the ring
        // is the system's own brand outline in both themes.
        "sl-focus rounded-[var(--sl-r)] border border-[var(--sl-rule-2)] px-3 py-1.5 text-xs font-semibold text-[var(--sl-ink-2)] transition-colors hover:bg-[var(--sl-sunken)] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {isSigningOut ? t("signOutBusy") : t("signOut")}
    </button>
  );
}
