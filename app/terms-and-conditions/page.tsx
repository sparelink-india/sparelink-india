import Link from "next/link";

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

export default function TermsAndConditionsPage() {
  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-slate-950">
        <T k="legal.terms" />
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="terms.intro" />
      </p>
      <section className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        {SECTIONS.map(([title, body]) => (
          <div key={title}>
            <h2 className="font-bold text-slate-950">
              <T k={title} />
            </h2>
            <p>
              <T k={body} />
            </p>
          </div>
        ))}
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="terms.contactTitle" />
          </h2>
          <p>
            <T k="common.phone" />: {PUBLIC_SUPPORT_PHONE}
            <br />
            <T k="common.email" />: {PUBLIC_DISPLAY_EMAIL}
          </p>
          <Link href="/help-support" className="mt-2 inline-block font-semibold text-[#7a1233] underline">
            <T k="nav.help" />
          </Link>
        </div>
      </section>
    </StorefrontShell>
  );
}
