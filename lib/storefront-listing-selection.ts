import { isAllowedFirmId } from "@/lib/firms";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

export type StorefrontListingCandidate = {
  status?: string | null;
  stock?: number | null;
  pricePaise?: number | null;
  listInclusivePaise?: number | null;
  netInclusivePaise?: number | null;
  pensolCashNetInclusivePaise?: number | null;
  pensolCreditNetInclusivePaise?: number | null;
  firmId?: string | null;
};

/**
 * Prefer a listing that can actually be shown as an actionable storefront offer.
 * Keep the first listing as a fallback so unpriced/request items retain their
 * existing Price on Request presentation.
 */
export function selectPreferredStorefrontListing<T extends StorefrontListingCandidate>(
  listings: readonly T[] | null | undefined,
): T | undefined {
  if (!listings?.length) return undefined;
  const eligible = listings.find(
    (listing) =>
      listing.status === "active" &&
      (listing.stock ?? 0) > 0 &&
      isAuthoritativeSellingPricePaise(
        listing.pricePaise,
        listing.listInclusivePaise,
        listing.netInclusivePaise,
        listing.pensolCashNetInclusivePaise,
        listing.pensolCreditNetInclusivePaise,
      ) &&
      (!listing.firmId || isAllowedFirmId(listing.firmId)),
  );
  return eligible ?? listings[0];
}
