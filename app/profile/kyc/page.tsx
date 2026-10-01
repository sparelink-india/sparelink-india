"use client";

import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";

/**
 * Profile -> KYC documents.
 *
 * There is no KYC table, upload endpoint or verification state anywhere in the
 * schema. Nothing about a customer's KYC is invented, and no fake document slot
 * is offered that cannot store anything. When a real flow exists it drops in
 * here without touching the navigation.
 */
export default function ProfileKycPage() {
  const { t } = useI18n();
  return (
    <AccountSectionLayout titleKey="profile.kyc" variant="profile">
      <SectionEmpty title={t("profile.kyc")} body={t("profile.kycHint")} />
    </AccountSectionLayout>
  );
}
