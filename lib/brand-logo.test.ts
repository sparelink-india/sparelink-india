import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getBrandLogo } from "./brand-logo";
import { PUBLIC_BRANDS } from "./public-brands";

describe("brand logo mapping", () => {
  it("uses the same assets as the Brands section", () => {
    const meko = PUBLIC_BRANDS.find((brand) => brand.id === "meko");
    const star = PUBLIC_BRANDS.find((brand) => brand.id === "starlinks");
    assert.equal(getBrandLogo("MEKO"), meko?.logo);
    assert.equal(getBrandLogo("STARLINKS"), star?.logo);
    assert.equal(getBrandLogo("CI AUTOMOTIVE LLP"), "/images/brands/01.png");
    assert.equal(getBrandLogo("Pensol"), "/images/brands/pensol.png");
    assert.equal(getBrandLogo("Menon Brakes"), "/images/brands/menon-brakes.png");
  });

  it("falls back to null instead of inventing a logo", () => {
    assert.equal(getBrandLogo(null), null);
    assert.equal(getBrandLogo("Unknown Factory Brand"), null);
  });
});
