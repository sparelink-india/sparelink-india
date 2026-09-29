import { asc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { brandProfile } from "@/drizzle/schema";
import {
  resolveAllBrands,
  type BrandProfileRow,
  type ResolvedBrand,
} from "@/lib/brand-admin";

/**
 * Read the brand overlay and merge it onto the config registry.
 *
 * ONE READER, USED BY BOTH THE ADMIN SCREEN AND THE PUBLIC ENDPOINT, so /brands
 * and the admin's view can never disagree about what a brand looks like. The
 * alternative, each side re-implementing the merge, is how a storefront starts
 * showing something the admin never saved.
 *
 * DEGRADES, IT DOES NOT FAIL. The overlay is an enhancement over an approved
 * registry that already renders correctly on its own. A database problem here
 * therefore returns the registry unchanged rather than an error: a blank brands
 * page would be a far worse outcome than an edit that does not appear yet. The
 * failure is logged, because silence is what this guard exists to avoid.
 */
export async function readResolvedBrands(): Promise<{
  brands: ResolvedBrand[];
  ignoredOverlayIds: string[];
}> {
  const fallback = {
    brands: resolveAllBrands([]).brands,
    ignoredOverlayIds: [] as string[],
  };

  try {
    const rows = await getDb()
      .select({
        id: brandProfile.id,
        displayName: brandProfile.displayName,
        description: brandProfile.description,
        logoUrl: brandProfile.logoUrl,
        relationship: brandProfile.relationship,
        searchQuery: brandProfile.searchQuery,
        displayOrder: brandProfile.displayOrder,
        isVisible: brandProfile.isVisible,
      })
      .from(brandProfile)
      .orderBy(asc(brandProfile.id));

    const overlays: BrandProfileRow[] = rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      description: r.description,
      logoUrl: r.logoUrl,
      relationship: r.relationship,
      searchQuery: r.searchQuery,
      displayOrder: r.displayOrder,
      isVisible: r.isVisible,
    }));

    const resolved = resolveAllBrands(overlays);
    return { brands: resolved.brands, ignoredOverlayIds: resolved.ignoredOverlayIds };
  } catch (error) {
    console.error("Brand profile read failed; serving the registry only:", error);
    return fallback;
  }
}
