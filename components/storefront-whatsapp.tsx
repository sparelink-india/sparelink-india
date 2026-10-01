"use client";

import { useStorefrontSession } from "@/components/use-storefront-session";
import { WhatsAppFloatingButton } from "@/components/whatsapp-floating-button";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

/**
 * The floating WhatsApp control, mounted once per storefront page.
 *
 * WHERE IT IS MOUNTED. In `StorefrontHeader`, and only there. It used to be
 * mounted in `StorefrontShell`, which is wrong: only six of the storefront
 * routes compose that shell. The other seventeen hand-compose
 * `StorefrontHeader` and `SiteFooter`, so they had no floating control at all,
 * and the homepage was one of them. `StorefrontHeader` is the one component
 * every customer-facing storefront route renders - the shell renders it,
 * `fitment-shell` renders it, and the hand-composed routes render it directly
 * - so one mount there yields exactly one control per page by construction.
 * See the long comment in `storefront-header.tsx` for the full argument,
 * including why a `(storefront)` route group was not used instead.
 *
 * WHY IT IS NOT IN THE FOOTER. The footer is inside the normal flow, so a
 * control anchored to it would scroll away, and the footer is not rendered on
 * every route.
 *
 * WHY IT IS NOT RENDERED WHILE SIGNED IN. A signed-in customer already has
 * order tracking, and the bottom-left corner is where the mobile bottom nav
 * sits. The button would overlap it.
 *
 * It reads the same `useStorefrontSession` hook and the same
 * `/api/auth/session-flags` endpoint the header that now hosts it uses, so the
 * two can never disagree about who is signed in. They are separate hook
 * INSTANCES, so this is one additional request per page load, not zero - which
 * was equally true of the previous shell mount, so it is not a regression. The
 * hook re-reads the endpoint on focus and on `popstate`, so a sign-in or
 * sign-out is picked up without a reload.
 */
export function StorefrontWhatsApp() {
  const { authenticated } = useStorefrontSession();
  if (authenticated) return null;
  return <WhatsAppFloatingButton href={getWhatsAppChatUrl()} />;
}
