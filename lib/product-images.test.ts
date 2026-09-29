import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALLOWED_EXTENSIONS,
  ALLOWED_UPLOAD_CONTENT_TYPES,
  CATALOGUE_IMAGE_KEY_PREFIX,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_MAX_BULK_SELECTION,
  PRODUCT_IMAGE_MAX_PER_PAGE,
  catalogueImageObjectKey,
  catalogueImagePublicPathFor,
  deriveProductImageStatus,
  normaliseProductImageQuery,
  productImageStorageState,
  rejectBulkSelection,
  sanitizeCatalogueImageKey,
  validateProductImageUpload,
} from "./product-images";

describe("object keys are derived, never supplied", () => {
  it("derives the key from the SKU under the existing prefix", () => {
    assert.equal(
      catalogueImageObjectKey("5984", ".png"),
      `${CATALOGUE_IMAGE_KEY_PREFIX}5984.png`,
    );
    assert.equal(
      catalogueImageObjectKey("part-air-filter-001", ".webp"),
      `${CATALOGUE_IMAGE_KEY_PREFIX}part-air-filter-001.webp`,
    );
  });

  it("cannot escape the catalogue-images prefix, whatever the SKU looks like", () => {
    /* Every one of these is a traversal or an injection attempt.
       NOTE the sanitiser deliberately keeps `.`, because existing catalogue keys
       were built with it and changing it would orphan them. So `..` can survive
       inside the key. That is harmless: the real invariant is that the variable
       part is ONE flat segment with no separator in it, so there is nothing for
       `..` to escape from. Tested as that, not as a substring ban. */
    const hostile = [
      "../../../etc/passwd",
      "..%2f..%2fadmin",
      "a/b/c",
      "a\\b",
      "....//....//secret",
      "5984/../../../other-part",
      "\0evil",
      "café/../../x",
      "../../../catalogue-images/5984",
    ];
    for (const sku of hostile) {
      const key = catalogueImageObjectKey(sku, ".png");
      if (key === null) continue;
      assert.ok(
        key.startsWith(`${CATALOGUE_IMAGE_KEY_PREFIX}`),
        `${sku} must stay under the prefix`,
      );
      const variablePart = key.slice(CATALOGUE_IMAGE_KEY_PREFIX.length);
      assert.equal(
        variablePart.includes("/"),
        false,
        `${sku} must produce one flat segment, not a nested path`,
      );
      /* Whatever the key resolves to, it cannot name the bare root or climb. */
      assert.equal(
        key.split("/").every((seg) => seg !== ".."),
        true,
        `${sku} must not produce a real dot segment once split on /`,
      );
    }
  });

  it("serves exactly the path the object key implies", () => {
    /* If these ever diverge, an upload writes to a key the storefront never
       reads, which looks like a silent failure to an admin. */
    const key = catalogueImageObjectKey("5984", ".png")!;
    assert.equal(catalogueImagePublicPathFor("5984", ".png"), `/${key}`);
    assert.equal(
      catalogueImagePublicPathFor("5984", ".png"),
      "/catalogue-images/5984.png",
    );
  });

  it("refuses an extension the index cannot hold", () => {
    /* Case is normalised, so an upper-case extension IS accepted. */
    assert.equal(
      catalogueImageObjectKey("5984", ".PNG"),
      `${CATALOGUE_IMAGE_KEY_PREFIX}5984.png`,
    );
    for (const ext of [".gif", ".svg", ".exe", ".php", ""]) {
      assert.equal(catalogueImageObjectKey("5984", ext), null, `${ext} must be refused`);
    }
    assert.ok(ALLOWED_EXTENSIONS.has(".webp"));
  });

  it("sanitiser matches the shape the catalogue index already uses", () => {
    assert.equal(sanitizeCatalogueImageKey("M-648 air filter"), "M-648_air_filter");
    assert.equal(sanitizeCatalogueImageKey("12533"), "12533");
  });
});

describe("upload validation", () => {
  const base = { partId: "p1", sku: "5984", contentType: "image/png", byteLength: 1024 };

  it("accepts a supported image and returns the derived key", () => {
    const r = validateProductImageUpload(base);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.objectKey, "catalogue-images/5984.png");
    assert.equal(r.ok && r.value.ext, ".png");
  });

  it("rejects an unsupported content type", () => {
    for (const ct of ["application/pdf", "image/gif", "image/svg+xml", "text/html", "", null, 42]) {
      const r = validateProductImageUpload({ ...base, contentType: ct });
      assert.equal(r.ok, false, `${String(ct)} must be refused`);
      assert.match(r.ok === false ? r.error : "", /Unsupported image type/);
    }
  });

  it("rejects an oversized file", () => {
    const r = validateProductImageUpload({ ...base, byteLength: MAX_PRODUCT_IMAGE_BYTES + 1 });
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /larger than/);
  });

  it("rejects an empty or unreadable size", () => {
    for (const n of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1024", null, undefined]) {
      const r = validateProductImageUpload({ ...base, byteLength: n });
      assert.equal(r.ok, false, `${String(n)} must be refused`);
    }
  });

  it("checks type before size, so a huge non-image is not reported as too big", () => {
    const r = validateProductImageUpload({
      ...base,
      contentType: "video/mp4",
      byteLength: 500 * 1024 * 1024,
    });
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.error : "", /Unsupported image type/);
  });

  it("rejects a part with no usable image key", () => {
    for (const sku of ["", "   ", ".", "..", undefined as unknown as string]) {
      const r = validateProductImageUpload({ ...base, sku });
      assert.equal(r.ok, false, `${String(sku)} must be refused`);
    }
    assert.equal(validateProductImageUpload({ ...base, sku: "x".repeat(200) }).ok, false);
  });

  it("normalises the declared type so a mixed-case header still works", () => {
    const r = validateProductImageUpload({ ...base, contentType: "IMAGE/PNG" });
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.ext, ".png");
  });

  it("maps both jpeg spellings to the same extension", () => {
    assert.equal(ALLOWED_UPLOAD_CONTENT_TYPES.get("image/jpeg"), ".jpg");
    assert.equal(ALLOWED_UPLOAD_CONTENT_TYPES.get("image/jpg"), ".jpg");
  });
});

describe("there is no bulk image mutation", () => {
  it("refuses any multi-image request at the edge", () => {
    /* Zero is the limit, so this is not a tuned number. It exists so the
       refusal has a named, tested home rather than being an implicit absence. */
    assert.equal(PRODUCT_IMAGE_MAX_BULK_SELECTION, 0);
    assert.equal(rejectBulkSelection(1)?.ok, false);
    assert.equal(rejectBulkSelection(5000)?.ok, false);
    assert.match(rejectBulkSelection(100)?.error ?? "", /pipeline job/);
  });

  it("has no delete path to misuse", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/product-images.ts", "utf8"),
    );
    /* Check for a real import or call, not the word: the module's header
       mentions deleteObject precisely to explain why it is absent. */
    assert.equal(
      /import[^;]*deleteObject[^;]*from/.test(src),
      false,
      "product images must not import deleteObject",
    );
    assert.equal(/await\s+deleteObject\s*\(/.test(src), false, "no delete call");
    assert.equal(/truncate|DELETE FROM/i.test(src), false);
  });
});

describe("status derivation", () => {
  it("reports the three real states", () => {
    assert.equal(
      deriveProductImageStatus({ hasOriginal: true, hasThumb: true, hasMedium: true }),
      "original-and-derivatives",
    );
    assert.equal(
      deriveProductImageStatus({ hasOriginal: true, hasThumb: false, hasMedium: false }),
      "original-only",
    );
    assert.equal(
      deriveProductImageStatus({ hasOriginal: true, hasThumb: true, hasMedium: false }),
      "original-only",
    );
    assert.equal(
      deriveProductImageStatus({ hasOriginal: false, hasThumb: false, hasMedium: false }),
      "missing",
    );
  });

  it("never reports derivatives without an original", () => {
    assert.equal(
      deriveProductImageStatus({ hasOriginal: false, hasThumb: true, hasMedium: true }),
      "missing",
      "a derivative without its original is not a usable image",
    );
  });
});

describe("query bounds", () => {
  it("caps page size and page number", () => {
    assert.equal(normaliseProductImageQuery({ perPage: 5000 }).perPage, PRODUCT_IMAGE_MAX_PER_PAGE);
    assert.equal(normaliseProductImageQuery({ perPage: "60" }).perPage, 60);
    assert.equal(normaliseProductImageQuery({ page: 99999999 }).page, 5000);
    assert.equal(normaliseProductImageQuery({}).perPage, 24);
    assert.equal(normaliseProductImageQuery({}).page, 1);
  });

  it("ignores junk rather than passing it to a query", () => {
    const q = normaliseProductImageQuery({ q: "  M-648  ", brand: 12, page: "abc" });
    assert.equal(q.q, "M-648");
    assert.equal(q.brand, "");
    assert.equal(q.page, 1);
    assert.equal(normaliseProductImageQuery({ q: "x".repeat(500) }).q.length, 120);
  });
});

describe("storage configuration is reported honestly", () => {
  it("says upload is unavailable and names the variables", () => {
    const s = productImageStorageState(false, "https://assets.sparelinkindia.com");
    assert.equal(s.canUpload, false);
    assert.match(s.reason, /R2_ACCESS_KEY_ID/);
    assert.match(s.reason, /R2_SECRET_ACCESS_KEY/);
    assert.match(s.reason, /R2_BUCKET_NAME/);
    assert.match(s.reason, /remain fully browsable/);
    assert.equal(s.assetOrigin, "https://assets.sparelinkindia.com");
  });

  it("allows upload when configured, with no reason string attached", () => {
    assert.deepEqual(productImageStorageState(true, null), { canUpload: true });
  });
});

describe("held images are never special-cased for mutation", () => {
  it("has no knowledge of the held 5984/12533 pair", () => {
    /* They are held for post-launch review, which is a decision ABOUT those two
       images, not a rule in the tool. If this module ever hard-codes them, a
       later correction silently stops working for every other part too. */
    return import("node:fs").then((fs) => {
      const src = fs.readFileSync("lib/product-images.ts", "utf8");
      assert.equal(/5984/.test(src), false, "no hard-coded SKU exception");
      assert.equal(/12533/.test(src), false, "no hard-coded SKU exception");
    });
  });
});
