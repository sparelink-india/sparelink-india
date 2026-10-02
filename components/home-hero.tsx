import Image from "next/image";
import Link from "next/link";
import { HERO_COLLECTION_SLOTS, heroCollectionHref } from "@/lib/hero-collections";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * V3 hero - final approved artwork with the interaction layer.
 *
 * THE ARTWORK
 * -----------
 * `public/images/hero/hero-final-reference.png`, 2158x729 (aspect 2.960),
 * rendered as one composite bitmap and never reconstructed from parts. It bakes
 * in its own left column (burgundy rule, "AUTO SPARE PARTS", the two headline
 * lines, the supporting sentence) AND its own two CTA buttons, plus nine
 * circular marker dots over the vehicles. None of that is redrawn in HTML -
 * doing so would print the text twice. The visible headline is preserved for
 * assistive technology with one `sr-only` heading.
 *
 * It is `object-contain` inside a container locked to the native ratio, and
 * `max-w-[1600px]`, so the bitmap is never upscaled past a 0.74x downscale and
 * never cropped. `object-cover` is deliberately not used: the vehicles and the
 * Pensol range sit close to both edges, so a cover-crop would slice a wheel or
 * a bottle.
 *
 * WHY THE MARKER DOTS WERE INERT
 * ------------------------------
 * The nine dots in the artwork are the vehicle interaction points, and each one
 * now has a real anchor over it. The dot centres below were NOT eyeballed: the
 * 2158x729 PNG was decoded in Node and the dots were found by ring template
 * matching (a bright annulus with a dark core, scored as
 * mean(ring luminance) - mean(core luminance)) with non-maximum suppression over
 * the vehicle band only. The strongest score was 189; the accepted set sits
 * above 153. Two candidates scoring 170.8 and 166.2 were rejected after
 * cropping and inspecting them - both were false positives on the cream
 * background beside the baked headline, not markers. Every accepted centre was
 * then re-confirmed on a contact sheet with a crosshair drawn through it, and
 * the eight vehicles were identified by eye from those crops.
 *
 * The white saloon carries TWO dots (1593,337 and 1619,367); one target spans
 * both so the whole car is live rather than leaving a dead dot on screen.
 *
 * VEHICLE DESTINATIONS
 * --------------------
 * Every vehicle dot goes to `/vehicle-fitment`, which is the real, existing
 * vehicle browsing experience. This application has no vehicle-class parts
 * taxonomy: the only vehicle-class slugs that resolve
 * (heavy-commercial-vehicle, passenger-vehicle, agriculture, earthmover) are
 * water-pump segments, and they are either empty (heavy commercial returns 0
 * products) or an accidental `nameContains` text match. The scooter
 * specifically has no destination at all, and `/category/agriculture` resolves
 * to a text search that really matches "Agriculture & Tractor Oils".
 *
 * `/vehicle-fitment` (the index) reads NO searchParams, so these links are bare
 * paths. No query parameters were invented. The `aria-label`s still describe the
 * vehicle class so assistive tech gets the right name; the destination is the
 * fitment browser until a real vehicle-class taxonomy exists.
 *
 * THE CLICK LAYER
 * ---------------
 * The bitmap is decorative chrome and must never take a click, so it is
 * `pointer-events-none`. All targets live in ONE dedicated overlay layer
 * (`absolute inset-0 z-20 pointer-events-none`) above the image, and each anchor
 * opts back in with `pointer-events-auto`. The artwork wrapper carries
 * `isolate` so the hero owns a clean stacking context and cannot interleave
 * with the sticky header or the All-Categories panel.
 *
 * The layer, not the anchors, carries the `hidden md:block` display gate. If
 * `display` were declared on the anchors as well - once in the base layer and
 * once as `hidden` - the winner would depend on the order the two utilities are
 * emitted in the stylesheet rather than the order they appear in the class
 * string. Gating display on the single wrapper removes that ambiguity.
 *
 * There is no visible chrome anywhere: no background, border, shadow, label,
 * arrow, tooltip, dot or card. The only decoration is a `focus-visible` outline,
 * which is not rendered until the element is focused and so never alters the
 * artwork at rest.
 *
 * SIZING
 * ------
 * Boxes are in source pixels and converted to percentages, so a target stays
 * welded to its object at every width without re-tuning. At a 1440px viewport
 * (1440/2158 = 0.667 scale) every target is at least 44x44 CSS px - see the
 * printed table in REPORT. No two boxes overlap.
 */

const HERO_SRC = "/images/hero/hero-final-reference.png";
const HERO_WIDTH = 2158;
const HERO_HEIGHT = 729;

type Target = {
  href: string;
  /**
   * The i18n key for this hotspot's name, resolved by the caller.
   *
   * It was a literal English string until a real browser pass at 390px with
   * `sparelink-locale=hi` showed the mobile category row under the hero reading
   * "Brake Parts / Filters / Shockers / Grease Products / Oil and Lubricants" on
   * a Hindi page. The same string is also the `aria-label` of an invisible
   * overlay anchor, so it reached screen-reader users in English too.
   */
  labelKey: MessageKey;
  /** Bounds in 2158x729 source pixels: left, top, right, bottom. */
  box: [number, number, number, number];
  kind: "vehicle" | "part" | "cta";
  /** Present on vehicle hotspots only: which hero class this dot represents. */
  slot?: HeroSlot;
};

/**
 * English fallback for a hotspot whose `labels` entry is missing.
 *
 * The same strings the table carried before they became i18n keys. They are
 * NOT the primary source - a Hindi page must never reach this map - but an
 * unnamed hotspot is an invisible anchor with no accessible name, which is worse
 * than English.
 */
const FALLBACK_LABELS: Partial<Record<MessageKey, string>> = {
  "heroTarget.heavyCommercial": "Heavy Commercial Vehicle Parts",
  "heroTarget.lightCommercial": "Light Commercial Vehicle Parts",
  "heroTarget.passenger": "Passenger Vehicle Parts",
  "heroTarget.agriculture": "Agriculture Vehicle Parts",
  "heroTarget.earthmover": "Earthmover Parts",
  "heroTarget.motorcycle": "Motorcycle Parts",
  "heroTarget.scooter": "Scooter Parts",
  "heroTarget.brakeParts": "Brake Parts",
  "heroTarget.filters": "Filters",
  "heroTarget.shockers": "Shockers",
  "heroTarget.grease": "Grease Products",
  "heroTarget.lubricants": "Oil and Lubricants",
  "heroTarget.shopParts": "Shop Spare Parts",
  "heroTarget.dealerBulk": "Dealer Bulk Order",
};

const pct = (b: Target["box"]) => ({
  left: `${(b[0] / HERO_WIDTH) * 100}%`,
  top: `${(b[1] / HERO_HEIGHT) * 100}%`,
  width: `${((b[2] - b[0]) / HERO_WIDTH) * 100}%`,
  height: `${((b[3] - b[1]) / HERO_HEIGHT) * 100}%`,
});

const FITMENT = "/vehicle-fitment";

/**
 * Every vehicle hotspot carries its hero class slot, and its href is resolved
 * from that slot rather than hard-coded.
 *
 * A slot with a curated, enabled, non-empty collection goes to
 * `/hero/<slot>`. Everything else falls back to `/vehicle-fitment`, which is the
 * real, existing fitment browser. The fallback is the point: a curation mistake
 * must cost the click, never become a dead dot on the homepage. `heroCollectionHref`
 * holds that rule and is unit tested, so it is called here rather than
 * re-implemented.
 *
 * The eight slots are NOT seven: Passenger Vehicle is drawn twice, on the red
 * SUV and on the white saloon, and each has its own curated set. That is why the
 * slot is part of the collection key rather than a column.
 */
type HeroSlot = (typeof HERO_COLLECTION_SLOTS)[number];

const TARGETS: Target[] = [
  /* ---- 8 vehicles, centred on the detected marker dot ---- */
  { kind: "vehicle", slot: "heavy-commercial-vehicle", href: FITMENT, labelKey: "heroTarget.heavyCommercial", box: [924, 233, 994, 303] },
  { kind: "vehicle", slot: "light-commercial-vehicle", href: FITMENT, labelKey: "heroTarget.lightCommercial", box: [1093, 284, 1163, 354] },
  { kind: "vehicle", slot: "passenger-red-suv", href: FITMENT, labelKey: "heroTarget.passenger", box: [1292, 289, 1362, 359] },
  /* the saloon has two dots; this spans both */
  { kind: "vehicle", slot: "passenger-white-saloon", href: FITMENT, labelKey: "heroTarget.passenger", box: [1566, 310, 1646, 394] },
  { kind: "vehicle", slot: "agriculture", href: FITMENT, labelKey: "heroTarget.agriculture", box: [1721, 246, 1791, 316] },
  { kind: "vehicle", slot: "earthmover", href: FITMENT, labelKey: "heroTarget.earthmover", box: [1980, 244, 2050, 314] },
  { kind: "vehicle", slot: "motorcycle", href: FITMENT, labelKey: "heroTarget.motorcycle", box: [1799, 379, 1869, 449] },
  { kind: "vehicle", slot: "scooter", href: FITMENT, labelKey: "heroTarget.scooter", box: [1999, 388, 2069, 458] },

  /* ---- 5 part categories ---- */
  { kind: "part", href: "/category/braking-system", labelKey: "heroTarget.brakeParts", box: [874, 444, 1010, 578] },
  { kind: "part", href: "/category/filters", labelKey: "heroTarget.filters", box: [1059, 437, 1183, 578] },
  /* corrected: the first pass sat on empty background above the ribbed damper
     and clipped the AP-LR pail; the object is lower than estimated. */
  { kind: "part", href: "/category/shock-absorbers-shockers", labelKey: "heroTarget.shockers", box: [1310, 468, 1400, 537] },
  { kind: "part", href: "/category/greases", labelKey: "heroTarget.grease", box: [1190, 452, 1305, 618] },
  { kind: "part", href: "/category/lubricants", labelKey: "heroTarget.lubricants", box: [1458, 396, 1566, 608] },

  /* ---- the two baked-in CTA buttons ---- */
  { kind: "cta", href: "#categories", labelKey: "heroTarget.shopParts", box: [52, 454, 346, 521] },
  { kind: "cta", href: "/login/dealer", labelKey: "heroTarget.dealerBulk", box: [367, 454, 665, 521] },
];

/**
 * A plain, serialisable description of which hero slots are curated.
 *
 * Passed in from the server rather than read inside this component, because the
 * hero renders inside `app/(public)/home-client.tsx`, which is a CLIENT
 * component. A client component cannot read the database, and a client-side
 * fetch for eight link targets would put the fallback decision behind a
 * round-trip that can fail visibly â€” a hero dot that 404s is worse than one that
 * goes to the fitment browser. So `app/(public)/page.tsx` resolves the slots on
 * the server and hands the answer down.
 */
export type HeroSlotAvailability = {
  counts: Partial<Record<HeroSlot, number>>;
  enabled: HeroSlot[];
};

export function HomeHero({
  availability,
  labels,
}: {
  availability?: HeroSlotAvailability;
  /**
   * Resolved hotspot names, keyed by the i18n key in TARGETS.
   *
   * Supplied by the client parent rather than resolved with `useI18n()` here, so
   * this file stays a server component and the LCP-critical artwork is not
   * pushed behind the client boundary. A missing key degrades to the English
   * literal in `TARGETS` rather than rendering a blank hotspot.
   */
  labels?: Partial<Record<MessageKey, string>>;
}) {
  /* An absent prop means "no collections", which resolves every slot to the
     fitment fallback. That is the pre-collections behaviour, so a caller
     that forgets to pass it degrades safely rather than producing dead links. */
  const counts = new Map<HeroSlot, number>(Object.entries(availability?.counts ?? {}) as [HeroSlot, number][]);
  const enabled = new Set<HeroSlot>(availability?.enabled ?? []);

  /* Resolved here rather than in the table, so the fallback rule lives in one
     tested function and the table stays a plain description of the artwork. */
  const targets = TARGETS.map((target) =>
    target.slot ? { ...target, href: heroCollectionHref(target.slot, counts, enabled) } : target,
  );

  /* The English literals, kept as a last-resort fallback so a caller that omits
     `labels` still renders a readable hotspot instead of an empty one. */
  const label = (target: Target) => labels?.[target.labelKey] ?? FALLBACK_LABELS[target.labelKey] ?? "";

  return (
    <section
      id="search"
      aria-labelledby="hero-heading"
      className="border-b border-[var(--v3-rule)] bg-[var(--v3-page)]"
    >
      {/* `isolate` gives the hero its own stacking context. */}
      <div
        className="relative isolate mx-auto w-full max-w-[1600px]"
        style={{ aspectRatio: `${HERO_WIDTH} / ${HERO_HEIGHT}` }}
      >
        <Image
          src={HERO_SRC}
          alt="SpareLink India catalogue: a container truck, mini truck, red SUV, white saloon, tractor and backhoe loader, a motorcycle and a scooter, above a display of Pensol lubricants and grease with brake parts, oil filters and a shock absorber."
          fill
          priority
          sizes="100vw"
          /* No `quality` override: this project does not configure
             images.qualities, so Next's default of 75 applies. */
          /* The bitmap is decorative. Without pointer-events-none the <img> is a
             positioned sibling competing for the same area and swallows hits
             that should reach an overlay. */
          className="pointer-events-none select-none object-contain"
        />

        {/* The visible headline lives in the bitmap; this keeps it in the
            accessibility tree and for crawlers without printing it twice. */}
        <h1 id="hero-heading" className="sr-only">
          Find the Right Part. Build the Right Vehicle.
        </h1>

        {/* ONE dedicated overlay layer above the artwork. The layer ignores
            pointer events; each anchor opts back in. */}
        <div className="pointer-events-none absolute inset-0 z-20 hidden md:block">
          {targets.map((target) => (
            <Link
              key={`${target.kind}-${target.labelKey}-${target.box.join("_")}`}
              href={target.href}
              /* aria-label only. A `title` attribute makes the browser paint a
                 native tooltip over the artwork on hover, which is exactly the
                 visible label these hotspots must not have. The accessible name
                 is unaffected - aria-label wins over title anyway. */
              aria-label={label(target)}
              data-hero-target={target.kind}
              data-hero-label={label(target)}
              className="pointer-events-auto absolute cursor-pointer border-0 bg-transparent p-0 text-transparent shadow-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--v3-brand)]"
              style={pct(target.box)}
            />
          ))}
        </div>
      </div>

      {/* Phones: the artwork is a ~127px strip, so the overlays are removed and
          the part categories are offered as a plain text row. Unchanged from
          the previous pass; the vehicle markers are not repeated here because
          the artwork's own dots are not tappable at that size either. */}
      <div className="v3-container border-t border-[var(--v3-rule)] py-3 md:hidden">
        <nav aria-label="Shop by part category">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {TARGETS.filter((target) => target.kind === "part").map((target) => (
              <li key={target.href}>
                <Link
                  href={target.href}
                  className="v3-focus text-[0.8125rem] font-semibold text-[var(--v3-text-2)] transition-colors hover:text-[var(--v3-brand)]"
                >
                  {label(target)}                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
