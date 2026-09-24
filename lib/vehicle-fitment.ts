import { normalizeSearchText } from "@/lib/search-intent";

export type VehicleRecord = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  partCount?: number;
};

export type FitmentFuel = "petrol" | "diesel" | "cng" | "electric";

export type FitmentVariant = {
  id: string;
  label: string;
  fuel: FitmentFuel | null;
  engine: string | null;
  original: string;
  partCount: number;
};

export type FitmentModel = {
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  photo: string | null;
  partCount: number;
  variants: FitmentVariant[];
};

export type FitmentBrand = {
  make: string;
  slug: string;
  logo: string | null;
  models: FitmentModel[];
};

const GENERIC_MODEL_TOKENS = new Set([
  "car",
  "van",
  "truck",
  "vehicle",
  "universal",
  "all",
  "parts",
]);

const FUEL_PATTERNS: Array<{ fuel: FitmentFuel; pattern: RegExp }> = [
  { fuel: "electric", pattern: /\b(electric|ev)\b/ },
  { fuel: "cng", pattern: /\bcng\b/ },
  { fuel: "diesel", pattern: /\bdiesel\b/ },
  { fuel: "petrol", pattern: /\bpetrol\b/ },
];

export function slugifyFitment(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "-");
}

export function parseFitmentFuel(variant: string | null | undefined): FitmentFuel | null {
  const text = normalizeSearchText(variant || "");
  if (!text) return null;
  for (const item of FUEL_PATTERNS) {
    if (item.pattern.test(text)) return item.fuel;
  }
  return null;
}

export function parseFitmentEngine(variant: string | null | undefined): string | null {
  const match = String(variant || "").match(/\b\d+\.\d+\b/);
  return match ? match[0] : null;
}

export function originalVehicleLabel(vehicle: VehicleRecord): string {
  return [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ");
}

export function groupVehiclesByBrand(vehicles: VehicleRecord[]): FitmentBrand[] {
  const brands = new Map<
    string,
    { make: string; slug: string; models: Map<string, FitmentModel> }
  >();

  for (const vehicle of vehicles) {
    const make = vehicle.make.trim();
    const model = vehicle.model.trim();
    if (!make || !model) continue;
    const makeSlug = slugifyFitment(make);
    const modelSlug = slugifyFitment(model);
    const brand = brands.get(makeSlug) ?? {
      make,
      slug: makeSlug,
      models: new Map<string, FitmentModel>(),
    };
    const existing = brand.models.get(modelSlug);
    const variantLabel = (vehicle.variant || "").trim() || "Standard";
    const nextVariant: FitmentVariant = {
      id: vehicle.id,
      label: variantLabel,
      fuel: parseFitmentFuel(vehicle.variant),
      engine: parseFitmentEngine(vehicle.variant),
      original: originalVehicleLabel(vehicle),
      partCount: vehicle.partCount ?? 0,
    };
    if (existing) {
      existing.variants.push(nextVariant);
      existing.partCount += nextVariant.partCount;
    } else {
      brand.models.set(modelSlug, {
        make,
        makeSlug,
        model,
        modelSlug,
        photo: null,
        partCount: nextVariant.partCount,
        variants: [nextVariant],
      });
    }
    brands.set(makeSlug, brand);
  }

  return [...brands.values()]
    .map((brand) => ({
      make: brand.make,
      slug: brand.slug,
      logo: null,
      models: [...brand.models.values()].sort((a, b) => a.model.localeCompare(b.model)),
    }))
    .sort((a, b) => a.make.localeCompare(b.make));
}

export function findFitmentBrand(brands: FitmentBrand[], makeSlug: string): FitmentBrand | null {
  return brands.find((brand) => brand.slug === makeSlug) ?? null;
}

export function findFitmentModel(
  brand: FitmentBrand,
  modelSlug: string,
): FitmentModel | null {
  return brand.models.find((model) => model.modelSlug === modelSlug) ?? null;
}

export function filterModelVehicleIds(
  model: FitmentModel,
  options?: { fuel?: string | null; variant?: string | null },
): string[] {
  const fuel = options?.fuel ? normalizeSearchText(options.fuel) : "";
  const variant = options?.variant ? normalizeSearchText(options.variant) : "";
  return model.variants
    .filter((item) => {
      if (fuel && item.fuel !== fuel) return false;
      if (variant && normalizeSearchText(item.label) !== variant) return false;
      return true;
    })
    .map((item) => item.id);
}

/** False when matchVehiclesForQuery cannot succeed, so callers can skip a catalogue read. */
export function queryCouldMatchVehicleName(query: string): boolean {
  const normalized = normalizeSearchText(query);
  return Boolean(normalized) && !GENERIC_MODEL_TOKENS.has(normalized);
}

export function matchVehiclesForQuery(
  query: string,
  vehicles: VehicleRecord[],
): { vehicleIds: string[]; mode: "model" | "variant" } | null {
  const normalized = normalizeSearchText(query);
  if (!normalized || GENERIC_MODEL_TOKENS.has(normalized)) return null;

  const exactVariant = vehicles.filter(
    (vehicle) => normalizeSearchText(originalVehicleLabel(vehicle)) === normalized,
  );
  if (exactVariant.length) {
    return { vehicleIds: exactVariant.map((vehicle) => vehicle.id), mode: "variant" };
  }

  const makeModel = vehicles.filter(
    (vehicle) =>
      normalizeSearchText(`${vehicle.make} ${vehicle.model}`) === normalized,
  );
  if (makeModel.length) {
    return { vehicleIds: makeModel.map((vehicle) => vehicle.id), mode: "model" };
  }

  const grouped = groupVehiclesByBrand(vehicles);
  for (const brand of grouped) {
    for (const model of brand.models) {
      const modelKey = normalizeSearchText(model.model);
      const branded = normalizeSearchText(`${brand.make} ${model.model}`);
      if (normalized === modelKey || normalized === branded) {
        return {
          vehicleIds: model.variants.map((item) => item.id),
          mode: "model",
        };
      }

      for (const fuel of ["petrol", "diesel", "cng", "electric"] as const) {
        if (
          normalized === `${modelKey} ${fuel}` ||
          normalized === `${branded} ${fuel}`
        ) {
          const ids = filterModelVehicleIds(model, { fuel });
          if (ids.length) return { vehicleIds: ids, mode: "variant" };
        }
      }
    }
  }

  return null;
}
