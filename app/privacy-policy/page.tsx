import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_INBOX,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";

export default function PrivacyPolicyPage() {
  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-slate-950">
        <T k="legal.privacy" />
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="privacy.intro" />
      </p>
      <section className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <div>
          <h2 className="font-bold text-slate-950">
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
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.whyTitle" />
          </h2>
          <p>
            <T k="privacy.whyBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.orderTitle" />
          </h2>
          <p>
            <T k="privacy.orderBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.supportTitle" />
          </h2>
          <p>
            <T k="privacy.supportBody" vars={{ inbox: PUBLIC_SUPPORT_INBOX }} />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.securityTitle" />
          </h2>
          <p>
            <T k="privacy.securityBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.providersTitle" />
          </h2>
          <p>
            <T k="privacy.providersBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.payTitle" />
          </h2>
          <p>
            <T k="privacy.payBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.cookiesTitle" />
          </h2>
          <p>
            <T k="privacy.cookiesBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.requestsTitle" />
          </h2>
          <p>
            <T k="privacy.requestsBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="privacy.contactTitle" />
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
