import type { FitmentModel } from "@/lib/vehicle-fitment";

/**
 * Vehicle image paths — pure, isomorphic, no filesystem access.
 *
 * WHY THIS IS A SEPARATE MODULE. `lib/vehicle-fitment-assets.ts` checks that a
 * file actually exists, so it needs `node:fs` and can only run on the server.
 * The model page's client component needs to know the same path shape, and
 * importing the checker from there drags `fs` into the browser bundle and fails
 * the build. So the path arithmetic lives here with no I/O, and the server-side
 * checker in `vehicle-fitment-assets.ts` builds on it.
 *
 * The consequence is that the path is derived, never stored: any component can
 * compute a model's image path from its make and model slug alone, and there is
 * exactly one definition of that derivation in the codebase.
 */

/** Extension candidates, most preferred first. WebP is the vehicle-set format. */
export const VEHICLE_MODEL_EXTENSIONS = [".webp", ".jpg", ".png"] as const;
export const VEHICLE_MAKE_EXTENSIONS = [".png", ".svg"] as const;

/** Folder both kinds of vehicle asset live in. */
const VEHICLE_ROOT = "/images/vehicles";

/**
 * Last-resort generic image for a model with no verified photo.
 *
 * The fitment UI does not use this: it renders a branded plate carrying the
 * model's own name instead, so an absent image is visibly absent. This path
 * exists for non-UI consumers and for the `alt` text contract.
 */
export const VEHICLE_MODEL_PLACEHOLDER = `${VEHICLE_ROOT}/placeholder.svg`;

/** `models/{make-slug}-{model-slug}{extension}` for one extension. */
export function vehicleModelFileName(
  makeSlug: string,
  modelSlug: string,
  extension: string,
): string {
  return `${VEHICLE_ROOT}/models/${makeSlug}-${modelSlug}${extension}`;
}

/** `makes/{slug}{extension}` for one extension. */
export function vehicleMakeFileName(slug: string, extension: string): string {
  return `${VEHICLE_ROOT}/makes/${slug}${extension}`;
}

/** Every candidate path for a model, most preferred first. */
export function vehicleModelImageCandidates(
  makeSlug: string,
  modelSlug: string,
): string[] {
  return VEHICLE_MODEL_EXTENSIONS.map((extension) =>
    vehicleModelFileName(makeSlug, modelSlug, extension),
  );
}

/**
 * What a caller needs to resolve a model's image: the slugs, plus the photo the
 * server already looked up. `photo` is optional because a caller may only have
 * the slugs (a test, or a data migration).
 */
export type VehicleImageRef = Pick<FitmentModel, "makeSlug" | "modelSlug"> & {
  photo?: string | null;
};

/**
 * The image a model renders: its own photo if the server found one, otherwise
 * the generic placeholder.
 *
 * DELIBERATELY DOES NOT FALL BACK TO A DERIVED PATH. It is tempting to return
 * `vehicleModelFileName(makeSlug, modelSlug, ".webp")` when `photo` is null, but
 * that path is only a guess: this function is pure and cannot know the file is
 * there. A guess would render a broken image while looking, in code, like a
 * successful resolution. The server's `attachFitmentAssets` is the only thing
 * that can answer "does this file exist", and a null `photo` is that answer.
 */
export function vehicleModelImage(model: VehicleImageRef): string {
  return model.photo ?? VEHICLE_MODEL_PLACEHOLDER;
}

/** True when the server resolved a real photo for this model. */
export function hasVehicleModelImage(model: {
  photo: string | null;
}): boolean {
  return Boolean(model.photo);
}
