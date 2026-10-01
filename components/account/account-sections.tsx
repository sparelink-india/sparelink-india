"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/preferences-provider";
import { SignOutButton } from "@/components/sign-out-button";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Section navigation for the customer Accounts and Profile areas.
 *
 * ONE component and ONE config drive both areas. The brief asked for two
 * different menus, and building them separately is how two lists drift apart
 * and end up disagreeing about where Orders lives.
 *
 * The routes here are chosen to REUSE what already exists rather than shadow
 * it: Orders already lives at /orders and Returns at /returns-refunds, so those
 * entries point at the real pages instead of creating thin duplicates that
 * would need maintaining in step. Only the sections with no existing page get a
 * new route.
 *
 * Nothing here is admin. The admin surface is a separate shell under /admin and
 * is deliberately unreachable from these lists.
 */

export type AccountSection = {
  key: MessageKey;
  href: string;
  /** True when the destination is an existing page this menu reuses. */
  reused?: boolean;
};

export const ACCOUNTS_SECTIONS: AccountSection[] = [
  { key: "accounts.summary", href: "/account" },
  { key: "accounts.ledger", href: "/account/ledger" },
  { key: "accounts.invoices", href: "/account/invoices" },
  { key: "accounts.orders", href: "/orders", reused: true },
  { key: "accounts.payments", href: "/account/payments" },
  { key: "accounts.returns", href: "/returns-refunds", reused: true },
  { key: "accounts.schemes", href: "/account/schemes" },
];

export const PROFILE_SECTIONS: AccountSection[] = [
  { key: "profile.business", href: "/profile", reused: true },
  { key: "profile.addresses", href: "/profile/addresses" },
  { key: "profile.kyc", href: "/profile/kyc" },
  { key: "profile.salesman", href: "/profile/salesman" },
  { key: "profile.settings", href: "/profile/settings" },
  { key: "profile.support", href: "/help-support", reused: true },
];

export function AccountSectionNav({
  sections,
  labelKey,
  action,
}: {
  sections: AccountSection[];
  labelKey: MessageKey;
  /**
   * A trailing ACTION rather than another link.
   *
   * Logout belongs in the Profile menu per the brief, but it is something you
   * DO, not a page you go to, so it must not be rendered as a link to a route
   * that does not exist. It reuses the existing SignOutButton, which is the
   * same control the header already uses, so signing out stays one code path.
   */
  action?: "logout";
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t(labelKey)}
      className="flex flex-wrap items-center gap-1 border-b border-[var(--v3-rule)] pb-3"
    >
      {sections.map((section) => {
        const active =
          section.href === pathname ||
          (section.href !== "/" && pathname.startsWith(`${section.href}/`));
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-[2px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              active
                ? "bg-[var(--v3-brand)] text-white"
                : "text-[var(--v3-text-2)] hover:bg-[var(--v3-sunk)]"
            }`}
          >
            {t(section.key)}
          </Link>
        );
      })}
      {action === "logout" ? (
        <span className="ml-auto inline-flex min-h-9 items-center">
          <SignOutButton
            ariaLabel={t("profile.logout")}
            className="inline-flex min-h-9 items-center rounded-[2px] px-3 py-1.5 text-[13px] font-semibold text-[var(--v3-text-2)] hover:bg-[var(--v3-sunk)]"
          />
        </span>
      ) : null}
    </nav>
  );
}

/**
 * The honest empty state.
 *
 * Used wherever a section has no data source behind it yet. It states the
 * situation plainly instead of rendering a zero, a dash, or a placeholder
 * number, because a fabricated balance or invoice is worse than an obvious
 * gap: a customer acting on a wrong figure is the failure mode this avoids.
 */
export function SectionEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mt-6 rounded-[var(--v3-r-lg)] border border-dashed border-[var(--v3-rule-strong)] bg-white p-8 text-center">
      <h2 className="text-base font-bold text-[var(--v3-text)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-[13px] leading-relaxed text-[var(--v3-text-2)]">
        {body}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="v3-btn v3-btn-primary mt-5 inline-flex !min-h-10 items-center !px-4 text-[13px]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
