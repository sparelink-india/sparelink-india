"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/preferences-provider";
import { authClient } from "@/lib/auth-client";

type GoogleSignInButtonProps = {
  /** Where Better Auth should return after Google login (app path). */
  callbackURL?: string;
  className?: string;
  /** Optional note shown under the button when Google is not configured. */
  showUnavailableHint?: boolean;
};

/**
 * Browser-only Google OAuth entry. Credentials stay on the server;
 * this only starts the Better Auth social redirect when configured.
 */
export function GoogleSignInButton({
  callbackURL = "/",
  className,
  showUnavailableHint = true,
}: GoogleSignInButtonProps) {
  const { t } = useI18n();
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/auth/login-options")
      .then((response) => response.json())
      .then((data) => setGoogleConfigured(Boolean(data.googleConfigured)))
      .catch(() => setGoogleConfigured(false));
  }, []);

  async function handleGoogle() {
    setError("");
    if (!googleConfigured) {
      setError(t("login.googleNeeded"));
      return;
    }
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } catch {
      setError(t("login.fail"));
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={busy || !googleConfigured}
        className={
          className ??
          "h-12 w-full rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] font-medium text-[var(--v3-text)] hover:bg-[var(--v3-sunk)] disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {busy ? t("login.googleBusy") : t("login.google")}
      </button>
      {!googleConfigured && showUnavailableHint ? (
        <p className="mt-2 text-center text-xs text-[var(--v3-text-3)]">
          {t("login.googleNeeded")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-[var(--v3-r)] bg-[var(--v3-bad-soft)] p-3 text-sm text-[var(--v3-bad)]">{error}</p>
      ) : null}
    </div>
  );
}
