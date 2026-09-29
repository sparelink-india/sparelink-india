import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { HERO_COLLECTION_SLOTS, heroCollectionHref } from "./hero-collections";
import type { HeroCollectionSlot } from "./hero-collections";

const read = (f: string) => readFileSync(f, "utf8");
const hero = () => read("components/home-hero.tsx");

describe("the hero wires its eight vehicle dots to the real slot list", () => {
  it("every vehicle hotspot names a slot, and the slots are the eight approved", () => {
    const src = hero();
    const rows = src.match(/\{\s*kind:\s*"vehicle"[\s\S]*?\}/g) ?? [];
    assert.equal(rows.length, 8);
    for (const row of rows) {
      assert.ok(/slot:\s*"[a-z-]+"/.test(row), `vehicle hotspot missing a slot: ${row.slice(0, 70)}`);
    }
    for (const slot of HERO_COLLECTION_SLOTS) {
      assert.ok(src.includes(`slot: "${slot}"`), `${slot} must be wired to a hotspot`);
    }
  });

  it("the two passenger hotspots use two different slots", () => {
    /* The red SUV and the white saloon are separate artwork, so they get
       separate curated sets. Reusing one slot would make the second dot's
       curation unreachable. */
    const src = hero();
    assert.ok(src.includes('slot: "passenger-red-suv"'));
    assert.ok(src.includes('slot: "passenger-white-saloon"'));
  });

  it("resolves hrefs through the tested fallback rule, not inline logic", () => {
    assert.ok(
      /heroCollectionHref\(target\.slot, counts, enabled\)/.test(hero()),
      "the fallback rule must come from the tested function",
    );
  });

  it("the 15-anchor contract is unchanged", () => {
    const src = hero();
    const rows = src.match(/\{\s*kind:\s*"(vehicle|part|cta)"[\s\S]*?\}/g) ?? [];
    assert.equal(rows.length, 15, "5 product, 8 vehicle, 2 CTA");
    assert.equal((src.match(/kind: "part"/g) ?? []).length, 5);
    assert.equal((src.match(/kind: "cta"/g) ?? []).length, 2);
  });
});

describe("the hero stays non-interactive except on its anchors", () => {
  it("the image and the overlay ignore pointer events, anchors do not", () => {
    const src = hero();
    assert.ok(/pointer-events-none/.test(src), "image must not swallow hits");
    assert.ok(/pointer-events-auto/.test(src), "anchors must be clickable");
  });

  it("uses the approved artwork and no native title attribute", () => {
    assert.ok(hero().includes("hero-final-reference.png"));
    assert.equal(/\stitle=["{]/.test(hero()), false, "no native title; aria-label only");
  });
});

describe("slot availability is resolved on the server", () => {
  it("the hero component takes a plain prop, not a database read", () => {
    /* The hero renders inside a client component, so it cannot read the
       database. Fetching from the browser would put the fallback decision behind
       a round-trip that can fail visibly. */
    const src = hero();
    assert.ok(/getDb|drizzle-orm|readHeroSlotAvailability/.test(src) === false);
    assert.ok(/availability\?: HeroSlotAvailability/.test(src));
  });

  it("an absent prop falls back to fitment rather than producing dead links", () => {
    const emptyCounts = new Map<HeroCollectionSlot, number>();
    const emptyEnabled = new Set<HeroCollectionSlot>();
    for (const slot of HERO_COLLECTION_SLOTS) {
      assert.equal(
        heroCollectionHref(slot, emptyCounts, emptyEnabled),
        "/vehicle-fitment",
        `${slot} must fall back when availability is unknown`,
      );
    }
  });

  it("the server page resolves it alongside banners", () => {
    const page = read("app/(public)/page.tsx");
    assert.ok(page.includes("readHeroSlotAvailability"), "resolved on the server");
    assert.ok(page.includes("heroSlots={heroSlots}"), "passed down to the client tree");
  });

  it("the reader degrades instead of throwing", () => {
    /* A database problem must not be able to break the homepage's eight dots. */
    const reader = read("lib/hero-slot-availability.ts");
    assert.ok(/catch/.test(reader), "must have a failure path");
    assert.ok(/return undefined/.test(reader), "failure resolves to no collections");
  });

  it("the reader never touches vehicle compatibility", () => {
    /* A curated set is a merchandising decision. Reading fitment here would
       blur the two systems this project deliberately kept apart. */
    assert.equal(
      /partVehicleCompatibility/.test(read("lib/hero-slot-availability.ts")),
      false,
    );
  });
});

describe("an enabled, curated slot routes to its collection", () => {
  it("does so only when the count is positive", () => {
    const counts = new Map<HeroCollectionSlot, number>([["earthmover", 4]]);
    const enabled = new Set<HeroCollectionSlot>(["earthmover"]);
    assert.equal(heroCollectionHref("earthmover", counts, enabled), "/hero/earthmover");

    counts.set("earthmover", 0);
    assert.equal(heroCollectionHref("earthmover", counts, enabled), "/vehicle-fitment");
  });
});
