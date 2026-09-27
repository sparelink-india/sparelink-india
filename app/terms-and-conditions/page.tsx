import Link from "next/link";

import { PolicyLayout } from "@/components/policy-layout";
import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";

const SECTIONS = [
  ["terms.usageTitle", "terms.usageBody"],
  ["terms.accountsTitle", "terms.accountsBody"],
  ["terms.productTitle", "terms.productBody"],
  ["terms.pricingTitle", "terms.pricingBody"],
  ["terms.availTitle", "terms.availBody"],
  ["terms.ordersTitle", "terms.ordersBody"],
  ["terms.paymentTitle", "terms.paymentBody"],
  ["terms.codTitle", "terms.codBody"],
  ["terms.cashfreeTitle", "terms.cashfreeBody"],
  ["terms.cancelTitle", "terms.cancelBody"],
  ["terms.returnsTitle", "terms.returnsBody"],
  ["terms.ipTitle", "terms.ipBody"],
  ["terms.fraudTitle", "terms.fraudBody"],
  ["terms.suspendTitle", "terms.suspendBody"],
  ["terms.liabilityTitle", "terms.liabilityBody"],
] as const;

/* Section anchors for the table of contents. The slug is derived from the
   i18n key itself, so an anchor can never point at the wrong section. */
function sectionId(title: string) {
  return "sec-" + title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export default function TermsAndConditionsPage() {
  return (
    <StorefrontShell>
    <PolicyLayout
      tocContainerId="policy-body"
      tocLabel={<T k="legal.contents" />}
    >
      <div id="policy-body">
            <h1 className="sl-h1">
              <T k="legal.terms" />
            </h1>
            <p className="sl-body mt-3">
              <T k="terms.intro" />
            </p>
            <section className="sl-body mt-8 space-y-6">
              {SECTIONS.map(([title, body]) => (
                <div key={title} id={sectionId(title)} data-toc>
                  <h2 className="sl-h2 mt-8">
                    <T k={title} />
                  </h2>
                  <p>
                    <T k={body} />
                  </p>
                </div>
              ))}
              <div>
                <h2 className="sl-h2 mt-8">
                  <T k="terms.contactTitle" />
                </h2>
                <p>
                  <T k="common.phone" />: {PUBLIC_SUPPORT_PHONE}
                  <br />
                  <T k="common.email" />: {PUBLIC_DISPLAY_EMAIL}
                </p>
                <Link href="/help-support" className="mt-2 inline-block font-semibold text-[var(--sl-primary)] underline">
                  <T k="nav.help" />
                </Link>
              </div>
            </section>
      </div>
    </PolicyLayout>
    </StorefrontShell>
  );
}
