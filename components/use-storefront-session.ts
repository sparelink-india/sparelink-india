"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/preferences-provider";

/**
 * The visitor's session, as the storefront needs to know it.
 *
 * WHY THIS EXISTS. The header used to render "Login / Register" on a fixed
 * timer - always - so a signed-in customer still saw it after signing in.
 * Hiding it with CSS was rejected: that leaves the link in the DOM, focusable
 * and announced by a screen reader, and it does nothing for the mobile drawer
 * or the footer. The rendered output has to reflect the real session.
 *
 * WHY A FETCH AND NOT A SERVER PROP. `StorefrontHeader` is a client component
 * used by ~40 routes, most of which are already server components. Threading
 * a session prop through every one of them is a wide change for one boolean,
 * and the header is inside a Suspense boundary on some routes, so a slow
 * session read would hold the page. The existing
 * `/api/auth/session-flags` endpoint already answers exactly this question and
 * is already used by the dealer and account pages, so this reuses it rather
 * than adding an endpoint.
 *
 * WHY null IS DISTINCT FROM false. `null` means "not known yet". Rendering
 * Login during that window is correct: a signed-in visitor sees it for a few
 * hundred milliseconds and then it is replaced, which is better than a
 * flash of "Logout" for an anonymous visitor, and much better than rendering
 * Logout unconditionally and offering a button that cannot work.
 */
export type SessionState = {
  authenticated: boolean;
  role: "buyer" | "dealer" | "admin" | null;
  loading: boolean;
};

const ANONYMOUS: SessionState = { authenticated: false, role: null, loading: false };

export function useStorefrontSession(): SessionState & { refresh: () => void } {
  const { locale } = useI18n();
  const [state, setState] = useState<SessionState>({
    authenticated: false,
    role: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    // Any transition that changes who is signed in must re-read the session.
    // `popstate` covers back/forward; a sign-out also bumps the nonce, so this
    // is belt-and-braces rather than the only signal.
    //
    // `refresh` is intentionally NOT a dependency. It is `useCallback`d on an
    // empty dep list, so it is referentially stable for the life of the
    // component, and the handlers below are re-registered anyway - the
    // add/remove pair runs on every effect run either way. Listing it would
    // satisfy the linter while adding nothing.
    const onFocus = () => setNonce((n) => n + 1);
    window.addEventListener("focus", onFocus);
    window.addEventListener("popstate", onFocus);

    void fetch("/api/auth/session-flags", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (!data || data.authenticated !== true) {
          setState(ANONYMOUS);
          return;
        }
        const role = (data.role ?? "buyer") as SessionState["role"];
        setState({ authenticated: true, role, loading: false });
      })
      .catch(() => {
        if (active) setState(ANONYMOUS);
      });

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("popstate", onFocus);
    };
    // `locale` is a dependency because switching language re-renders the tree
    // and the header must not hold a stale answer across it.
  }, [locale, nonce]);

  return { ...state, refresh };
}
