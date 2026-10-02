import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  path: "/shipping-policy",
  title: "Shipping and Delivery Policy",
  description:
    "How SpareLink India packs, dispatches and delivers auto spare parts across India, including delivery timelines, tracking and damage claims.",
});

export default function ShippingPolicyPage() {
  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-[var(--v3-text)]">
        <T k="legal.shipping" />
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--v3-text-2)]">
        <T k="shipping.intro" />
      </p>
      <section className="mt-8 space-y-6 text-sm leading-7 text-[var(--v3-text-2)]">
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
            <h2 className="font-bold text-[var(--v3-text)]">
              <T k={title} />
            </h2>
            <p>
              <T k={body} />
            </p>
          </div>
        ))}
        <div>
          <h2 className="font-bold text-[var(--v3-text)]">
            <T k="shipping.supportTitle" />
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
