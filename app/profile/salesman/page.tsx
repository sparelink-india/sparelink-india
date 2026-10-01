"use client";

import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";

/**
 * Profile -> My salesman.
 *
 * No salesman-to-customer assignment exists in the schema, so no salesperson is
 * named, described or implied. Naming one would put a real-looking person
 * behind a relationship the system does not track.
 */
export default function ProfileSalesmanPage() {
  const { t } = useI18n();
  return (
    <AccountSectionLayout titleKey="profile.salesman" variant="profile">
      <SectionEmpty title={t("profile.salesman")} body={t("profile.salesmanHint")} />
    </AccountSectionLayout>
  );
}
