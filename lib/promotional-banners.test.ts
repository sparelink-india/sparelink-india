import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bannerImageUrl, normaliseBannerDestination } from "./promotional-banners";

/**
 * The destination URL is authored by an admin and rendered as a customer-facing
 * `href`. It is therefore an injection sink, and these tests are the guard rail
 * that it stays one. The write path and the read path call the same function,
 * so a value that cannot get into the database is also a value that could not
 * get out of it if it somehow got there.
 */
describe("banner destination sanitising", () => {
  it("accepts site-relative paths and absolute http(s) URLs", () => {
    assert.equal(normaliseBannerDestination("/offers"), "/offers");
    assert.equal(
      normaliseBannerDestination("/category/filters"),
      "/category/filters",
    );
    assert.equal(
      normaliseBannerDestination("https://example.com/sale"),
      "https://example.com/sale",
    );
    assert.equal(
      normaliseBannerDestination("http://example.com/sale"),
      "http://example.com/sale",
    );
  });

  it("treats an absent or blank destination as no destination", () => {
    assert.equal(normaliseBannerDestination(""), null);
    assert.equal(normaliseBannerDestination("   "), null);
    assert.equal(normaliseBannerDestination(null), null);
    assert.equal(normaliseBannerDestination(undefined), null);
    assert.equal(normaliseBannerDestination(42), null);
    assert.equal(normaliseBannerDestination({ href: "/offers" }), null);
  });

  it("rejects script and data URLs", () => {
    assert.equal(normaliseBannerDestination("javascript:alert(1)"), null);
    assert.equal(
      normaliseBannerDestination("JavaScript:alert(document.cookie)"),
      null,
    );
    assert.equal(normaliseBannerDestination("data:text/html;base64,PHNjcmlwdD4="), null);
    assert.equal(normaliseBannerDestination("vbscript:msgbox(1)"), null);
    assert.equal(normaliseBannerDestination("file:///etc/passwd"), null);
  });

  it("rejects protocol-relative links that would resolve off-origin", () => {
    // "//evil.example" starts with "/" and would pass a naive startsWith check,
    // but it inherits the page's protocol and points at another host entirely.
    assert.equal(normaliseBannerDestination("//evil.example/phish"), null);
    assert.equal(normaliseBannerDestination("///evil.example"), null);
  });

  it("rejects control characters used to smuggle a new line", () => {
    assert.equal(normaliseBannerDestination("/offers\r\nSet-Cookie: a=b"), null);
    assert.equal(normaliseBannerDestination("/offers\n/x"), null);
  });
});

describe("banner image URL", () => {
  const original = process.env.R2_PUBLIC_BASE_URL;

  const withBase = (value: string | undefined, run: () => void) => {
    if (value === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = value;
    try {
      run();
    } finally {
      if (original === undefined) delete process.env.R2_PUBLIC_BASE_URL;
      else process.env.R2_PUBLIC_BASE_URL = original;
    }
  };

  it("joins the base and the key without doubling slashes", () => {
    withBase("https://cdn.example.com", () => {
      assert.equal(
        bannerImageUrl("banners/2026/03/a.webp"),
        "https://cdn.example.com/banners/2026/03/a.webp",
      );
    });
    withBase("https://cdn.example.com/", () => {
      assert.equal(
        bannerImageUrl("banners/a.webp"),
        "https://cdn.example.com/banners/a.webp",
      );
    });
    withBase("https://cdn.example.com", () => {
      assert.equal(bannerImageUrl("/banners/a.webp"), "https://cdn.example.com/banners/a.webp");
    });
  });

  it("returns null when the image host is not configured", () => {
    // A banner we cannot build an image URL for is dropped rather than rendered
    // as a broken image, so the carousel only ever receives usable slides.
    withBase(undefined, () => {
      assert.equal(bannerImageUrl("banners/a.webp"), null);
    });
    withBase("   ", () => {
      assert.equal(bannerImageUrl("banners/a.webp"), null);
    });
    withBase("https://cdn.example.com", () => {
      assert.equal(bannerImageUrl(""), null);
    });
  });
});
