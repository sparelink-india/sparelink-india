import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
} from "@/lib/business-contacts";
import { getTelHref } from "@/lib/support-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

function PlaceholderPhoto({ label }: { label: string }) {
  return (
    <div
      className="flex aspect-[4/5] w-full max-w-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
      aria-label={`${label} photograph placeholder`}
    >
      <T k="photo.placeholder" />
    </div>
  );
}

export default function AboutUsPage() {
  const whatsappHref = getWhatsAppChatUrl();
  const telHref = getTelHref(PUBLIC_SUPPORT_PHONE);

  return (
    <StorefrontShell wide>
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        <T k="about.title" />
      </h1>
      <p className="mt-2 text-base font-semibold text-[#7a1233]">
        <T k="about.subtitle" />
      </p>

      <div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">
        <p>
          <T k="about.p1" />
        </p>
        <p>
          <T k="about.p2" />
        </p>
        <p>
          <T k="about.p3" />
        </p>
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-950">
        <T k="about.partners" />
      </h2>
      <div className="mt-6 space-y-8">
        <article id="hind-motors" className="rounded-2xl border border-slate-200 bg-white p-5 sm:flex sm:gap-6">
          <PlaceholderPhoto label="Hind Motors" />
          <div className="mt-4 sm:mt-0">
            <h3 className="text-lg font-bold">Hind Motors</h3>
            <p className="mt-1 text-sm text-slate-600">
              <T k="about.proprietor" vars={{ name: "Mr. Dharmesh Anand" }} />
            </p>
            <p className="font-mono text-xs text-slate-500">GSTIN: 23AARPA8557FZ1M</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              <T k="about.hindText" />
            </p>
          </div>
        </article>

        <article id="ambaji-traders" className="rounded-2xl border border-slate-200 bg-white p-5 sm:flex sm:gap-6">
          <PlaceholderPhoto label="Ambaji Traders" />
          <div className="mt-4 sm:mt-0">
            <h3 className="text-lg font-bold">Ambaji Traders</h3>
            <p className="mt-1 text-sm text-slate-600">
              <T k="about.proprietor" vars={{ name: "Mr. Ansh Anand" }} />
            </p>
            <p className="font-mono text-xs text-slate-500">GSTIN: 23BYNPA1789A1ZQ</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              <T k="about.ambajiText" />
            </p>
          </div>
        </article>

        <article id="india-sales" className="rounded-2xl border border-slate-200 bg-white p-5 sm:flex sm:gap-6">
          <PlaceholderPhoto label="India Sales" />
          <div className="mt-4 sm:mt-0">
            <h3 className="text-lg font-bold">India Sales</h3>
            <p className="mt-1 text-sm text-slate-600">
              <T k="about.proprietor" vars={{ name: "Mr. Tanmay Anand" }} />
            </p>
            <p className="font-mono text-xs text-slate-500">GSTIN: 23EKAPA4186F1ZL</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              <T k="about.indiaText" />
            </p>
          </div>
        </article>
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-950">
        <T k="about.stand" />
      </h2>
      <dl className="mt-4 space-y-4 text-sm leading-7 text-slate-700">
        <div>
          <dt className="font-bold text-slate-950">
            <T k="about.quality" />
          </dt>
          <dd>
            <T k="about.qualityText" />
          </dd>
        </div>
        <div>
          <dt className="font-bold text-slate-950">
            <T k="about.availability" />
          </dt>
          <dd>
            <T k="about.availabilityText" />
          </dd>
        </div>
        <div>
          <dt className="font-bold text-slate-950">
            <T k="about.pricing" />
          </dt>
          <dd>
            <T k="about.pricingText" />
          </dd>
        </div>
        <div>
          <dt className="font-bold text-slate-950">
            <T k="about.service" />
          </dt>
          <dd>
            <T k="about.serviceText" />
          </dd>
        </div>
        <div>
          <dt className="font-bold text-slate-950">
            <T k="about.relations" />
          </dt>
          <dd>
            <T k="about.relationsText" />
          </dd>
        </div>
      </dl>

      <h2 className="mt-10 text-xl font-bold text-slate-950">
        <T k="about.network" />
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="about.networkP1" />
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="about.networkP2" />
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="about.networkP3" />
      </p>

      <h2 className="mt-10 text-xl font-bold text-slate-950">
        <T k="about.vision" />
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="about.visionP1" />
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-700">
        <T k="about.visionP2" />
      </p>

      <p className="mt-8 text-base font-bold text-slate-950">Sparelink India</p>
      <p className="text-sm font-semibold text-[#7a1233]">
        <T k="about.tagline" />
      </p>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        {telHref ? (
          <a href={telHref} className="font-semibold text-slate-800">
            {PUBLIC_SUPPORT_PHONE}
          </a>
        ) : null}
        <a href={`mailto:${PUBLIC_DISPLAY_EMAIL}`} className="font-semibold text-slate-800">
          {PUBLIC_DISPLAY_EMAIL}
        </a>
        <WhatsAppCta href={whatsappHref} />
      </div>
    </StorefrontShell>
  );
}
