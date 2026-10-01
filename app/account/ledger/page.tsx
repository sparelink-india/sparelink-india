import { AccountLedger } from "@/components/account/account-credit";
import { AccountSectionLayout } from "@/components/account/account-section-layout";

/** Accounts -> Ledger. Real entries from /api/dealer/credit. */
export default function AccountLedgerPage() {
  return (
    <AccountSectionLayout titleKey="accounts.ledger" variant="accounts">
      <AccountLedger />
    </AccountSectionLayout>
  );
}
