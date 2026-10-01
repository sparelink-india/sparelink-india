"use client";

import type { ReactNode } from "react";

import {
  ACCOUNTS_SECTIONS,
  AccountSectionNav,
  type AccountSection,
  PROFILE_SECTIONS,
} from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";
import { StorefrontShell } from "@/components/storefront-shell";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The frame every Accounts and Profile page sits in: storefront chrome, the
 * page title, and the section navigation.
 *
 * Nine routes would otherwise each repeat the same shell + heading + nav, and
 * the first one to drift would leave a section with no way back to the others.
 * The Accounts and Profile menus are the same component with a different
 * config, which is also why the two areas cannot fall out of step.
 */
export function AccountSectionLayout({
  titleKey,
  variant,
  children,
}: {
  titleKey: MessageKey;
  variant: "accounts" | "profile";
  children: ReactNode;
}) {
  const { t } = useI18n();
  const sections: AccountSection[] =
    variant === "accounts" ? ACCOUNTS_SECTIONS : PROFILE_SECTIONS;
  const labelKey: MessageKey = variant === "accounts" ? "accounts.navLabel" : "profile.navLabel";

  return (
    <StorefrontShell>
      <h1 className="mb-4 mt-6 text-2xl font-extrabold tracking-tight text-[var(--v3-text)]">
        {t(titleKey)}
      </h1>
      <AccountSectionNav
        sections={sections}
        labelKey={labelKey}
        action={variant === "profile" ? "logout" : undefined}
      />
      {children}
    </StorefrontShell>
  );
}

export { ACCOUNTS_SECTIONS, PROFILE_SECTIONS };
