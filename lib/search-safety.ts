/**
 * Customer-facing search safety helpers for Phase 7 AI search.
 * Commercial and source fields always come from verified DB rows.
 */

import { isCustomerVisibleProduct } from "./ci-sync/types";

export type VerifiedSearchPart = {
  id: string;
  partNumber: string;
  name: string;
  brand: string | null;
  isPublished: boolean;
  approvalStatus?: string | null;
};

/**
 * Drop unpublished / pending-approval parts from customer search results.
 * Admins may still see everything when includeUnpublished is true.
 */
export function filterSearchPartsForCustomer<T extends VerifiedSearchPart>(
  parts: T[],
  options?: { includeUnpublished?: boolean },
): T[] {
  if (options?.includeUnpublished) return parts;
  return parts.filter((part) =>
    isCustomerVisibleProduct({
      isPublished: part.isPublished,
      approvalStatus: part.approvalStatus ?? "APPROVED",
    }),
  );
}

/**
 * Safety: search responses must never invent commercial fields.
 * Only pass through values that already exist on the verified part/listing.
 */
export function assertNoInventedCommercialFields(input: {
  pricePaise?: number | null;
  stock?: number | null;
  invented?: boolean;
}): { pricePaise: number | null; stock: number | null } {
  if (input.invented) {
    throw new Error("AI search must not invent commercial fields");
  }
  return {
    pricePaise: input.pricePaise ?? null,
    stock: input.stock ?? null,
  };
}
