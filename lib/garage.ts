import { slugifyFitment } from "@/lib/vehicle-fitment";

export type GarageVehicle = {
  id: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number | null;
  variant: string | null;
  registrationNumber: string | null;
  vin: string | null;
  isPrimary: boolean;
};

export function garageVehicleLabel(vehicle: Pick<GarageVehicle, "make" | "model" | "year" | "variant">) {
  const bits = [vehicle.make, vehicle.model];
  if (vehicle.variant) bits.push(vehicle.variant);
  if (vehicle.year) bits.push(String(vehicle.year));
  return bits.filter(Boolean).join(" · ");
}

export function garageFitmentHref(make: string, model?: string | null) {
  const makeSlug = slugifyFitment(make);
  if (!model?.trim()) return `/vehicle-fitment/${encodeURIComponent(makeSlug)}`;
  return `/vehicle-fitment/${encodeURIComponent(makeSlug)}/${encodeURIComponent(slugifyFitment(model))}`;
}
