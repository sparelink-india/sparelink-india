"use client";

import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";

/**
 * Accounts -> Payments.
 *
 * A `payment` table and the Cashfree / Razorpay gateways exist, but there is no
 * read endpoint a customer could call to list their own payments, and none is
 * invented here. The section says so rather than showing a fabricated history.
 */
export default function AccountPaymentsPage() {
  const { t } = useI18n();
  return (
    <AccountSectionLayout titleKey="accounts.payments" variant="accounts">
      <SectionEmpty
        title={t("accounts.payments")}
        body={t("accounts.paymentsHint")}
        action={{ href: "/orders", label: t("accounts.orders") }}
      />
    </AccountSectionLayout>
  );
}
