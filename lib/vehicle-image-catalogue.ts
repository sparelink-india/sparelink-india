/**
 * Vehicle image inventory - pure data and rules.
 *
 * Split from `admin-vehicle-images.ts` for the same reason
 * `lib/vehicle-image-paths.ts` is split from `lib/vehicle-fitment-assets.ts`:
 * the inventory loader touches `node:fs` and the database, so it can only run on
 * the server, but the Editing Studio page needs the hero class list and the
 * status vocabulary in a client component that owns the preview dialog. Putting
 * the pure half here keeps `node:fs` out of the browser bundle.
 *
 * Nothing in this module reads a file, a database or the network.
 */

export type VehicleImageStatus = "present" | "pending" | "missing";

export type VehicleImageRow = {
  make: string;
  model: string;
  makeSlug: string;
  modelSlug: string;
  /** The real server-resolved path, or null. Never a guessed path. */
  photo: string | null;
  /** Basename of `photo`, or null when there is no image. */
  filename: string | null;
  status: VehicleImageStatus;
  /** Wikimedia Commons file title from the manifest, when the model is sourced. */
  commonsTitle: string | null;
  /** Why a model has no image on purpose, when the manifest says so. */
  pendingReason: string | null;
  /** Parts compatible with this model, as the storefront reports it. */
  partCount: number;
};

export type HeroVehicleClass = {
  id: string;
  label: string;
  /** What actually renders this class today, stated without embellishment. */
  note: string;
};

/**
 * The seven hero vehicle classes, transcribed from the hero hotspot labels in
 * `components/home-hero.tsx`. These are marketing classes, NOT vehicles: none of
 * them has a `vehicle` table row and none may be written into
 * `part_vehicle_compatibility`. They live in their own list so a class can never
 * be mistaken for a fitment model.
 */
export const HERO_VEHICLE_CLASSES: readonly HeroVehicleClass[] = [
  {
    id: "heavy-commercial-vehicle",
    label: "Heavy Commercial Vehicle",
    note: "Hotspot on the container truck in the hero artwork.",
  },
  {
    id: "light-commercial-vehicle",
    label: "Light Commercial Vehicle",
    note: "Hotspot on the mini truck in the hero artwork.",
  },
  {
    id: "passenger-vehicle",
    label: "Passenger Vehicle",
    note: "Two hotspots, on the red SUV and the white saloon.",
  },
  {
    id: "agriculture-vehicle",
    label: "Agriculture Vehicle",
    note: "Hotspot on the tractor in the hero artwork.",
  },
  {
    id: "earthmover",
    label: "Earthmover",
    note: "Hotspot on the backhoe loader in the hero artwork.",
  },
  {
    id: "motorcycle",
    label: "Motorcycle",
    note: "Hotspot on the motorcycle in the hero artwork.",
  },
  {
    id: "scooter",
    label: "Scooter",
    note: "Hotspot on the scooter in the hero artwork.",
  },
];

export const HERO_ARTWORK_PATH = "/images/hero/hero-final-reference.png";

/**
 * Why each hero class has no image of its own, shown verbatim on the page.
 *
 * The homepage hero is ONE composited bitmap with invisible click targets laid
 * over it. The vehicles are painted into that single picture; there is no
 * per-class file, and no storefront component reads one. Inventing per-class
 * artwork would be new design, not editing.
 */
export const HERO_CLASS_IMAGE_NOTE =
  "The homepage hero is a single composited bitmap. Each class is a click target over that artwork, not a separate image file, so there is nothing per class to replace.";

/** The directory a replacement file has to land in, for the admin to read. */
export const MODEL_IMAGE_DIRECTORY = "public/images/vehicles/models/";

/** The sanctioned replacement path: edit the manifest, regenerate with this. */
export const IMAGE_PIPELINE_SCRIPT = "python scripts/prepare-vehicle-fitment-images.py";

/**
 * Status for one model. `pending` wins over `missing` because a model the
 * manifest deliberately excludes is not an oversight and must not be presented
 * as a gap to fill.
 */
export function vehicleImageStatus(input: {
  photo: string | null;
  isPending: boolean;
}): VehicleImageStatus {
  if (input.photo) return "present";
  return input.isPending ? "pending" : "missing";
}

export const IMAGE_STATUS_LABEL: Record<VehicleImageStatus, string> = {
  present: "Image present",
  pending: "Intentionally absent",
  missing: "No image",
};

export const IMAGE_STATUS_TONE: Record<VehicleImageStatus, "good" | "info" | "warn"> = {
  present: "good",
  pending: "info",
  missing: "warn",
};

export type VehicleImageSummary = {
  models: number;
  present: number;
  pending: number;
  missing: number;
};

export function summariseVehicleImages(rows: readonly VehicleImageRow[]): VehicleImageSummary {
  return {
    models: rows.length,
    present: rows.filter((row) => row.status === "present").length,
    pending: rows.filter((row) => row.status === "pending").length,
    missing: rows.filter((row) => row.status === "missing").length,
  };
}
