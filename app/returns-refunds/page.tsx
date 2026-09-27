import Link from "next/link";

import { PolicyLayout } from "@/components/policy-layout";
import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";

export default function ReturnsRefundsPage() {
  return (
    <StorefrontShell>
    <PolicyLayout
      tocContainerId="policy-body"
      tocLabel={<T k="legal.contents" />}
    >
      <div id="policy-body">
            <h1 className="sl-h1">
              <T k="legal.returns" />
            </h1>
            <p className="sl-body mt-3">
              <T k="returns.intro" />
            </p>
            <section className="sl-body mt-8 space-y-6">
              <div id="sec-returns-eligibilitytitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.eligibilityTitle" />
                </h2>
                <p>
                  <T k="returns.eligibilityBody" />
                </p>
              </div>
              <div id="sec-returns-damagetitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.damageTitle" />
                </h2>
                <p>
                  <T k="returns.damageBody" />
                </p>
              </div>
              <div id="sec-returns-processtitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.processTitle" />
                </h2>
                <p>
                  <T k="returns.processBody" />
                </p>
              </div>
              <div id="sec-returns-timetitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.timeTitle" />
                </h2>
                <p>
                  <T k="returns.timeBody" />
                </p>
              </div>
              <div id="sec-returns-conditiontitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.conditionTitle" />
                </h2>
                <p>
                  <T k="returns.conditionBody" />
                </p>
              </div>
              <div id="sec-returns-nontitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.nonTitle" />
                </h2>
                <p>
                  <T k="returns.nonBody" />
                </p>
              </div>
              <div id="sec-returns-inspecttitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.inspectTitle" />
                </h2>
                <p>
                  <T k="returns.inspectBody" />
                </p>
              </div>
              <div id="sec-returns-refundtitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.refundTitle" />
                </h2>
                <p>
                  <T k="returns.refundBody" />
                </p>
              </div>
              <div id="sec-returns-timelinetitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.timelineTitle" />
                </h2>
                <p>
                  <T k="returns.timelineBody" />
                </p>
              </div>
              <div id="sec-returns-shiptitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.shipTitle" />
                </h2>
                <p>
                  <T k="returns.shipBody" />
                </p>
              </div>
              <div id="sec-returns-contacttitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="returns.contactTitle" />
                </h2>
                <p>
                  <T k="common.phone" />: {PUBLIC_SUPPORT_PHONE}
                  <br />
                  <T k="common.email" />: {PUBLIC_DISPLAY_EMAIL}
                </p>
                <Link href="/help-support" className="mt-2 inline-block font-semibold text-[var(--sl-primary)] underline">
                  <T k="help.open" />
                </Link>
              </div>
            </section>
      </div>
    </PolicyLayout>
    </StorefrontShell>
  );
}
