import { Suspense } from "react";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import OrderPaymentPage from "./payment-client";

export default function OrderPaymentRoute() {
  return (
    <Suspense
      /*
       * The fallback now carries the same storefront chrome as the resolved
       * page. It used to be a bare cream div with no header, footer or mobile
       * nav and a hardcoded English string, so for the moment before the
       * payment client hydrated - on a screen where the customer is about to
       * enter money - the site visibly fell apart.
       *
       * There is no double chrome: while this fallback is pending the client
       * component has not mounted, and once it resolves the fallback unmounts
       * and the client's own StorefrontShell takes over.
       */
      fallback={
        <StorefrontShell>
          <div className="py-10 sm:py-16">
            <div className="sl-panel sl-panel-pad text-center text-sm text-[var(--sl-ink-2)]">
              <T k="pay.loading" />
            </div>
          </div>
        </StorefrontShell>
      }
    >
      <OrderPaymentPage />
    </Suspense>
  );
}
