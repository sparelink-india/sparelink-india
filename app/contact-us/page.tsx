import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { getTelHref } from "@/lib/support-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

export default function ContactUsPage() {
  const whatsappHref = getWhatsAppChatUrl();
  const telHref = getTelHref(PUBLIC_SUPPORT_PHONE);

  return (
    <StorefrontShell>
      <h1 className="text-2xl font-bold text-slate-950">
        <T k="contact.title" />
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        <T k="contact.intro" />
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-slate-500">
            <T k="help.phoneLabel" />
          </dt>
          <dd>
            <a href={telHref ?? undefined} className="font-semibold text-slate-900">
              {PUBLIC_SUPPORT_PHONE}
            </a>
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">
            <T k="help.emailLabel" />
          </dt>
          <dd>
            <a href={`mailto:${PUBLIC_DISPLAY_EMAIL}`} className="font-semibold text-slate-900">
              {PUBLIC_DISPLAY_EMAIL}
            </a>
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <WhatsAppCta href={whatsappHref} />
        {telHref ? (
          <a href={telHref} className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold">
            <T k="help.call" />
          </a>
        ) : null}
        <a
          href={`mailto:${PUBLIC_DISPLAY_EMAIL}`}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold"
        >
          <T k="help.emailUs" />
        </a>
        <Link
          href="/help-support"
          className="inline-flex items-center rounded-xl bg-[#7a1233] px-4 py-2 font-semibold text-white"
        >
          <T k="nav.help" />
        </Link>
      </div>
    </StorefrontShell>
  );
}
