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
      {/* Presentation only: Precision's secondary button gives this the same
          surface, radius, focus and disabled treatment as every other control
          on the auth pages. The label, the flow, the config probe and the
          `provider: "google"` redirect are untouched, and no Google logo is
          added or removed — the button keeps exactly the branding it had. */}
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={busy || !googleConfigured}
        className={className ?? "sl-btn sl-btn-secondary sl-btn-block"}
      >
        {busy ? t("login.googleBusy") : t("login.google")}
      </button>
      {!googleConfigured && showUnavailableHint ? (
        <p className="mt-2 text-center text-xs text-[var(--sl-ink-3)]">
          {t("login.googleNeeded")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-[var(--sl-r)] bg-[var(--sl-bad-soft)] p-3 text-sm text-[var(--sl-bad)]">{error}</p>
      ) : null}
    </div>
  );
}
