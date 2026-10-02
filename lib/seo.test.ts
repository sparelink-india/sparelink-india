import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { canonicalPath, routeMetadata } from "./seo";

const REPO_ROOT = path.resolve(__dirname, "..");

function layoutSource(): string {
  return readFileSync(path.join(REPO_ROOT, "app", "layout.tsx"), "utf8");
}

/** The storefront routes that are allowed to appear in a search index. */
const INDEXABLE_ROUTES = [
  "app/(public)/page.tsx",
  "app/products/page.tsx",
  "app/about-us/page.tsx",
  "app/privacy-policy/page.tsx",
  "app/terms-and-conditions/page.tsx",
  "app/shipping-policy/page.tsx",
  "app/returns-refunds/page.tsx",
  "app/vehicle-fitment/page.tsx",
  "app/vehicle-fitment/[make]/page.tsx",
  "app/vehicle-fitment/[make]/[model]/page.tsx",
  "app/category/[...slug]/page.tsx",
];

/** Routes that only exist for a signed-in user, or are near-duplicate shells. */
const PRIVATE_ROUTES = [
  "app/account/page.tsx",
  "app/login/layout.tsx",
  "app/register/layout.tsx",
];

/**
 * Client-component pages cannot export `metadata`, so their title is supplied by
 * a route layout instead. Listing them here means a new public client page
 * added without one fails here rather than silently inheriting the fallback.
 */
const LAYOUT_METADATA = [
  "app/brands/layout.tsx",
  "app/offers/layout.tsx",
  "app/help-support/layout.tsx",
  "app/track-order/layout.tsx",
];

function routeSource(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, ...relative.split("/")), "utf8");
}

describe("per-route metadata exists at all", () => {
  /* The defect this file exists for: NO route exported metadata, so every URL
     on the site rendered the same <title>SpareLink India</title> and the same
     meta description. These assertions fail if a route is added back without
     metadata, which is the only way that regression could return unnoticed. */
  for (const route of [...INDEXABLE_ROUTES, ...PRIVATE_ROUTES, ...LAYOUT_METADATA]) {
    it(`${route} exports its own title`, () => {
      const src = routeSource(route);
      const hasExport =
        /export const metadata\s*=/.test(src) ||
        /export async function generateMetadata/.test(src);
      assert.ok(
        hasExport,
        `${route} exports no metadata, so it silently inherits the site-wide default`,
      );
    });
  }
});

describe("canonical path normalisation", () => {
  it("keeps the homepage as a single slash", () => {
    assert.equal(canonicalPath("/"), "/");
    assert.equal(canonicalPath(""), "/");
    assert.equal(canonicalPath("   "), "/");
  });

  it("normalises a route path to exactly one leading slash and no trailing slash", () => {
    assert.equal(canonicalPath("products"), "/products");
    assert.equal(canonicalPath("/products"), "/products");
    assert.equal(canonicalPath("/products/"), "/products");
    assert.equal(canonicalPath("  /products/  "), "/products");
    assert.equal(canonicalPath("//products//"), "/products");
  });

  it("preserves a nested path such as a vehicle model", () => {
    assert.equal(
      canonicalPath("/vehicle-fitment/mahindra/bolero"),
      "/vehicle-fitment/mahindra/bolero",
    );
  });
});

describe("routeMetadata", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  function withBase(value: string | undefined, run: () => void) {
    if (value === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = value;
    try {
      run();
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = original;
    }
  }

  it("emits an absolute canonical for the exact route", () => {
    withBase("https://sparelinkindia.com", () => {
      const meta = routeMetadata({
        path: "/products",
        title: "Auto Spare Parts Catalogue",
        description: "Browse the catalogue.",
      });
      assert.equal(meta.alternates?.canonical, "https://sparelinkindia.com/products");
      assert.equal(meta.title, "Auto Spare Parts Catalogue");
      assert.equal(meta.description, "Browse the catalogue.");
    });
  });

  it("points the homepage canonical at the bare origin, never a trailing slash path", () => {
    withBase("https://sparelinkindia.com", () => {
      const meta = routeMetadata({ path: "/", title: "Home", description: "Home." });
      assert.equal(meta.alternates?.canonical, "https://sparelinkindia.com");
    });
  });

  it("tolerates a trailing slash on the configured base URL", () => {
    withBase("https://sparelinkindia.com/", () => {
      const meta = routeMetadata({ path: "/brands", title: "Brands", description: "Brands." });
      assert.equal(meta.alternates?.canonical, "https://sparelinkindia.com/brands");
    });
  });

  /* Guessing a host would emit a canonical to the wrong origin, which tells a
     crawler to drop the page. Emitting none means "self-referencing", which is
     correct, so the omission is the correct trade when the host is unknown. */
  it("omits the canonical rather than guessing a host when the public URL is unknown", () => {
    withBase(undefined, () => {
      const meta = routeMetadata({
        path: "/products",
        title: "Auto Spare Parts Catalogue",
        description: "Browse the catalogue.",
      });
      assert.equal(meta.alternates, undefined);
    });
  });

  it("does not emit an empty canonical href when the public URL is unknown", () => {
    withBase("", () => {
      const meta = routeMetadata({ path: "/", title: "Home", description: "Home." });
      assert.equal(meta.alternates, undefined);
      assert.equal(
        Object.prototype.hasOwnProperty.call(meta, "alternates"),
        false,
        "an empty alternates would render <link rel=\"canonical\" href=\"\">",
      );
    });
  });

  it("keeps the OG title and description in step with the page title", () => {
    withBase("https://sparelinkindia.com", () => {
      const meta = routeMetadata({ path: "/cart", title: "Cart", description: "Your cart." });
      assert.equal(meta.openGraph?.title, "Cart");
      assert.equal(meta.openGraph?.description, "Your cart.");
      assert.equal(meta.twitter?.title, "Cart");
    });
  });

  it("marks a private route noindex only when asked", () => {
    withBase("https://sparelinkindia.com", () => {
      const priv = routeMetadata({
        path: "/account",
        title: "Your Account",
        description: "Account summary.",
        noIndex: true,
      });
      // `robots` is typed `string | Robots`, so narrow before reading `index`.
      assert.equal(typeof priv.robots, "object");
      assert.equal((priv.robots as { index?: boolean }).index, false);

      const pub = routeMetadata({
        path: "/products",
        title: "Catalogue",
        description: "Catalogue.",
      });
      assert.equal(pub.robots, undefined);
    });
  });
});

describe("the root layout no longer declares every page a duplicate of the homepage", () => {
  /* This is the regression that made the whole per-route work necessary. A
     site-wide `alternates: { canonical: "/" }` is inherited by every route, so
     it told crawlers that /products, /brands and /privacy-policy were all the
     homepage. Asserted on the source so it cannot come back silently. */
  it("declares no site-wide canonical", () => {
    const src = layoutSource();
    const offenders = src
      .split(/\r?\n/)
      .filter((line) => /^\s*canonical\s*:/.test(line));
    assert.deepEqual(
      offenders,
      [],
      `app/layout.tsx still sets a site-wide canonical: ${offenders.join(", ")}`,
    );
  });

  it("still keeps the layout's title template for routes without their own", () => {
    const src = layoutSource();
    assert.match(src, /template:\s*"%s \| SpareLink India"/);
  });
});