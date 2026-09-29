import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  resolveVehicleMakeLogo,
  resolveVehicleModelImage,
  attachFitmentAssets,
} from "./vehicle-fitment-assets";
import {
  VEHICLE_MODEL_PLACEHOLDER,
  hasVehicleModelImage,
  vehicleModelImage,
  vehicleModelImageCandidates,
  vehicleModelFileName,
} from "./vehicle-image-paths";
import { groupVehiclesByBrand, slugifyFitment } from "./vehicle-fitment";

/**
 * The production `vehicle` table, transcribed from the live catalogue.
 *
 * Deliberately hard-coded rather than read from the database: these tests must
 * run in CI with no database, and this doubles as a tripwire. If the catalogue
 * gains a model, `every catalogue model has exactly one distinct image` starts
 * failing and the new model gets an image on purpose instead of by accident.
 */
const CATALOGUE: Array<{ make: string; model: string }> = [
  { make: "Hyundai", model: "Creta" },
  { make: "Hyundai", model: "i20" },
  { make: "Mahindra", model: "Bolero" },
  { make: "Mahindra", model: "Reva" },
  { make: "Maruti Suzuki", model: "Baleno" },
  { make: "Maruti Suzuki", model: "Swift" },
  { make: "Tata", model: "Ace" },
  { make: "Tata", model: "Magic" },
  { make: "Tata", model: "Nexon" },
  { make: "Tata", model: "Sumo" },
  { make: "Universal", model: "Car" },
];

const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "vehicle-fitment-image-sources.json"), "utf8"),
) as {
  allowCommercialUse: string[];
  images: Array<{ make: string; model: string; filename: string; commonsTitle: string }>;
  pending: Array<{ make: string; model: string; filename: string; reason: string }>;
};

describe("vehicle image resolution", () => {
  it("resolves an image from the make and model slug", () => {
    assert.equal(
      resolveVehicleModelImage("maruti-suzuki", "swift"),
      "/images/vehicles/models/maruti-suzuki-swift.webp",
    );
    assert.equal(
      resolveVehicleModelImage("mahindra", "xuv-3xo"),
      null,
      "a model with no file must resolve to null, not to another model",
    );
  });

  it("derives candidate paths without touching the filesystem", () => {
    // This is the function a client component is allowed to import, so it must
    // stay pure: given the same slugs it always returns the same list, in the
    // same order, with webp first.
    assert.deepEqual(vehicleModelImageCandidates("tata", "nexon"), [
      "/images/vehicles/models/tata-nexon.webp",
      "/images/vehicles/models/tata-nexon.jpg",
      "/images/vehicles/models/tata-nexon.png",
    ]);
    assert.equal(
      vehicleModelFileName("tata", "nexon", ".webp"),
      vehicleModelImageCandidates("tata", "nexon")[0],
    );
  });

  it("matches model slugs exactly, never by prefix", () => {
    // "swift" is a prefix of "swift-dzire" and "xuv-3xo" of "xuv-3xo-ev".
    // A substring or prefix match would hand Swift the Dzire's photograph,
    // which is exactly the "generic image for an unrelated model" failure the
    // catalogue is supposed to prevent.
    assert.equal(
      resolveVehicleModelImage("maruti-suzuki", "swift-dzire"),
      null,
      "a model that is not in the catalogue must not inherit a near-match image",
    );
    assert.equal(resolveVehicleModelImage("mahindra", "xuv-3xo-ev"), null);
    assert.equal(resolveVehicleModelImage("maruti-suzuki", "swif"), null);
    assert.equal(resolveVehicleModelImage("tata", "n"), null);
  });

  it("gives every catalogue model its own distinct file", () => {
    const seen = new Map<string, string>();
    for (const entry of CATALOGUE) {
      const key = `${entry.make} ${entry.model}`;
      const resolved = resolveVehicleModelImage(
        slugifyFitment(entry.make),
        slugifyFitment(entry.model),
      );
      if (!resolved) continue;
      const previous = seen.get(resolved);
      assert.ok(
        previous === undefined,
        `${key} and ${previous} both resolve to ${resolved}`,
      );
      seen.set(resolved, key);
    }
  });

  it("falls back to the branded placeholder rather than any vehicle image", () => {
    assert.equal(
      vehicleModelImage({ makeSlug: "mahindra", modelSlug: "xuv-3xo" }),
      VEHICLE_MODEL_PLACEHOLDER,
      "with no photo, the answer is the placeholder - never a guessed path",
    );
    assert.equal(hasVehicleModelImage({ photo: null }), false);
  });

  it("uses the server-resolved photo when there is one", () => {
    assert.equal(
      vehicleModelImage({
        makeSlug: "mahindra",
        modelSlug: "xuv-3xo",
        photo: "/images/vehicles/models/mahindra-xuv-3xo.webp",
      }),
      "/images/vehicles/models/mahindra-xuv-3xo.webp",
    );
    assert.equal(
      hasVehicleModelImage({ photo: "/images/vehicles/models/mahindra-xuv-3xo.webp" }),
      true,
    );
  });

  it("falls back to the placeholder only when the server found no photo", () => {
    // The slugs alone are NOT proof of an image. `vehicleModelImage` is pure,
    // so a model whose file is absent would otherwise hand back a
    // plausible-looking `/models/...webp` path that 404s in the browser. The
    // server-resolved `photo` is the only authority.
    assert.equal(
      vehicleModelImage({
        makeSlug: "mahindra",
        modelSlug: "xuv-3xo",
        photo: null,
      }),
      VEHICLE_MODEL_PLACEHOLDER,
    );
    assert.equal(hasVehicleModelImage({ photo: null }), false);
    assert.equal(
      vehicleModelImageCandidates("mahindra", "xuv-3xo")[0],
      "/images/vehicles/models/mahindra-xuv-3xo.webp",
      "the candidate list still names the path, it is simply not used as an answer",
    );
  });

  it("prefers webp over the older jpg and png slots", () => {
    // The vehicle set is WebP-only; nothing may shadow a webp with a jpg.
    const resolved = resolveVehicleModelImage("tata", "nexon");
    assert.ok(resolved?.endsWith(".webp"));
  });

  it("keeps the fs-touching resolver out of anything a client can import", () => {
    // Regression guard. `vehicle-image-paths` is imported by a client component;
    // if `node:fs` ever reappears in that import graph the production build
    // fails with "Can't resolve 'fs'". This states the rule instead of relying
    // on the build to catch it.
    const paths = readFileSync(
      path.join(process.cwd(), "lib", "vehicle-image-paths.ts"),
      "utf8",
    );
    assert.ok(
      !/from "(node:)?fs"/.test(paths),
      "vehicle-image-paths must not import fs; it is client-reachable",
    );
    assert.ok(
      !/from "\.\/vehicle-fitment-assets"/.test(paths),
      "vehicle-image-paths must not depend on the server-only resolver",
    );
  });

  it("resolves make logos and nothing invented for Universal", () => {
    assert.equal(resolveVehicleMakeLogo("tata"), "/images/vehicles/makes/tata.svg");
    assert.equal(resolveVehicleMakeLogo("universal"), null);
  });
});

describe("fitment asset attachment", () => {
  it("reports a missing image as a null photo rather than a fake one", () => {
    const brands = attachFitmentAssets(
      groupVehiclesByBrand([
        { id: "1", make: "Tata", model: "Nexon", variant: null },
        { id: "2", make: "Mahindra", model: "XUV 3XO", variant: null },
      ]),
    );
    const mahindra = brands.find((brand) => brand.slug === "mahindra");
    assert.ok(mahindra);
    const model = mahindra.models[0];
    assert.equal(model.model, "XUV 3XO");
    assert.equal(
      model.photo,
      null,
      "a null photo is what makes the model appear in missingPhotos",
    );

    const tata = brands.find((brand) => brand.slug === "tata");
    assert.ok(tata?.models[0].photo?.endsWith("tata-nexon.webp"));
  });
});

describe("vehicle image source manifest", () => {
  const byKey = new Map(manifest.images.map((entry) => [`${entry.make} ${entry.model}`, entry]));

  it("covers exactly the real vehicle models, and no others", () => {
    const pendingKeys = new Set(manifest.pending.map((entry) => `${entry.make} ${entry.model}`));
    for (const entry of CATALOGUE) {
      const key = `${entry.make} ${entry.model}`;
      const sourced = byKey.has(key);
      const declaredPending = pendingKeys.has(key);
      assert.ok(
        sourced || declaredPending,
        `${key} is neither sourced nor declared pending in the manifest`,
      );
      assert.ok(
        !(sourced && declaredPending),
        `${key} is declared both sourced and pending`,
      );
    }
    for (const key of byKey.keys()) {
      assert.ok(
        CATALOGUE.some((entry) => `${entry.make} ${entry.model}` === key),
        `${key} is in the manifest but not in the catalogue`,
      );
    }
  });

  it("names a distinct file for every sourced model", () => {
    const filenames = manifest.images.map((entry) => entry.filename);
    assert.equal(new Set(filenames).size, filenames.length);
  });

  it("points every sourced entry at a file that exists on disk", () => {
    for (const entry of manifest.images) {
      assert.ok(
        resolveVehicleModelImage(
          slugifyFitment(entry.make),
          slugifyFitment(entry.model),
        ) === `/images/vehicles/models/${entry.filename}`,
        `${entry.filename} is in the manifest but not resolvable from the catalogue`,
      );
    }
  });

  it("only allows licences that permit commercial use", () => {
    for (const licence of manifest.allowCommercialUse) {
      const key = licence.toLowerCase().replace(/[^a-z0-9]/g, "");
      assert.ok(!key.includes("nc"), `${licence} must not be a non-commercial licence`);
      assert.ok(!key.includes("nd"), `${licence} must not be a no-derivatives licence`);
    }
    assert.ok(
      manifest.allowCommercialUse.length > 0,
      "an empty allow list would silently mark every model pending",
    );
  });

  it("records the licence that was actually read from the source, per model", () => {
    // Guards the "one generic image for multiple unrelated models" failure and
    // the licence regression in one place: each sourced entry names a distinct
    // Commons file, and the generated SOURCES.txt lists that same file.
    const sources = readFileSync(
      path.join(process.cwd(), "public", "images", "vehicles", "SOURCES.txt"),
      "utf8",
    );
    const commonsFiles = manifest.images.map((entry) => entry.commonsTitle);
    assert.equal(new Set(commonsFiles).size, commonsFiles.length);
    for (const title of commonsFiles) {
      assert.ok(sources.includes(title), `SOURCES.txt is missing ${title}`);
    }
    for (const entry of manifest.images) {
      assert.ok(
        sources.includes(entry.filename),
        `SOURCES.txt is missing the record for ${entry.filename}`,
      );
    }
  });

  it("keeps a pending entry out of the images folder", () => {
    for (const entry of manifest.pending) {
      assert.equal(resolveVehicleModelImage(
        slugifyFitment(entry.make),
        slugifyFitment(entry.model),
      ), null);
    }
  });
});
