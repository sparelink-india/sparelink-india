"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/preferences-provider";
import { authClient } from "@/lib/auth-client";

type SignOutButtonProps = {
  className?: string;
  /**
   * Optional accessible name for the control, for the places that present it
   * inside a named section - the Profile menu calls it "Logout". The visible
   * text is unchanged; this only supplies the accessible name where the
   * surrounding context needs a more specific one.
   */
  ariaLabel?: string;
  /**
   * Called after the sign-out has been attempted, so a caller holding its own
   * copy of the session can re-read it. The header does this: without it the
   * header would keep rendering the signed-in controls until a full route
   * change, and `router.refresh()` alone does not re-run a client fetch that
   * already resolved.
   */
  onSignedOut?: () => void;
};

export function SignOutButton({ className, ariaLabel, onSignedOut }: SignOutButtonProps) {
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
      // Refresh the caller's session BEFORE navigating, so the header has the
      // anonymous answer when it re-renders on the destination page.
      onSignedOut?.();
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
      aria-label={ariaLabel}
      className={
        className ??
        /* The default is a V3 quiet button.

           It has moved twice: raw `zinc-*` -> the slate family (neither `text-zinc-700`
           nor `hover:bg-zinc-100` was in the dark allow-list, so this button rendered
           as dark ink on a remapped dark card wherever a caller passed no
           className) -> the `v3-btn v3-btn-quiet` tokens.

           The token is the correct end state rather than another palette swap: the
           allow-list is hand-maintained, so the reliable way to stop a colour being
           wrong in dark mode is to stop naming a colour at all. */

        "v3-btn v3-btn-quiet v3-focus !min-h-9 !px-3 !py-1.5 !text-xs"
      }
    >
      {isSigningOut ? t("signOutBusy") : t("signOut")}
    </button>
  );
}
