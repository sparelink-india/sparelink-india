"use client";

import { useEffect, useState } from "react";

import { PUBLIC_BRANDS, type PublicBrand } from "@/lib/public-brands";

/**
 * Reads the brand presentation overlay, for the components that render brand
 * cards.
 *
 * MEMBERSHIP IS NOT NEGOTIABLE HERE. `PUBLIC_BRANDS` is the approved list of nine
 * and it remains the source of truth for which brands exist: `/api/brands`
 * returns the registry merged with the admin's overrides and discards any
 * override whose id is not in the registry. So this hook can only ever change
 * what a card looks like — its name, logo, relationship and destination — and
 * cannot add or remove a brand.
 *
 * FALLS BACK TO THE STATIC REGISTRY ON ANY FAILURE, including a request that has
 * not returned yet. A database problem or a network blip leaves the approved
 * brands rendering exactly as they always have, rather than a blank section. The
 * initial value is the registry, so there is no loading flash either: the first
 * paint is correct and a successful response simply refines it.
 *
 * SHARED BY THE HOMEPAGE GRID AND THE /brands DIRECTORY on purpose. They were
 * reading the registry independently, which is how a storefront ends up showing
 * a brand name the admin never saved, or the reverse.
 */
export function useResolvedBrands(): readonly PublicBrand[] {
  const [brands, setBrands] = useState<readonly PublicBrand[]>(PUBLIC_BRANDS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/brands", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (cancelled || !Array.isArray(data?.brands)) return;
        /* Defensive re-check on ids: the endpoint already discards non-registry
           ids, but this is the component that decides what a customer sees, and
           an unexpected shape must not remove an approved brand from the page. */
        const approved = new Set(PUBLIC_BRANDS.map((b) => b.id));
        const safe = (data.brands as PublicBrand[]).filter((b) => approved.has(b?.id));
        if (safe.length === 0 || cancelled) return;
        setBrands(safe);
      } catch {
        /* Keep the registry. These sections must never depend on this fetch. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return brands;
}
