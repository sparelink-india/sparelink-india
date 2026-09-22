import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";

export default function ReturnsRefundsPage() {
  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-slate-950">
        <T k="legal.returns" />
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="returns.intro" />
      </p>
      <section className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.eligibilityTitle" />
          </h2>
          <p>
            <T k="returns.eligibilityBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.damageTitle" />
          </h2>
          <p>
            <T k="returns.damageBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.processTitle" />
          </h2>
          <p>
            <T k="returns.processBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.timeTitle" />
          </h2>
          <p>
            <T k="returns.timeBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.conditionTitle" />
          </h2>
          <p>
            <T k="returns.conditionBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.nonTitle" />
          </h2>
          <p>
            <T k="returns.nonBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.inspectTitle" />
          </h2>
          <p>
            <T k="returns.inspectBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.refundTitle" />
          </h2>
          <p>
            <T k="returns.refundBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.timelineTitle" />
          </h2>
          <p>
            <T k="returns.timelineBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.shipTitle" />
          </h2>
          <p>
            <T k="returns.shipBody" />
          </p>
        </div>
        <div>
          <h2 className="font-bold text-slate-950">
            <T k="returns.contactTitle" />
          </h2>
          <p>
            <T k="common.phone" />: {PUBLIC_SUPPORT_PHONE}
            <br />
            <T k="common.email" />: {PUBLIC_DISPLAY_EMAIL}
          </p>
          <Link href="/help-support" className="mt-2 inline-block font-semibold text-[#7a1233] underline">
            <T k="help.open" />
          </Link>
        </div>
      </section>
    </StorefrontShell>
  );
}
