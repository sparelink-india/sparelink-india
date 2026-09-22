import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupVehiclesByBrand,
  matchVehiclesForQuery,
  parseFitmentFuel,
  slugifyFitment,
} from "./vehicle-fitment";

describe("vehicle fitment grouping", () => {
  it("groups Creta variants under Hyundai / Creta", () => {
    const brands = groupVehiclesByBrand([
      {
        id: "vehicle-hyundai-creta",
        make: "Hyundai",
        model: "Creta",
        variant: "1.5 Petrol",
        partCount: 4,
      },
      {
        id: "vehicle-hyundai-creta-d",
        make: "Hyundai",
        model: "Creta",
        variant: "1.5 Diesel",
        partCount: 2,
      },
      {
        id: "vehicle-hyundai-i20",
        make: "Hyundai",
        model: "i20",
        variant: "1.2 Petrol",
        partCount: 1,
      },
    ]);

    assert.equal(brands.length, 1);
    assert.equal(brands[0].make, "Hyundai");
    assert.equal(brands[0].models.length, 2);
    const creta = brands[0].models.find((model) => model.model === "Creta");
    assert.ok(creta);
    assert.equal(creta.variants.length, 2);
    assert.equal(creta.partCount, 6);
    assert.deepEqual(
      creta.variants.map((item) => item.fuel).sort(),
      ["diesel", "petrol"],
    );
  });

  it("slugifies manufacturer names", () => {
    assert.equal(slugifyFitment("Maruti Suzuki"), "maruti-suzuki");
    assert.equal(slugifyFitment("i20"), "i20");
  });

  it("parses fuel from variant text", () => {
    assert.equal(parseFitmentFuel("1.5 Petrol"), "petrol");
    assert.equal(parseFitmentFuel("DI / mHawk"), null);
    assert.equal(parseFitmentFuel("Electric"), "electric");
  });

  it("matches Creta as a model query and the full variant as variant query", () => {
    const vehicles = [
      {
        id: "vehicle-hyundai-creta",
        make: "Hyundai",
        model: "Creta",
        variant: "1.5 Petrol",
      },
    ];
    const model = matchVehiclesForQuery("Creta", vehicles);
    assert.equal(model?.mode, "model");
    assert.deepEqual(model?.vehicleIds, ["vehicle-hyundai-creta"]);
    const variant = matchVehiclesForQuery("Hyundai Creta 1.5 Petrol", vehicles);
    assert.equal(variant?.mode, "variant");
    assert.deepEqual(variant?.vehicleIds, ["vehicle-hyundai-creta"]);
  });
});
