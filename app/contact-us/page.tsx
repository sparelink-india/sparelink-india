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

/**
 * V2 Contact page.
 *
 * Contact details come exclusively from `lib/business-contacts`, which is the
 * single source of truth already used by the header, footer and support pages.
 * No phone number, address, email or operating hour is invented here. Where a
 * channel genuinely does not exist (for example a published postal address) it
 * is simply absent rather than filled with a placeholder.
 */

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.2a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2.5 6.5L12 13l9.5-6.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0112 3.1a8.4 8.4 0 019 8.4z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 014.9.6c0 1.7-2.5 2-2.5 3.7M12 17h.01" />
    </svg>
  );
}

export default function ContactUsPage() {
  const whatsappHref = getWhatsAppChatUrl();
  const telHref = getTelHref(PUBLIC_SUPPORT_PHONE);

  /* Built conditionally: a channel with no real data is not rendered at all,
     so the page can never imply a contact route that does not exist. */
  const channels = [
    telHref
      ? {
          key: "phone",
          icon: <PhoneIcon />,
          label: <T k="help.phoneLabel" />,
          value: PUBLIC_SUPPORT_PHONE,
          href: telHref,
          external: true,
        }
      : null,
    {
      key: "email",
      icon: <MailIcon />,
      label: <T k="help.emailLabel" />,
      value: PUBLIC_DISPLAY_EMAIL,
      href: `mailto:${PUBLIC_DISPLAY_EMAIL}`,
      external: true,
    },
    {
      key: "whatsapp",
      icon: <ChatIcon />,
      label: <T k="wa.label" />,
      value: <T k="wa.chat" />,
      href: whatsappHref,
      external: true,
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: React.ReactNode;
    label: React.ReactNode;
    value: React.ReactNode;
    href: string;
    external: boolean;
  }>;

  return (
    <StorefrontShell wide>
      {/* ---------- PAGE HEADER ---------- */}
      <div className="max-w-2xl">
        <p className="sl-label">
          <T k="nav.contact" />
        </p>
        <h1 className="sl-h1 mt-2">
          <T k="contact.title" />
        </h1>
        <p className="sl-body mt-2.5">
          <T k="contact.intro" />
        </p>
      </div>

      {/* ---------- CONTACT CHANNELS ----------
          Each channel is a card with a real, tappable value. */}
      <section className="mt-8" aria-label="Contact channels">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <a
              key={channel.key}
              href={channel.href}
              className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex items-start gap-3.5 p-5"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
                {channel.icon}
              </span>
              <span className="min-w-0">
                <span className="sl-label block">{channel.label}</span>
                <span className="sl-h3 mt-1 block break-words transition-colors group-hover:text-[var(--sl-primary)]">
                  {channel.value}
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ---------- SUPPORT HIERARCHY ----------
          Routes the user to the right self-service destination before they
          reach for a person. */}
      <section className="sl-band border-t border-[var(--sl-border)]" aria-labelledby="contact-support">
        <div className="max-w-2xl">
          <h2 id="contact-support" className="sl-h2">
            <T k="nav.help" />
          </h2>
          <p className="sl-body mt-2">
            <T k="contact.intro" />
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/help-support" className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex items-start gap-3.5 p-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
              <HelpIcon />
            </span>
            <span>
              <span className="sl-h3 block transition-colors group-hover:text-[var(--sl-primary)]">
                <T k="help.submit" />
              </span>
              <span className="sl-small mt-1 block">
                <T k="help.contactEscalation" />
              </span>
            </span>
          </Link>

          <Link href="/track-order" className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex items-start gap-3.5 p-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 3h9l4 4v14H6z" />
                <path d="M15 3v4h4M9 12h6M9 16h4" />
              </svg>
            </span>
            <span>
              <span className="sl-h3 block transition-colors group-hover:text-[var(--sl-primary)]">
                <T k="nav.track" />
              </span>
              <span className="sl-small mt-1 block">
                <T k="track.emptyBody" />
              </span>
            </span>
          </Link>

          <Link href="/returns-refunds" className="sl-v2-card sl-v2-card-hover sl-v2-rule group flex items-start gap-3.5 p-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sl-radius-sm)] bg-[var(--sl-primary-soft)] text-[var(--sl-primary)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </span>
            <span>
              <span className="sl-h3 block transition-colors group-hover:text-[var(--sl-primary)]">
                <T k="legal.returns" />
              </span>
              <span className="sl-small mt-1 block">
                <T k="help.returnsShort" />
              </span>
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- PRIMARY CTA ---------- */}
      <section className="sl-band border-t border-[var(--sl-border)]">
        <div className="sl-v2-card p-6 sm:p-8">
          <h2 className="sl-h3">
            <T k="help.title" />
          </h2>
          <p className="sl-body mt-1.5 max-w-prose">
            <T k="contact.intro" />
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <WhatsAppCta href={whatsappHref} className="sl-v2-btn sl-v2-btn-primary" />
            {telHref ? (
              <a href={telHref} className="sl-v2-btn sl-v2-btn-secondary">
                <PhoneIcon />
                <T k="help.call" />
              </a>
            ) : null}
            <a href={`mailto:${PUBLIC_DISPLAY_EMAIL}`} className="sl-v2-btn sl-v2-btn-secondary">
              <MailIcon />
              <T k="help.emailUs" />
            </a>
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}
