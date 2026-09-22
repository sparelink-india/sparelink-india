import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";

export default function ShippingPolicyPage() {
  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-slate-950">
        <T k="legal.shipping" />
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="shipping.intro" />
      </p>
      <section className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        {(
          [
            ["shipping.processTitle", "shipping.processBody"],
            ["shipping.dispatchTitle", "shipping.dispatchBody"],
            ["shipping.deliveryTitle", "shipping.deliveryBody"],
            ["shipping.chargesTitle", "shipping.chargesBody"],
            ["shipping.pincodeTitle", "shipping.pincodeBody"],
            ["shipping.delaysTitle", "shipping.delaysBody"],
            ["shipping.damageTitle", "shipping.damageBody"],
            ["shipping.addressTitle", "shipping.addressBody"],
          ] as const
        ).map(([title, body]) => (
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
            <T k="shipping.supportTitle" />
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
