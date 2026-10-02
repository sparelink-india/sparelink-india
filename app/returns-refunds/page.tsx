import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  path: "/returns-refunds",
  title: "Returns and Refunds",
  description:
    "Our return, exchange and refund process for auto spare parts, including eligibility windows, credit notes and how to raise a return request.",
});

export default function ReturnsRefundsPage() {
  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-[var(--v3-text)]">
        <T k="legal.returns" />
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--v3-text-2)]">
        <T k="returns.intro" />
      </p>
      <section className="mt-8 space-y-6 text-sm leading-7 text-[var(--v3-text-2)]">
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.eligibilityTitle" />
          </h2>
          <p>
            <T k="returns.eligibilityBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.damageTitle" />
          </h2>
          <p>
            <T k="returns.damageBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.processTitle" />
          </h2>
          <p>
            <T k="returns.processBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.timeTitle" />
          </h2>
          <p>
            <T k="returns.timeBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.conditionTitle" />
          </h2>
          <p>
            <T k="returns.conditionBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.nonTitle" />
          </h2>
          <p>
            <T k="returns.nonBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.inspectTitle" />
          </h2>
          <p>
            <T k="returns.inspectBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.refundTitle" />
          </h2>
          <p>
            <T k="returns.refundBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.timelineTitle" />
          </h2>
          <p>
            <T k="returns.timelineBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.shipTitle" />
          </h2>
          <p>
            <T k="returns.shipBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="returns.contactTitle" />
          </h2>
          <p>
            <T k="common.phone" />: {PUBLIC_SUPPORT_PHONE}
            <br />
            <T k="common.email" />: {PUBLIC_DISPLAY_EMAIL}
          </p>
          <Link href="/help-support" className="mt-2 inline-block font-semibold text-[var(--v3-brand-ink)] underline">
            <T k="help.open" />
          </Link>
        </div>
      </section>
    </StorefrontShell>
  );
}
