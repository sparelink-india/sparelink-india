import { readFileSync } from "node:fs";
import path from "node:path";

import { isDatabaseConfigured } from "@/lib/db";
import { loadFitmentCatalog } from "@/lib/load-fitment";
import type { FitmentBrand } from "@/lib/vehicle-fitment";
import { resolveVehicleModelImage } from "@/lib/vehicle-fitment-assets";
import {
  summariseVehicleImages,
  vehicleImageStatus,
  type VehicleImageRow,
  type VehicleImageSummary,
} from "@/lib/vehicle-image-catalogue";

/**
 * Vehicle Image Manager - phase 2 server side.
 *
 * READ-ONLY BY DESIGN, and that is a finding rather than a shortcut.
 *
 * WHY THERE IS NO UPLOAD HERE. Vehicle model images are committed static files
 * under `public/images/vehicles/models/`, resolved by `existsSync` at request
 * time in `lib/vehicle-fitment-assets.ts`. They are NOT in the database and NOT
 * in R2. `public/` is a build-time asset directory: Next snapshots it when the
 * app is built and serves the result as static files. This project deploys to
 * Vercel, where the runtime filesystem is read-only and ephemeral, so an API
 * route that wrote an image into `public/` would appear to work under `next
 * dev` and silently do nothing in production. Shipping that would be worse than
 * shipping nothing: the admin would see the upload succeed, and customers would
 * never see the picture.
 *
 * WHY R2 IS NOT USED AS A QUICK FIX. `lib/r2-s3.ts` could hold the bytes, but the
 * existing resolver deliberately does not read R2 - `vehicle-image-paths.ts` is
 * pure and client-reachable, and `resolveVehicleModelImage` answers from disk or
 * from null. Teaching the resolver about a second origin is a change to the
 * storefront render path, not an admin feature, and it needs its own plan.
 *
 * WHY THE PIPELINE IS A SCRIPT, NOT AN UPLOAD. These are Creative Commons files
 * with per-image provenance. `data/vehicle-fitment-image-sources.json` is the
 * source of truth and `scripts/prepare-vehicle-fitment-images.py` regenerates
 * both the cutouts and the generated `SOURCES.txt` licence record. An unvetted
 * upload would bypass that provenance trail, and `vehicle-fitment-assets.test.ts`
 * deliberately asserts the manifest, the files and the licence record agree.
 *
 * So this module reports exactly what is on disk, where it came from, and what
 * the sanctioned way to change it is. It invents no write path. The pure data it
 * shares with the browser lives in `lib/vehicle-image-catalogue.ts`.
 */

export type { VehicleImageRow, VehicleImageSummary, HeroVehicleClass, VehicleImageStatus } from "@/lib/vehicle-image-catalogue";

type Manifest = {
  images: Array<{ make: string; model: string; filename: string; commonsTitle: string; note?: string }>;
  pending: Array<{ make: string; model: string; filename: string; reason: string }>;
};

function readManifest(): Manifest | null {
  try {
    return JSON.parse(
      readFileSync(
        path.join(process.cwd(), "data", "vehicle-fitment-image-sources.json"),
        "utf8",
      ),
    ) as Manifest;
  } catch {
    return null;
  }
}

/** Pure apart from the one resolver call: turn brands plus manifest into rows. */
export function buildVehicleImageRows(
  brands: readonly FitmentBrand[],
  manifest: Manifest | null,
): VehicleImageRow[] {
  const sourced = new Map(
    (manifest?.images ?? []).map((entry) => [`${entry.make} ${entry.model}`, entry]),
  );
  const pending = new Map(
    (manifest?.pending ?? []).map((entry) => [`${entry.make} ${entry.model}`, entry]),
  );

  return brands.flatMap((brand) =>
    brand.models.map((model) => {
      /* The single source of truth for "is there a file". Never derived. */
      const photo = resolveVehicleModelImage(brand.slug, model.modelSlug);
      const key = `${brand.make} ${model.model}`;
      const source = sourced.get(key) ?? null;
      const pendingEntry = pending.get(key) ?? null;

      return {
        make: brand.make,
        model: model.model,
        makeSlug: brand.slug,
        modelSlug: model.modelSlug,
        photo,
        filename: photo ? photo.split("/").pop() ?? null : null,
        status: vehicleImageStatus({ photo, isPending: Boolean(pendingEntry) }),
        commonsTitle: source?.commonsTitle ?? null,
        pendingReason: pendingEntry?.reason ?? null,
        partCount: model.partCount,
      } satisfies VehicleImageRow;
    }),
  );
}

export { summariseVehicleImages, vehicleImageStatus } from "@/lib/vehicle-image-catalogue";

export type VehicleImageInventory = {
  rows: VehicleImageRow[];
  summary: VehicleImageSummary;
  /** False when DATABASE_URL is absent, so the page can say so honestly. */
  catalogueLoaded: boolean;
};

/**
 * Real inventory: the real vehicle catalogue, the real files on disk, and the
 * real manifest. No database means no rows, and `catalogueLoaded` is false so
 * the UI can say the catalogue was unavailable rather than showing "no models".
 */
export async function loadVehicleImageInventory(): Promise<VehicleImageInventory> {
  if (!isDatabaseConfigured()) {
    return {
      rows: [],
      summary: { models: 0, present: 0, pending: 0, missing: 0 },
      catalogueLoaded: false,
    };
  }

  const { brands } = await loadFitmentCatalog();
  const rows = buildVehicleImageRows(brands, readManifest());

  return { rows, summary: summariseVehicleImages(rows), catalogueLoaded: true };
}
