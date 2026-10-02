import { AccountSummary } from "@/components/account/account-credit";
import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { routeMetadata } from "@/lib/seo";

/* The account area is behind authentication and is worthless to a searcher, so
   it is explicitly kept out of the index. Without this it inherited the
   site-wide indexable default, which invited crawling of pages that can only
   ever render an empty shell or a redirect. */
export const metadata = routeMetadata({
  path: "/account",
  title: "Your Account",
  description:
    "Your SpareLink India account summary: outstanding balance, credit limit and available credit.",
  noIndex: true,
});

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
