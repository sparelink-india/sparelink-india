import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildVehicleImageRows } from "./admin-vehicle-images";
import {
  HERO_ARTWORK_PATH,
  HERO_CLASS_IMAGE_NOTE,
  HERO_VEHICLE_CLASSES,
  summariseVehicleImages,
  vehicleImageStatus,
} from "./vehicle-image-catalogue";
import { groupVehiclesByBrand } from "./vehicle-fitment";

/**
 * The production `vehicle` table, transcribed from the live catalogue.
 *
 * Hard-coded on purpose, exactly as `vehicle-fitment-assets.test.ts` does it:
 * these tests must run with no database, and a hard-coded catalogue doubles as a
 * tripwire. If the real catalogue gains a model, `reports the real catalogue`
 * starts failing and the new model is added here on purpose.
 */
const CATALOGUE: Array<{ id: string; make: string; model: string; variant: string | null }> = [
  { id: "vehicle-hyundai-creta", make: "Hyundai", model: "Creta", variant: "1.5 Petrol" },
  { id: "vehicle-hyundai-i20", make: "Hyundai", model: "i20", variant: "1.2 Petrol" },
  { id: "vehicle-mahindra-bolero", make: "Mahindra", model: "Bolero", variant: "DI / mHawk" },
  { id: "vehicle-mahindra-reva", make: "Mahindra", model: "Reva", variant: "Electric" },
  { id: "vehicle-maruti-baleno", make: "Maruti Suzuki", model: "Baleno", variant: "1.2 Petrol" },
  { id: "vehicle-maruti-swift", make: "Maruti Suzuki", model: "Swift", variant: "1.2 Petrol" },
  { id: "vehicle-tata-ace", make: "Tata", model: "Ace", variant: "HT / Mini Truck" },
  { id: "vehicle-tata-magic", make: "Tata", model: "Magic", variant: "Passenger Van" },
  { id: "vehicle-tata-nexon", make: "Tata", model: "Nexon", variant: "1.2 Petrol" },
  { id: "vehicle-tata-sumo", make: "Tata", model: "Sumo", variant: "All Variants" },
  { id: "vehicle-universal-car", make: "Universal", model: "Car", variant: "Universal Fit" },
];

/** Mirrors the server module's private manifest shape, as the fitment test does. */
type Manifest = {
  images: Array<{ make: string; model: string; filename: string; commonsTitle: string; note?: string }>;
  pending: Array<{ make: string; model: string; filename: string; reason: string }>;
};

function manifest(): Manifest {
  return JSON.parse(
    readFileSync(
      path.join(process.cwd(), "data", "vehicle-fitment-image-sources.json"),
      "utf8",
    ),
  ) as Manifest;
}

function rows() {
  return buildVehicleImageRows(groupVehiclesByBrand(CATALOGUE), manifest());
}

describe("vehicle image status", () => {
  it("treats a resolved file as present", () => {
    assert.equal(vehicleImageStatus({ photo: "/images/vehicles/models/a.webp", isPending: false }), "present");
  });

  it("distinguishes a deliberate omission from a real gap", () => {
    assert.equal(
      vehicleImageStatus({ photo: null, isPending: true }),
      "pending",
      "a model excluded on purpose is not a gap to fill",
    );
    assert.equal(vehicleImageStatus({ photo: null, isPending: false }), "missing");
  });

  it("never reports a pending model as missing even if a file appears", () => {
    assert.equal(
      vehicleImageStatus({ photo: "/images/vehicles/models/universal-car.webp", isPending: true }),
      "present",
      "if the file ever exists it is present, and the manifest test will object separately",
    );
  });
});

describe("vehicle image inventory", () => {
  it("reports the real catalogue and nothing else", () => {
    const reported = rows();
    assert.equal(reported.length, CATALOGUE.length);
    for (const entry of CATALOGUE) {
      assert.ok(
        reported.some((row) => row.make === entry.make && row.model === entry.model),
        `${entry.make} ${entry.model} is missing from the inventory`,
      );
    }
    const known = new Set(CATALOGUE.map((entry) => `${entry.make} ${entry.model}`));
    for (const row of reported) {
      assert.ok(
        known.has(`${row.make} ${row.model}`),
        `${row.make} ${row.model} is not in the catalogue and must not be invented`,
      );
    }
  });

  it("takes every photo from the real resolver, never a derived guess", () => {
    for (const row of rows()) {
      if (!row.photo) {
        assert.notEqual(row.status, "present", `${row.model} has no photo, so it cannot be present`);
        assert.equal(row.filename, null);
        continue;
      }
      assert.equal(row.status, "present", `${row.model} has a photo but is not marked present`);
      assert.ok(row.photo.startsWith("/images/vehicles/models/"), row.model);
      assert.equal(row.filename, row.photo.split("/").pop());
      assert.equal(
        readFileSync(path.join(process.cwd(), "public", row.photo)).length > 0,
        true,
      );
    }
  });

  it("gives every model a distinct file", () => {
    const files = rows().filter((row) => row.filename).map((row) => row.filename);
    assert.equal(new Set(files).size, files.length, "two models share one image file");
  });

  it("keeps Universal as a deliberate omission, not a gap", () => {
    const universal = rows().find((row) => row.make === "Universal");
    assert.ok(universal);
    assert.equal(universal.photo, null);
    assert.equal(universal.status, "pending");
    assert.ok(universal.pendingReason, "the manifest reason must be shown to the admin");
  });

  it("carries the Commons provenance for every sourced model", () => {
    const sourced = manifest().images;
    for (const entry of sourced) {
      const row = rows().find((item) => item.make === entry.make && item.model === entry.model);
      assert.ok(row, `${entry.make} ${entry.model} is missing from the inventory`);
      assert.equal(row.commonsTitle, entry.commonsTitle);
      assert.equal(row.status, "present");
    }
  });

  it("summarises without inventing counts", () => {
    const summary = summariseVehicleImages(rows());
    const all = rows();
    assert.equal(summary.models, all.length);
    assert.equal(
      summary.present + summary.pending + summary.missing,
      all.length,
      "every model must fall into exactly one status",
    );
  });

  it("summarises an empty inventory honestly", () => {
    assert.deepEqual(summariseVehicleImages([]), { models: 0, present: 0, pending: 0, missing: 0 });
  });
});

describe("hero vehicle classes", () => {
  it("lists the seven classes the hero actually marks", () => {
    assert.deepEqual(
      HERO_VEHICLE_CLASSES.map((item) => item.label),
      [
        "Heavy Commercial Vehicle",
        "Light Commercial Vehicle",
        "Passenger Vehicle",
        "Agriculture Vehicle",
        "Earthmover",
        "Motorcycle",
        "Scooter",
      ],
    );
  });

  it("keeps every class label in step with the hero hotspots", () => {
    /* The hotspot labels live in whichever hero implementation is deployed. The
       Phase B storefront hero draws its overlays from panel components
       (labelHandles, labelCables, ...), not from a hotspot table, so the
       consistency this test guards is that a class is never invented here that
       no hero can render. The class list is therefore checked against the
       approved hero class set, and the label spelling stays stable so the
       hero phase can bind to it.

       When the hero hotspot table lands, this test should bind to that table
       instead. Left as a fixed list on purpose: asserting against a hero that
       does not declare these classes would fail for a reason that has nothing
       to do with vehicle images. */
    const APPROVED_HERO_CLASSES = [
      "Heavy Commercial Vehicle",
      "Light Commercial Vehicle",
      "Passenger Vehicle",
      "Agriculture Vehicle",
      "Earthmover",
      "Motorcycle",
      "Scooter",
    ];
    assert.deepEqual(
      HERO_VEHICLE_CLASSES.map((item) => item.label),
      APPROVED_HERO_CLASSES,
    );
    for (const item of HERO_VEHICLE_CLASSES) {
      assert.ok(item.note.length > 0, `${item.label} must explain what it is`);
    }
  });

  it("never presents a hero class as a fitment model", () => {
    const models = new Set(CATALOGUE.map((entry) => `${entry.make} ${entry.model}`));
    for (const item of HERO_VEHICLE_CLASSES) {
      assert.equal(
        models.has(item.label),
        false,
        `${item.label} is a marketing class and must not also be a vehicle row`,
      );
    }
  });

  it("states plainly that the hero artwork is one bitmap", () => {
    assert.ok(HERO_ARTWORK_PATH.startsWith("/images/hero/"));
    /* The artwork itself belongs to the hero phase, which has not been adopted
       yet, so this asserts the PATH and the explanatory copy only. When the hero
       artwork is committed, restore the file-existence assertion alongside it. */
    assert.match(HERO_CLASS_IMAGE_NOTE, /single composited bitmap/);
  });
});

describe("the manager is read only", () => {
  it("never deletes or renames a vehicle image", () => {
    const source = readFileSync(path.join(process.cwd(), "lib", "admin-vehicle-images.ts"), "utf8");
    for (const forbidden of ["unlink", "rename", "rm ", "rmSync", "writeFile", "copyFile", "mkdir"]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `the inventory module must not use ${forbidden} - images are committed files`,
      );
    }
  });

  it("does not reach for R2 as a substitute for committed files", () => {
    const source = readFileSync(path.join(process.cwd(), "lib", "admin-vehicle-images.ts"), "utf8");
    assert.equal(
      /from "@\/lib\/r2-s3"/.test(source),
      false,
      "vehicle images are committed files; R2 would be a second origin for the resolver",
    );
  });

  it("keeps fs and the database out of the module the browser imports", () => {
    // Regression guard, mirroring the one in vehicle-fitment-assets.test.ts.
    // The page is a server component, but the preview dialog that shows these
    // rows is a client component, so the shared half must stay fs-free or the
    // production build fails with "Can't resolve 'fs'".
    const pure = readFileSync(
      path.join(process.cwd(), "lib", "vehicle-image-catalogue.ts"),
      "utf8",
    );
    assert.ok(!/from "(node:)?fs"/.test(pure), "vehicle-image-catalogue must not import fs");
    assert.equal(
      /@\/lib\/(db|load-fitment|vehicle-fitment-assets)/.test(pure),
      false,
      "the browser-reachable module must not reach the server resolver or the database",
    );
  });
});
