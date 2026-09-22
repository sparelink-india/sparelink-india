import { eq, sql } from "drizzle-orm";

import { partVehicleCompatibility, vehicle } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { attachFitmentAssets } from "@/lib/vehicle-fitment-assets";
import { groupVehiclesByBrand, type FitmentBrand } from "@/lib/vehicle-fitment";

export async function loadFitmentCatalog(): Promise<{
  brands: FitmentBrand[];
  missingLogos: string[];
  missingPhotos: string[];
}> {
  const db = getDb();
  const rows = await db
    .select({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      partCount: sql<number>`count(distinct ${partVehicleCompatibility.partId})::int`,
    })
    .from(vehicle)
    .leftJoin(
      partVehicleCompatibility,
      eq(partVehicleCompatibility.vehicleId, vehicle.id),
    )
    .groupBy(vehicle.id, vehicle.make, vehicle.model, vehicle.variant);

  const brands = attachFitmentAssets(
    groupVehiclesByBrand(
      rows.map((row) => ({
        ...row,
        partCount: Number(row.partCount || 0),
      })),
    ),
  );

  return {
    brands,
    missingLogos: brands.filter((brand) => !brand.logo).map((brand) => brand.make),
    missingPhotos: brands.flatMap((brand) =>
      brand.models
        .filter((model) => !model.photo)
        .map((model) => `${brand.make} ${model.model}`),
    ),
  };
}
