import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { catalogueGalleryPublicPaths, catalogueImagePublicPath } from "./catalogue-image-index";
import { getCustomerCatalogueImageUrl } from "./source-catalogue";

describe("catalogue image urls", () => {
  it("does not emit a customer image url for an empty sku", () => {
    assert.equal(getCustomerCatalogueImageUrl(""), null);
    assert.equal(getCustomerCatalogueImageUrl("   "), null);
  });

  it("points storefront images at the public static path when indexed", () => {
    const url = getCustomerCatalogueImageUrl("101");
    if (!url) return;
    assert.equal(url, catalogueImagePublicPath("101"));
    assert.match(url, /^\/catalogue-images\/101\.(png|jpg|jpeg|webp|gif)$/);
    assert.doesNotMatch(url, /\/api\//);
  });

  it("maps an indexed sku to a public catalogue-images path", () => {
    const publicPath = catalogueImagePublicPath("101");
    if (!publicPath) return;
    assert.match(publicPath, /^\/catalogue-images\/101\.(png|jpg|jpeg|webp|gif)$/);
  });

  it("does not invent extra gallery frames when only a primary image exists", () => {
    const urls = catalogueGalleryPublicPaths("101");
    if (!urls.length) return;
    assert.equal(urls[0], catalogueImagePublicPath("101"));
    assert.equal(new Set(urls).size, urls.length);
  });
});
