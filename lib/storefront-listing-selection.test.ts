import assert from "node:assert/strict";
import test from "node:test";

import { selectPreferredStorefrontListing } from "@/lib/storefront-listing-selection";

test("prefers an active priced in-stock listing from a supported firm", () => {
  const selected = selectPreferredStorefrontListing([
    {
      id: "unavailable",
      status: "active",
      stock: 0,
      pricePaise: 1000,
      firmId: "firm-ambaji-traders",
    },
    {
      id: "available",
      status: "active",
      stock: 4,
      pricePaise: 1200,
      firmId: "firm-hind-motors",
    },
  ]);

  assert.equal(selected?.id, "available");
});

test("retains the first listing as a request-price fallback", () => {
  const selected = selectPreferredStorefrontListing([
    {
      id: "request",
      status: "active",
      stock: 3,
      pricePaise: 0,
      firmId: "firm-ambaji-traders",
    },
  ]);

  assert.equal(selected?.id, "request");
});
