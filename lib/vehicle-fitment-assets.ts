import { existsSync } from "fs";
import path from "path";

import type { FitmentBrand, FitmentModel } from "@/lib/vehicle-fitment";
import {
  VEHICLE_MAKE_EXTENSIONS,
  VEHICLE_MODEL_EXTENSIONS,
  vehicleMakeFileName,
  vehicleModelFileName,
} from "@/lib/vehicle-image-paths";

/**
 * SERVER-SIDE vehicle image resolution - the single place the fitment catalogue
 * is turned into image paths.
 *
 * This module touches `node:fs`, so it must never be imported from a client
 * component. The pure path arithmetic it is built on lives in
 * `lib/vehicle-image-paths.ts`, which is safe anywhere.
 *
 * WHY EXISTENCE IS CHECKED ON DISK. These are committed static files, not
 * remote objects, so a manifest can drift from what actually shipped. Resolving
 * against the real filesystem means a model whose image is absent gets a null
 * photo automatically instead of a broken image on the storefront.
 *
 * WEBP FIRST. The vehicle set is WebP. `.webp` is listed first so the preferred
 * format always wins, but the older `.jpg` / `.png` slots still resolve, so an
 * image added later in either format is picked up with no code change.
 */

function publicFile(relative: string): string | null {
  const absolute = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
  return existsSync(absolute) ? relative : null;
}

/** First model image that exists on disk, or null. */
export function resolveVehicleModelImage(
  makeSlug: string,
  modelSlug: string,
): string | null {
  for (const extension of VEHICLE_MODEL_EXTENSIONS) {
    const found = publicFile(vehicleModelFileName(makeSlug, modelSlug, extension));
    if (found) return found;
  }
  return null;
}

/** First make logo that exists on disk, or null. */
export function resolveVehicleMakeLogo(slug: string): string | null {
  for (const extension of VEHICLE_MAKE_EXTENSIONS) {
    const found = publicFile(vehicleMakeFileName(slug, extension));
    if (found) return found;
  }
  return null;
}

/**
 * Attach resolved image paths to the fitment catalogue.
 *
 * `photo` stays NULL when a model has no verified image rather than being
 * pre-filled with a placeholder: `loadFitmentCatalog` reports on that null to
 * build its `missingPhotos` list, and silently substituting a placeholder here
 * would make the catalogue look complete when it is not. Components that render
 * an image branch on `model.photo` themselves.
 */
export function attachFitmentAssets(brands: FitmentBrand[]): FitmentBrand[] {
  return brands.map((brand) => ({
    ...brand,
    logo: resolveVehicleMakeLogo(brand.slug),
    models: brand.models.map((model: FitmentModel) => ({
      ...model,
      photo: resolveVehicleModelImage(model.makeSlug, model.modelSlug),
    })),
  }));
}
