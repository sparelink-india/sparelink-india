import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { catalogueGalleryPublicPaths, catalogueImagePublicPath } from "./catalogue-image-index";
import { getCustomerCatalogueImageUrl } from "./source-catalogue";

const ORIGIN_KEY = "CATALOGUE_IMAGE_ORIGIN";
const previousOrigin = process.env[ORIGIN_KEY];

afterEach(() => {
  if (previousOrigin === undefined) {
    delete process.env[ORIGIN_KEY];
  } else {
    process.env[ORIGIN_KEY] = previousOrigin;
  }
});

describe("catalogue image urls", () => {
  it("does not emit a customer image url for an empty sku", () => {
    delete process.env[ORIGIN_KEY];
    assert.equal(getCustomerCatalogueImageUrl(""), null);
    assert.equal(getCustomerCatalogueImageUrl("   "), null);
  });

  it("points storefront images at the public static path when indexed", () => {
    delete process.env[ORIGIN_KEY];
    const url = getCustomerCatalogueImageUrl("101");
    if (!url) return;
    assert.equal(url, catalogueImagePublicPath("101"));
    assert.match(url, /^\/catalogue-images\/101\.(png|jpg|jpeg|webp|gif)$/);
    assert.doesNotMatch(url, /\/api\//);
  });

  it("maps an indexed sku to a public catalogue-images path", () => {
    delete process.env[ORIGIN_KEY];
    const publicPath = catalogueImagePublicPath("101");
    if (!publicPath) return;
    assert.match(publicPath, /^\/catalogue-images\/101\.(png|jpg|jpeg|webp|gif)$/);
  });

  it("returns extra numbered gallery files after the primary, without letter-suffix SKUs", () => {
    delete process.env[ORIGIN_KEY];
    const urls = catalogueGalleryPublicPaths("M-865");
    for (const url of urls) {
      assert.match(url, /^\/catalogue-images\/M-865(?:\.\d+|_\d+)?\.(png|jpg|jpeg|webp|gif)$/);
      assert.doesNotMatch(url, /M-865_A/i);
    }
    if (urls.length > 1) {
      assert.match(urls[0] || "", /\/catalogue-images\/M-865\./);
    }
  });

  it("prefixes CATALOGUE_IMAGE_ORIGIN without a double slash", () => {
    process.env[ORIGIN_KEY] = "https://assets.sparelinkindia.com/";
    const publicPath = catalogueImagePublicPath("101");
    if (!publicPath) return;
    assert.match(
      publicPath,
      /^https:\/\/assets\.sparelinkindia\.com\/catalogue-images\/101\.(png|jpg|jpeg|webp|gif)$/,
    );
    assert.doesNotMatch(publicPath, /com\/\//);
  });

  it("prefixes gallery paths when CATALOGUE_IMAGE_ORIGIN is set", () => {
    process.env[ORIGIN_KEY] = "https://assets.sparelinkindia.com";
    const urls = catalogueGalleryPublicPaths("M-865");
    assert.ok(urls.length >= 1);
    for (const url of urls) {
      assert.match(
        url,
        /^https:\/\/assets\.sparelinkindia\.com\/catalogue-images\/M-865(?:\.\d+|_\d+)?\.(png|jpg|jpeg|webp|gif)$/,
      );
      assert.doesNotMatch(url, /com\/\//);
    }
  });

  it("falls back M-644 A to indexed M-644 when M-644_A is absent", () => {
    delete process.env[ORIGIN_KEY];
    const path = catalogueImagePublicPath("M-644 A");
    assert.equal(path, catalogueImagePublicPath("M-644"));
    assert.match(path || "", /^\/catalogue-images\/M-644\.(png|jpg|jpeg|webp|gif)$/);
  });

  it("falls back M-845 J to indexed M-845 when M-845_J is absent", () => {
    delete process.env[ORIGIN_KEY];
    const path = catalogueImagePublicPath("M-845 J");
    assert.equal(path, catalogueImagePublicPath("M-845"));
    assert.match(path || "", /^\/catalogue-images\/M-845\.(png|jpg|jpeg|webp|gif)$/);
  });

  it("falls back compound M-650 / M-603 A to first token M-650", () => {
    delete process.env[ORIGIN_KEY];
    const path = catalogueImagePublicPath("M-650 / M-603 A");
    assert.equal(path, catalogueImagePublicPath("M-650"));
    assert.match(path || "", /^\/catalogue-images\/M-650\.(png|jpg|jpeg|webp|gif)$/);
  });

  it("prefers an exact letter-suffix key over stripping to the base", () => {
    delete process.env[ORIGIN_KEY];
    const exact = catalogueImagePublicPath("M-630 B");
    const base = catalogueImagePublicPath("M-630");
    assert.ok(exact);
    assert.match(exact || "", /\/catalogue-images\/M-630_B\./);
    if (base) {
      assert.notEqual(exact, base);
    }
  });

  it("does not invent a fallback when neither exact nor narrow keys exist", () => {
    delete process.env[ORIGIN_KEY];
    assert.equal(catalogueImagePublicPath("M-654"), null);
    assert.equal(catalogueImagePublicPath("M-611 Z"), null);
    assert.equal(catalogueImagePublicPath("NO-SUCH-SKU / OTHER"), null);
  });

  it("does not collapse glued L/R SKUs into a shared base key", () => {
    delete process.env[ORIGIN_KEY];
    const left = catalogueImagePublicPath("00110L");
    const right = catalogueImagePublicPath("00110R");
    assert.ok(left);
    assert.ok(right);
    assert.match(left || "", /\/catalogue-images\/00110L\./);
    assert.match(right || "", /\/catalogue-images\/00110R\./);
    assert.notEqual(left, right);
  });

  it("keeps M-865 / M-856 / M-848 galleries on their exact keys", () => {
    delete process.env[ORIGIN_KEY];
    const g865 = catalogueGalleryPublicPaths("M-865");
    const g856 = catalogueGalleryPublicPaths("M-856");
    const g848 = catalogueGalleryPublicPaths("M-848");
    assert.ok(g865.length >= 1);
    assert.ok(g856.length >= 1);
    assert.ok(g848.length >= 1);
    assert.match(g865[0] || "", /\/catalogue-images\/M-865\./);
    assert.match(g856[0] || "", /\/catalogue-images\/M-856\./);
    assert.match(g848[0] || "", /\/catalogue-images\/M-848\./);
    assert.doesNotMatch(g865.join(" "), /M-865_A/);
  });
});
