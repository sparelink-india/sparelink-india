import { NextResponse } from "next/server";

import { readResolvedBrands } from "@/lib/brand-profile";

export const dynamic = "force-dynamic";

/**
 * GET /api/brands - the public brand list, registry merged with overrides.
 *
 * PUBLIC, because /brands is public. It exposes only presentation data that is
 * already on the page: id, name, logo, relationship, search query, description.
 * No internal fields, no configuration state, no catalogue counts.
 *
 * THE MERGE HAPPENS SERVER-SIDE so /brands and the homepage grid cannot
 * disagree about what a brand looks like. Both read this one response rather
 * than each re-implementing the overlay rules.
 *
 * The client falls back to the static registry if this request fails, so a
 * database problem leaves the approved brands rendering exactly as they always
 * have rather than blanking the page.
 */
export async function GET() {
  const { brands, ignoredOverlayIds } = await readResolvedBrands();

  return NextResponse.json(
    {
      brands: brands.filter((b) => b.isVisible !== false),
      /* Surfaced so an operator can see a row that has drifted out of the
         registry rather than wondering why it has no effect. */
      ignoredOverlayIds,
    },
    {
      headers: {
        /* Short, and revalidated: this is presentation copy, and a brand edit
           should appear without a redeploy. */
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
