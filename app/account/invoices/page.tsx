"use client";

import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { SectionEmpty } from "@/components/account/account-sections";
import { useI18n } from "@/components/preferences-provider";

/**
 * Accounts -> Invoices.
 *
 * There is no invoice LIST endpoint. Tax invoices are issued per order at
 * /api/orders/[id]/invoice and are downloaded from the order itself, which is
 * the real source and is not duplicated here. The section points at it instead
 * of rendering an invented list, or an empty table that looks broken.
 */
export default function AccountInvoicesPage() {
  const { t } = useI18n();
  return (
    <AccountSectionLayout titleKey="accounts.invoices" variant="accounts">
      <SectionEmpty
        title={t("accounts.invoices")}
        body={t("accounts.invoicesHint")}
        action={{ href: "/orders", label: t("accounts.orders") }}
      />
    </AccountSectionLayout>
  );
}
