import Image from "next/image";

import { hasVehicleModelImage, vehicleModelImage } from "@/lib/vehicle-image-paths";
import type { FitmentModel } from "@/lib/vehicle-fitment";

/**
 * The vehicle image, with the model name baked into the fallback.
 *
 * WHY THIS EXISTS. `model.photo` is null when a model has no verified image. The
 * old markup handled that with `model.photo || "/images/vehicles/placeholder.svg"`,
 * which renders the same generic "Vehicle photo unavailable" card for every
 * model and gives the customer no way to tell which tile they are looking at.
 *
 * This component instead falls back to a plate carrying the exact model name, so
 * "Mahindra XUV 3XO" without an image shows "XUV 3XO" — never some other
 * Mahindra. That is the whole point: an absent image must be visibly absent, not
 * quietly filled with the wrong vehicle.
 *
 * WHY IT IMPORTS `vehicle-image-paths` AND NOT `vehicle-fitment-assets`. This
 * component renders inside a client component, so it must not pull in
 * `node:fs`. It also has no reason to: the server already resolved whether a
 * photo exists and put the answer on `model.photo`. One resolution, done once,
 * on the server.
 *
 * RENDERING. `next/image` with a real intrinsic size and a `sizes` hint, so the
 * browser picks a sensible source width instead of pulling the full 1600px file.
 * `priority` is opt-in and passed only for the first visible image, which keeps
 * everything below the fold lazy.
 */
export function VehicleModelImage({
  model,
  sizes,
  priority = false,
  className = "",
}: {
  model: Pick<FitmentModel, "make" | "model" | "makeSlug" | "modelSlug" | "photo">;
  /** Same contract as next/image `sizes`. */
  sizes: string;
  /** Set only on the first visible image; everything else stays lazy. */
  priority?: boolean;
  className?: string;
}) {
  const hasPhoto = hasVehicleModelImage(model);
  const alt = hasPhoto
    ? `${model.make} ${model.model}`
    : `${model.model} — image not yet available`;

  if (!hasPhoto) {
    /* The caller's `className` is written for an <img> — `object-contain`, and
       the tile padding. Those are either meaningless on a <span> (`object-fit`
       needs a real box to fit into) or would double the inset when combined
       with this element's own padding, so they are dropped rather than
       concatenated. Only the motion classes are borrowed, since a hover scale
       is meaningful on any element. */
    const motion = className
      .split(/\s+/)
      .filter(Boolean)
      .filter((name) => /^(transition|duration|ease|group-hover:|hover:|motion-)/.test(name))
      .join(" ");

    return (
      <span
        role="img"
        aria-label={alt}
        className={`flex h-full w-full flex-col items-center justify-center p-2 ${motion}`}
      >
        <span className="flex h-full w-full items-center justify-center rounded-[var(--sl-r)] border border-dashed border-[var(--sl-rule-2)] bg-[var(--sl-sunken)]">
          {/* The model name only. Not the make: the make is already the
              section heading directly above this tile, and repeating it here
              would compete with the model identity the brief asks to keep
              clearly associated with the image. */}
          <span className="sl-metric-label px-2 !text-[0.625rem] leading-tight">
            {model.model}
          </span>
        </span>
      </span>
    );
  }

  return (
    <Image
      src={vehicleModelImage(model)}
      alt={alt}
      width={1600}
      height={1000}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
