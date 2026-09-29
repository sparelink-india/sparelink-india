import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { HERO_COLLECTION_SLOTS } from "./hero-collections";
import { PUBLIC_BRANDS } from "./public-brands";
import { WATER_PUMP_SEGMENTS } from "./category-navigation";

const ROOT = process.cwd();
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");

/** Pull the MODULES array out of the landing page and parse its entries. */
function moduleEntries(): { id: string; status: string; href?: string; title: string }[] {
  const src = read("app/admin/editing/page.tsx");
  const start = src.indexOf("const MODULES: readonly Module[] = [");
  assert.ok(start >= 0, "the module table must exist");
  const end = src.indexOf("\n];", start);
  const body = src.slice(start, end);
  const entries: { id: string; status: string; href?: string; title: string }[] = [];
  const re =
    /id:\s*"([^"]+)",\s*title:\s*"([^"]+)",[\s\S]*?status:\s*"([^"]+)"(?:,\s*href:\s*"([^"]+)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    entries.push({ id: m[1], title: m[2], status: m[3], href: m[4] });
  }
  return entries;
}

describe("the Editing Studio lists all ten approved modules", () => {
  const entries = moduleEntries();

  it("has exactly the ten the brief names, in order", () => {
    assert.deepEqual(
      entries.map((e) => e.id),
      [
        "hero-homepage",
        "vehicle-images",
        "hero-vehicle-collections",
        "vehicle-compatibility",
        "product-images",
        "product-information",
        "categories",
        "brands",
        "promotional-banners",
        "homepage-content",
      ],
    );
  });

  it("has no duplicate ids", () => {
    /* A duplicate is invisible at render: React drops the second card and the
       grid quietly shows one fewer module than the table claims. This table had
       exactly that bug, with Hero Vehicle Collections listed twice. */
    const ids = entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, "module ids must be unique");
  });

  it("fails loudly at load if an id is ever duplicated again", () => {
    const src = read("app/admin/editing/page.tsx");
    assert.ok(
      /DUPLICATE_MODULE_IDS/.test(src) && /must be unique/.test(src),
      "there must be a startup assertion, not just a convention",
    );
  });
});

describe("no card points at a route that does not exist", () => {
  const entries = moduleEntries();

  /**
   * Resolve an app-router href to a file on disk.
   *
   * UNDER `app/`, WHICH THE FIRST VERSION FORGOT. An href of
   * `/admin/editing/hero-collections` becomes
   * `app/admin/editing/hero-collections/page.tsx`, not
   * `<root>/admin/editing/hero-collections/page.tsx`. Dropping the `app/`
   * segment makes every route look missing, so the check silently reported all
   * nine live cards as dead — and a dead-link assertion that always fails is
   * worse than none, because it reads as a real problem.
   */
  function pageExists(href: string): boolean {
    const rel = href.replace(/^\//, "").replace(/\/$/, "");
    const dir = path.join(ROOT, "app", rel);
    return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "page.ts"));
  }

  it("every available or external card points at a real page", () => {
    for (const entry of entries) {
      if (entry.status === "planned") continue;
      assert.ok(entry.href, `${entry.id} is marked ${entry.status} but has no href`);
      assert.ok(
        pageExists(entry.href!),
        `${entry.id} points at ${entry.href}, which has no page`,
      );
    }
  });

  it("no planned card is a link, because a link would 404", () => {
    for (const entry of entries) {
      if (entry.status !== "planned") continue;
      assert.equal(
        entry.href,
        undefined,
        `${entry.id} is planned and must not carry a destination`,
      );
    }
  });

  it("status never claims a screen that is not there", () => {
    const live = new Set(
      entries.filter((e) => e.status !== "planned").map((e) => e.href),
    );
    for (const href of live) {
      assert.ok(href && pageExists(href), `${href} is dead`);
    }
  });

  it("a hero-collections page really does exist on disk", () => {
    /* Guards the checker itself. If pageExists ever returned true for a missing
       route, every dead-link assertion above would pass vacuously. */
    assert.ok(existsSync(path.join(ROOT, "app/admin/editing/hero-collections/page.tsx")));
    assert.equal(pageExists("/admin/editing/definitely-not-a-real-route"), false);
  });
});

describe("the ten modules report their real state", () => {
  const entries = moduleEntries();
  const status = (id: string) => entries.find((e) => e.id === id)?.status;

  it("marks the five modules that shipped in this run as available", () => {
    for (const id of [
      "hero-vehicle-collections",
      "product-images",
      "product-information",
      "categories",
      "brands",
      "homepage-content",
    ]) {
      assert.equal(status(id), "available", `${id} shipped and must say so`);
    }
  });

  it("points Promotional Banners at the existing editor rather than duplicating it", () => {
    const banners = entries.find((e) => e.id === "promotional-banners")!;
    assert.equal(banners.status, "external");
    assert.equal(banners.href, "/admin/banners");
  });

  it("keeps the two genuinely unbuilt modules marked planned", () => {
    /* A hero artwork editor does not exist, and neither does a vehicle-images
       screen. Saying so is the honest answer; a card that pretends otherwise
       trains an admin to distrust the whole index. */
    assert.equal(status("hero-homepage"), "planned");
    assert.equal(status("vehicle-images"), "planned");
  });
});

describe("the homepage panel reports real state and duplicates no editor", () => {
  const src = read("app/admin/editing/homepage/page.tsx");

  it("reads the hero artwork from the filesystem", () => {
    assert.ok(/heroArtworkExists/.test(src), "must check the real file");
    assert.ok(
      existsSync(path.join(ROOT, "public/images/hero/hero-final-reference.png")),
      "the deployed hero artwork is present",
    );
  });

  it("takes its brand and slot counts from the real registries", () => {
    assert.ok(/PUBLIC_BRANDS\.length/.test(src), "brand count must be real");
    assert.ok(/HERO_COLLECTION_SLOTS\.length/.test(src), "slot count must be real");
  });

  it("has no mutation: it is a control panel, not a second CMS", () => {
    for (const forbidden of [
      "fetch(",
      "method: \"POST\"",
      "method: \"PATCH\"",
      "method: \"DELETE\"",
      "writeAuditLog",
      "requireAdminApi",
    ]) {
      assert.equal(src.includes(forbidden), false, `homepage panel must not contain ${forbidden}`);
    }
  });

  it("links to the owning module for every editable block", () => {
    for (const href of [
      "/admin/banners",
      "/admin/editing/hero-collections",
      "/admin/editing/brands",
      "/admin/editing/categories",
    ]) {
      assert.ok(src.includes(href), `must link to ${href}, which owns that block`);
    }
  });
});

describe("preserved systems the homepage panel reports on are intact", () => {
  it("the hero still has 15 anchors", () => {
    const hero = read("components/home-hero.tsx");
    const vehicles = (hero.match(/kind: "vehicle"/g) ?? []).length;
    const parts = (hero.match(/kind: "part"/g) ?? []).length;
    const ctas = (hero.match(/kind: "cta"/g) ?? []).length;
    /* The type declaration also contains the literal `kind: "vehicle" | "part"
       | "cta"`, so subtract that one occurrence from each count. */
    assert.equal(vehicles - 1, 8, "8 vehicle hotspots");
    assert.equal(parts, 5, "5 product hotspots");
    assert.equal(ctas, 2, "2 CTA anchors");
  });

  it("the eight hero collection slots still match the approved list", () => {
    assert.equal(HERO_COLLECTION_SLOTS.length, 8);
    assert.ok(HERO_COLLECTION_SLOTS.includes("passenger-red-suv"));
    assert.ok(HERO_COLLECTION_SLOTS.includes("passenger-white-saloon"));
  });

  it("the nine approved brands are unchanged", () => {
    assert.equal(PUBLIC_BRANDS.length, 9);
    assert.deepEqual(
      PUBLIC_BRANDS.map((b) => b.name),
      [
        "CI Automotive",
        "MEKO",
        "STARLINKS",
        "ONE",
        "Pensol",
        "Super Seal",
        "Menon Brakes",
        "Shivaji Industries / Sippy",
        "Akar",
      ],
    );
  });

  it("the water pump segments are untouched", () => {
    assert.deepEqual(
      WATER_PUMP_SEGMENTS.map((s) => s.id),
      ["heavy-commercial-vehicle", "passenger-vehicle", "agriculture", "earthmover"],
    );
  });
});
