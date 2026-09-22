import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProductSpecCards,
  collectCompatibility,
  displayProductTitle,
  excludeKnownIds,
  extractSpecificationEntries,
  isGenuine360Sequence,
  shouldShowDescription,
  uniqueNonEmpty,
} from "./product-detail-fields";

describe("product detail fields", () => {
  it("does not append the part number onto the title when it has its own field", () => {
    assert.equal(
      displayProductTitle(
        "SWARAJ 855 XM L / M FLANGE TYPE HEAVY DUTY TRACTOR (M-865)",
        "M-865",
      ),
      "SWARAJ 855 XM L / M FLANGE TYPE HEAVY DUTY TRACTOR",
    );
  });

  it("deduplicates exact values and known ids", () => {
    assert.deepEqual(uniqueNonEmpty(["M-865", "m-865", " ", "P713040"]), ["M-865", "P713040"]);
    assert.deepEqual(excludeKnownIds(["M-865", "P713040"], "M-865"), ["P713040"]);
  });

  it("hides a description that only repeats the title/part number", () => {
    assert.equal(shouldShowDescription("Pump (M-865)", "Pump", "M-865"), false);
    assert.equal(shouldShowDescription("Official MEKO website listing", "Pump", "M-865"), true);
    assert.equal(
      shouldShowDescription(
        "MEKO official website | Automotive Water Pump Assemblies | Pump | Ref. Nos. P713040 A | https://mekoautoindia.com/product/m-865",
        "Pump",
        "M-865",
      ),
      false,
    );
  });

  it("omits empty spec cards and duplicate part numbers as OEM", () => {
    const cards = buildProductSpecCards({
      partNumber: "M-865",
      brand: "MEKO",
      category: "Automotive Water Pump Assemblies",
      oemNumber: "M-865",
      references: ["M-865", "P713040 A"],
      vehicles: ["Swaraj 855"],
    });
    assert.deepEqual(
      cards.map((card) => card.label),
      ["Part No.", "Brand", "Category", "Compatible With", "Reference Nos."],
    );
    assert.equal(cards.find((card) => card.label === "Part No.")?.value, "M-865");
    assert.equal(cards.find((card) => card.label === "Reference Nos.")?.value, "P713040 A");
  });

  it("does not repeat OEM values in the reference card", () => {
    const cards = buildProductSpecCards({
      partNumber: "M-856",
      oemNumber: "2525 2010 0116 · 2525 2010 0121",
      references: ["2525 2010 0116", "2525 2010 0121"],
      hideBrand: true,
      hideCategory: true,
    });
    assert.deepEqual(
      cards.map((card) => card.label),
      ["Part No.", "OEM Part No."],
    );
    assert.equal(
      cards.find((card) => card.label === "OEM Part No.")?.value,
      "2525 2010 0116 · 2525 2010 0121",
    );
  });

  it("omits brand and category cards when those are shown as logo/subtitle", () => {
    const cards = buildProductSpecCards({
      partNumber: "M-865",
      brand: "MEKO",
      category: "Water Pump Assemblies",
      hideBrand: true,
      hideCategory: true,
    });
    assert.deepEqual(
      cards.map((card) => card.label),
      ["Part No."],
    );
  });

  it("only treats a genuine ordered 360 frame set as 360-capable", () => {
    assert.equal(isGenuine360Sequence(["a"]), false);
    assert.equal(isGenuine360Sequence(Array.from({ length: 5 }, (_, i) => String(i))), false);
    assert.equal(
      isGenuine360Sequence(["/catalogue-images/M-865.png", "/catalogue-images/M-865.2.png"]),
      false,
    );
    assert.equal(
      isGenuine360Sequence(
        Array.from({ length: 8 }, (_, i) => `/catalogue-images/M-865.${i + 1}.png`),
      ),
      false,
    );
    assert.equal(
      isGenuine360Sequence(
        Array.from(
          { length: 12 },
          (_, i) => `/catalogue-images/pump_360_${String(i + 1).padStart(2, "0")}.jpg`,
        ),
      ),
      true,
    );
  });

  it("surfaces compatibility from vehicle and spec fields without repeating the title", () => {
    assert.deepEqual(
      collectCompatibility({
        vehicles: ["Swaraj 855 XM"],
        vehicleBrands: ["swaraj ace tractor"],
        vehicleTypes: ["Tractors"],
        compatibleWith:
          "SWARAJ 855 XM L / M FLANGE TYPE HEAVY DUTY TRACTOR (PULLEY WITH 4 HOLES, P.C.D.: 55 MM; FAN MTG. DIA : 40 MM)",
        title:
          "SWARAJ 855 XM L / M FLANGE TYPE HEAVY DUTY TRACTOR (PULLEY WITH 4 HOLES, P.C.D.: 55 MM; FAN MTG. DIA : 40 MM)",
        partNumber: "M-865",
      }),
      ["Swaraj 855 XM", "swaraj ace tractor", "Tractors"],
    );
  });

  it("extracts only real specification fields and skips catalogue metadata", () => {
    const specs = extractSpecificationEntries({
      source_url: "https://mekoautoindia.com/product/m-865",
      gallery_images: ["M-865.png"],
      type: "Flange Mounting",
      pcd: "55 mm",
      compatible_with: "Swaraj 855",
    });
    assert.deepEqual(specs, [
      { label: "Type", value: "Flange Mounting" },
      { label: "P.C.D.", value: "55 mm" },
    ]);
    assert.equal(
      extractSpecificationEntries({
        internal_import_key: "MEKO-M-865",
        source_rate: "375",
      }).length,
      0,
    );
  });
});
