import { Suspense } from "react";

import { StorefrontShell } from "@/components/storefront-shell";
import { ProductsCatalogue } from "@/components/products-catalogue";
import { getServerMessages } from "@/lib/i18n/server";
import { routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = routeMetadata({
  path: "/products",
  title: "Auto Spare Parts Catalogue - Browse All Parts",
  description:
    "Browse the full SpareLink India spare parts catalogue. Filter by category, brand and vehicle to find the parts that fit your car, truck, two wheeler, LCV/HCV or industrial machine.",
});

/**
 * /products - the FULL catalogue.
 *
 * WHY THIS PAGE EXISTS. "Products" in the primary navigation used to point at
 * `/category/filters`, which is a single category. A shopper who clicked
 * "Products" expecting the catalogue got a filtered slice of it, and the
 * navigation item was therefore lying about what it did.
 *
 * WHY IT IS A BROWSE PAGE AND NOT ONE BIG RESULT SET. The search API
 * deliberately refuses a query with no scope - `if (!query && !hasVehicleParams
 * && !hasCategoryScope)` - and that guard is correct: an unscoped query against
 * a large collection is expensive and its ranking is meaningless. Widening that
 * endpoint would be a search-backend change, which is out of scope for this
 * work.
 *
 * So the full catalogue is presented the way a catalogue is presented: the
 * complete set of categories, the complete brand list, vehicle fitment as the
 * third axis, and a search field that hands a typed query to the existing
 * result experience. Every filter the storefront already has is reachable from
 * here, nothing is filtered away by default, and a query or filter URL still
 * represents a filtered result set exactly as before.
 */
export default async function ProductsPage() {
  const messages = await getServerMessages();

  return (
    <StorefrontShell>
      <Suspense
        fallback={
          <p className="py-16 text-center text-sm text-[var(--v3-text-2)]">
            {messages["common.loading"]}
          </p>
        }
      >
        <ProductsCatalogue heading={messages["nav.products"]} lead={messages["products.lead"]} />
      </Suspense>
    </StorefrontShell>
  );
}
