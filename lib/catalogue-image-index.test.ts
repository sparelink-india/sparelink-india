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
});
