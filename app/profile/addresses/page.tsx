import { AccountSectionLayout } from "@/components/account/account-section-layout";
import { ProfileAddresses } from "@/components/account/profile-addresses";

/** Profile -> Addresses. Real data from the customer's own /api/profile. */
export default function ProfileAddressesPage() {
  return (
    <AccountSectionLayout titleKey="profile.addresses" variant="profile">
      <ProfileAddresses />
    </AccountSectionLayout>
  );
}
