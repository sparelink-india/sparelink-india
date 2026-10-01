"use client";

import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";

/**
 * Accounts -> Schemes.
 *
 * No scheme table backs a customer-facing scheme list, and nothing about one is
 * invented. The route exists so the navigation structure is settled and a real
 * source can be wired in later without moving anything.
 */
export default function AccountSchemesPage() {
  const { t } = useI18n();
  return (
    <AccountSectionLayout titleKey="accounts.schemes" variant="accounts">
      <SectionEmpty title={t("accounts.schemes")} body={t("accounts.schemesHint")} />
    </AccountSectionLayout>
  );
}
