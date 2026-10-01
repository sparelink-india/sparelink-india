"use client";

import Link from "next/link";

import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { HeaderPreferenceToggle } from "@/components/header-preference-toggle";
import { useI18n } from "@/components/preferences-provider";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Profile -> Settings.
 *
 * Language and theme are the EXISTING preference controls, rendered through
 * the existing provider, so switching either still writes the same cookie and
 * localStorage it always did. No second settings system, and no second source
 * of truth for the current locale or theme.
 *
 * Logout is the existing `SignOutButton`, which delegates to the same
 * better-auth sign-out the header already uses. No bespoke sign-out path is
 * introduced here, and this page defines none of its own.
 */
export default function ProfileSettingsPage() {
  const { t } = useI18n();

  return (
    <AccountSectionLayout titleKey="profile.settings" variant="profile">
      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--v3-text)]">{t("settings.appearance")}</h2>
          <p className="mt-1 text-[12px] text-[var(--v3-text-3)]">{t("settings.theme")}</p>
          <div className="mt-3">
            <HeaderPreferenceToggle />
          </div>
        </section>

        <section className="rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--v3-text)]">{t("settings.language")}</h2>
          <p className="mt-1 text-[12px] text-[var(--v3-text-3)]">{t("settings.hindi")}</p>
          <div className="mt-3">
            <HeaderPreferenceToggle />
          </div>
        </section>

        <section className="rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--v3-text)]">{t("profile.settings")}</h2>
          <Link
            href="/account/change-password"
            className="mt-3 inline-flex text-[13px] font-semibold text-[var(--v3-brand-ink)] hover:underline"
          >
            {t("profile.changePassword")}
          </Link>
        </section>

        <section className="rounded-[var(--v3-r-lg)] border border-[var(--v3-rule)] bg-white p-4">
          <h2 className="text-sm font-bold text-[var(--v3-text)]">{t("profile.logout")}</h2>
          <div className="mt-3">
            <SignOutButton />
          </div>
        </section>
      </div>
    </AccountSectionLayout>
  );
}
