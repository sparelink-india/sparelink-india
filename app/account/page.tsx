import { AccountSummary } from "@/components/account/account-credit";
import { AccountSectionLayout } from "@/components/account/account-section-layout";

/**
 * Accounts -> Summary.
 *
 * Outstanding, Credit limit and Available credit are read from the existing
 * /api/dealer/credit endpoint. Overdue is stated as untracked, not zeroed -
 * see components/account/account-credit.tsx for why.
 */
export default function AccountSummaryPage() {
  return (
    <AccountSectionLayout titleKey="accounts.summary" variant="accounts">
      <AccountSummary />
    </AccountSectionLayout>
  );
}
