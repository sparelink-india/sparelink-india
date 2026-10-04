import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth-server";
import { auth } from "@/lib/auth";
import {
  UNAUTHENTICATED_FALLBACK_PATH,
  buildAppAuthRedirect,
  markOneTimeTokenIssued,
} from "@/lib/mobile-auth-handoff";

/**
 * Post-OAuth landing for the native app.
 *
 * Better Auth completes the Google code exchange at `/api/auth/callback/google`
 * and sets the session cookie in the BROWSER. It then redirects here, because
 * the mobile client supplied this page as its `callbackURL`.
 *
 * Two jobs, in order:
 *
 *  1. Refuse to act without a session. Better Auth lands here immediately after
 *     the exchange, so an anonymous arrival means the exchange did not complete.
 *     There is nothing to hand off, and minting a code for it would be wrong.
 *
 *  2. Mint a one-time handoff code and bounce to the app. The code is short-lived
 *     and single-use, and the app exchanges it over its own request to obtain a
 *     session in its own cookie jar. No cookie, token or secret crosses in the
 *     URL — the Chrome jar and the React Native jar are separate stores, which
 *     is precisely why the code exists.
 *
 * The code is only ever placed in a `Location` header. It is never rendered into
 * HTML, never logged, and never returned in a response body.
 */

// The outcome depends entirely on the incoming session cookie, so this must
// never be statically rendered or cached.
export const dynamic = "force-dynamic";

export default async function MobileAuthCallbackPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect(UNAUTHENTICATED_FALLBACK_PATH);
  }

  let handoffUrl: string;
  try {
    const { headers } = await import("next/headers");
    const { token } = await auth.api.generateOneTimeToken({
      headers: await headers(),
    });
    // Defence in depth: the plugin already consumes the code on first use.
    markOneTimeTokenIssued(token);
    handoffUrl = buildAppAuthRedirect(token);
  } catch {
    // A failure here must not surface the code, the session, or a stack trace.
    redirect(UNAUTHENTICATED_FALLBACK_PATH);
  }

  redirect(handoffUrl);
}