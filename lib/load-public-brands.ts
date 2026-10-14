import { sql } from "drizzle-orm";

import { part } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { isCustomerVisibleCatalogueBrand } from "@/lib/public-brands";

/**
 * The customer-visible brand list, read straight from the catalogue.
 *
 * WHY THIS EXISTS
 * ---------------
 * The logic used to live only inside `app/api/catalogue/brands/route.ts`. The
 * generation-4 homepage needs the same list, but it needs it during SERVER
 * render: fetching it in a client effect meant the brand tiles were absent from
 * the first paint, which cost SEO and caused the section to jump once the
 * request came back.
 *
 * Copying the query into the page would have created two implementations that
 * could drift, and a brand that is customer-visible in one and hidden in the
 * other. So the query is extracted here and BOTH callers use it. There is still
 * exactly one definition of "a brand a customer may see".
 *
 * Filtering keeps `isCustomerVisibleCatalogueBrand` as the single authority on
 * visibility, so this helper cannot accidentally widen what the storefront
 * shows.
 *
 * Never throws: an unreachable catalogue yields an empty list, because a
 * homepage with no brand tiles is acceptable and a 500 is not.
 */
export async function loadPublicBrands(): Promise<string[]> {
  try {
    const rows = await getDb()
      .select({ brand: part.brand })
      .from(part)
      .where(sql`${part.brand} is not null and ${part.brand} <> ''`)
      .groupBy(part.brand)
      .orderBy(part.brand);
    return rows
      .map((row) => row.brand)
      .filter(
        (name): name is string =>
          Boolean(name) && isCustomerVisibleCatalogueBrand(name),
      );
  } catch {
    return [];
  }
}
