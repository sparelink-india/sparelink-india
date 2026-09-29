import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { createHeroCollectionDeps, HERO_SLOT_META } from "@/lib/hero-collection-repository";

/**
 * GET /api/admin/hero-collections
 *
 * The eight approved slots with their enabled state and item counts. Read-only:
 * the admin page uses this to render, and the storefront uses its own
 * server-side read, so nothing here can change a collection.
 */
export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const counts = await createHeroCollectionDeps().listSlotCounts();
  return NextResponse.json({
    slots: HERO_SLOT_META.map((meta) => {
      const row = counts.get(meta.slot);
      return {
        slot: meta.slot,
        label: meta.label,
        note: meta.note,
        isEnabled: row?.isEnabled ?? false,
        count: row?.count ?? 0,
      };
    }),
  });
}
