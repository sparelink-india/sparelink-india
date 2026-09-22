import { existsSync } from "fs";
import path from "path";

import type { FitmentBrand } from "@/lib/vehicle-fitment";

function publicFile(relative: string): string | null {
  const absolute = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
  return existsSync(absolute) ? relative : null;
}

export function attachFitmentAssets(brands: FitmentBrand[]): FitmentBrand[] {
  return brands.map((brand) => ({
    ...brand,
    logo:
      publicFile(`/images/vehicles/makes/${brand.slug}.png`) ||
      publicFile(`/images/vehicles/makes/${brand.slug}.svg`) ||
      null,
    models: brand.models.map((model) => ({
      ...model,
      photo:
        publicFile(`/images/vehicles/models/${brand.slug}-${model.modelSlug}.jpg`) ||
        publicFile(`/images/vehicles/models/${brand.slug}-${model.modelSlug}.png`) ||
        publicFile(`/images/vehicles/models/${brand.slug}-${model.modelSlug}.webp`) ||
        null,
    })),
  }));
}
