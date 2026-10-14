import Link from "next/link";

import { PolicyLayout } from "@/components/policy-layout";
import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_INBOX,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How SpareLink India collects, uses and protects the personal and business details you share when you order, register or enquire.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <StorefrontShell>
    <PolicyLayout
      tocContainerId="policy-body"
      tocLabel={<T k="legal.contents" />}
    >
      <div id="policy-body">
            <h1 className="sl-h1">
              <T k="legal.privacy" />
            </h1>
            <p className="sl-body mt-3">
              <T k="privacy.intro" />
            </p>
            <section className="sl-body mt-8 space-y-6">
              <div id="sec-privacy-collecttitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.collectTitle" />
                </h2>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <T k="privacy.collect1" />
                  </li>
                  <li>
                    <T k="privacy.collect2" />
                  </li>
                  <li>
                    <T k="privacy.collect3" />
                  </li>
                  <li>
                    <T k="privacy.collect4" />
                  </li>
                  <li>
                    <T k="privacy.collect5" />
                  </li>
                  <li>
                    <T k="privacy.collect6" />
                  </li>
                  <li>
                    <T k="privacy.collect7" />
                  </li>
                </ul>
              </div>
              <div id="sec-privacy-whytitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.whyTitle" />
                </h2>
                <p>
                  <T k="privacy.whyBody" />
                </p>
              </div>
              <div id="sec-privacy-ordertitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.orderTitle" />
                </h2>
                <p>
                  <T k="privacy.orderBody" />
                </p>
              </div>
              <div id="sec-privacy-supporttitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.supportTitle" />
                </h2>
                <p>
                  <T k="privacy.supportBody" vars={{ inbox: PUBLIC_SUPPORT_INBOX }} />
                </p>
              </div>
              <div id="sec-privacy-securitytitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.securityTitle" />
                </h2>
                <p>
                  <T k="privacy.securityBody" />
                </p>
              </div>
              <div id="sec-privacy-providerstitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.providersTitle" />
                </h2>
                <p>
                  <T k="privacy.providersBody" />
                </p>
              </div>
              <div id="sec-privacy-paytitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.payTitle" />
                </h2>
                <p>
                  <T k="privacy.payBody" />
                </p>
              </div>
              <div id="sec-privacy-cookiestitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.cookiesTitle" />
                </h2>
                <p>
                  <T k="privacy.cookiesBody" />
                </p>
              </div>
              <div id="sec-privacy-measurementtitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.measurementTitle" />
                </h2>
                <p>
                  <T k="privacy.measurementBody" />
                </p>
                <h3 className="sl-h3 mt-6">
                  <T k="privacy.measurementWhatTitle" />
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <T k="privacy.measurementWhat1" />
                  </li>
                  <li>
                    <T k="privacy.measurementWhat2" />
                  </li>
                  <li>
                    <T k="privacy.measurementWhat3" />
                  </li>
                  <li>
                    <T k="privacy.measurementWhat4" />
                  </li>
                  <li>
                    <T k="privacy.measurementWhat5" />
                  </li>
                </ul>
                <h3 className="sl-h3 mt-6">
                  <T k="privacy.measurementNeverTitle" />
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <T k="privacy.measurementNever1" />
                  </li>
                  <li>
                    <T k="privacy.measurementNever2" />
                  </li>
                  <li>
                    <T k="privacy.measurementNever3" />
                  </li>
                  <li>
                    <T k="privacy.measurementNever4" />
                  </li>
                  <li>
                    <T k="privacy.measurementNever5" />
                  </li>
                </ul>
                <h3 className="sl-h3 mt-6">
                  <T k="privacy.measurementChoiceTitle" />
                </h3>
                <p>
                  <T k="privacy.measurementChoiceBody" />
                </p>
              </div>
              <div id="sec-privacy-locationtitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.locationTitle" />
                </h2>
                <p>
                  <T k="privacy.locationBody" />
                </p>
              </div>
              <div id="sec-privacy-screenshotstitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.screenshotsTitle" />
                </h2>
                <p>
                  <T k="privacy.screenshotsBody" />
                </p>
              </div>
              <div id="sec-privacy-retentiontitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.retentionTitle" />
                </h2>
                <p>
                  <T k="privacy.retentionBody" />
                </p>
              </div>
              <div id="sec-privacy-measurementaccesstitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.measurementAccessTitle" />
                </h2>
                <p>
                  <T k="privacy.measurementAccessBody" />
                </p>
              </div>
              <div id="sec-privacy-requeststitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.requestsTitle" />
                </h2>
                <p>
                  <T k="privacy.requestsBody" />
                </p>
              </div>
              <div id="sec-privacy-contacttitle" data-toc>
                <h2 className="sl-h2 mt-8">
                  <T k="privacy.contactTitle" />
                </h2>
                <p>
                  <T k="common.phone" />: {PUBLIC_SUPPORT_PHONE}
                  <br />
                  <T k="common.email" />: {PUBLIC_DISPLAY_EMAIL}
                </p>
                <Link href="/help-support" className="mt-2 inline-block font-semibold text-[var(--sl-brand-ink)] underline">
                  <T k="nav.help" />
                </Link>
              </div>
            </section>
      </div>
    </PolicyLayout>
    </StorefrontShell>
  );
}
