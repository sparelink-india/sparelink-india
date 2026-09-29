import { getDb } from "@/lib/db";
import { isHeroCollectionSlot, type HeroCollectionSlot } from "@/lib/hero-collections";
import { heroVehicleCollection, heroVehicleCollectionItem } from "@/drizzle/schema";
import { asc, eq } from "drizzle-orm";
import type { HeroSlotAvailability } from "@/components/home-hero";

/**
 * Which hero slots have a curated, enabled, non-empty collection.
 *
 * READ ON THE SERVER, ONCE PER HOMEPAGE REQUEST, and passed down to the hero.
 * Two reasons it lives here rather than inside the hero component:
 *
 *   the hero renders inside `app/(public)/home-client.tsx`, a client component,
 *   which cannot read the database. Fetching from the browser would put the
 *   fallback decision behind a round-trip that can fail visibly, and a hero dot
 *   that 404s is much worse than one that goes to the fitment browser.
 *
 *   and the hero is hidden once a search is submitted, so a client fetch would
 *   run for visitors who never see it.
 *
 * DEGRADES, IT DOES NOT FAIL. If the read throws, this returns undefined and the
 * hero resolves every slot to `/vehicle-fitment`, which is the behaviour that
 * worked before collections existed. A database problem must never be able to
 * break the homepage's eight dots, so nothing here propagates an error.
 *
 * The slot CHECK constraint means no row can name an unknown slot, and
 * `isHeroCollectionSlot` filters anyway: this value is serialised into the page
 * and turned into hrefs, so it is not the right place to be trusting a column.
 */
export async function readHeroSlotAvailability(): Promise<HeroSlotAvailability | undefined> {
  try {
    const rows = await getDb()
      .select({
        slot: heroVehicleCollection.slot,
        isEnabled: heroVehicleCollection.isEnabled,
        partId: heroVehicleCollectionItem.partId,
      })
      .from(heroVehicleCollection)
      .leftJoin(
        heroVehicleCollectionItem,
        eq(heroVehicleCollectionItem.slot, heroVehicleCollection.slot),
      )
      .orderBy(asc(heroVehicleCollection.displayOrder));

    const counts: Partial<Record<HeroCollectionSlot, number>> = {};
    const enabled: HeroCollectionSlot[] = [];
    for (const row of rows) {
      if (!isHeroCollectionSlot(row.slot)) continue;
      if (!row.isEnabled) continue;
      if (row.partId === null) continue; // enabled but nothing curated yet
      counts[row.slot] = (counts[row.slot] ?? 0) + 1;
      if (!enabled.includes(row.slot)) enabled.push(row.slot);
    }
    return { counts, enabled };
  } catch (error) {
    console.error("Hero collection lookup failed; falling back to vehicle fitment:", error);
    return undefined;
  }
}
