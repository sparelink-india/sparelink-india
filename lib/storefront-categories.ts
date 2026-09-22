export type StorefrontCategoryDef = {
  slug: string;
  nameKey: "cat.body" | "cat.filters" | "cat.brakes" | "cat.engine" | "cat.suspension" | "cat.clutch" | "cat.electricals" | "cat.lubricants";
  descKey:
    | "cat.bodyDesc"
    | "cat.filtersDesc"
    | "cat.brakesDesc"
    | "cat.engineDesc"
    | "cat.suspensionDesc"
    | "cat.clutchDesc"
    | "cat.electricalsDesc"
    | "cat.lubricantsDesc";
  image: string;
  sourceSlugs: string[];
};

export const STOREFRONT_CATEGORIES: StorefrontCategoryDef[] = [
  {
    slug: "body-parts",
    nameKey: "cat.body",
    descKey: "cat.bodyDesc",
    image: "/images/category/body-parts.png",
    sourceSlugs: [
      "outside-door-handle",
      "window-regulator-assy",
      "side-view-mirror",
      "inside-door-handle",
      "door-latch-assy",
      "sub-mirror",
      "fuel-tank-cap",
      "window-regulator-handles",
      "door-hinges",
      "door-striker",
      "bonnet-lock",
      "power-window-switches",
      "window-lock",
      "front-grills",
      "glove-box-dash-board-locks",
      "door-lock-w-keys",
      "dickey-shocker-gas-springs",
      "bumper-brackets",
      "seat-belts",
      "roof-handle",
      "seat-recliners",
      "door-lock-kit",
      "door-lock-knob",
      "door-stopper",
      "fuel-tank-neck",
      "fog-lamp-cover",
      "dala-handles",
      "bonnet-hinges",
      "ratchet-tie-down",
      "wiper-linkage",
      "arm-rest-handle",
      "stepney-brackets",
      "dickey-trunklid-locks",
      "grab-handle",
      "side-mirror-bracket",
      "fender-linings",
      "sash",
      "quarter-glass-frame",
      "bonnet-handle",
      "license-number-plates",
      "door-lock",
      "mud-guard-flap",
      "inner-pull-handle",
      "foot-step",
      "wiper-arm",
      "bumper-corners",
      "sunvisor",
      "head-light-bezel",
      "inside-mirror",
      "bonnet-opener",
      "wheel-cap",
      "side-mirror-rods",
      "sunshade-bracket",
      "body",
      "fuel-tank-locks",
      "wiper-blade",
      "channels-guide-rails",
    ],
  },
  {
    slug: "filters",
    nameKey: "cat.filters",
    descKey: "cat.filtersDesc",
    image: "/images/category/filters.png",
    sourceSlugs: ["filters-cat-src-filters", "filters"],
  },
  {
    slug: "braking-system",
    nameKey: "cat.brakes",
    descKey: "cat.brakesDesc",
    image: "/images/category/braking-system.png",
    sourceSlugs: ["brake-shoes", "brake-linings", "brake-fluid", "brakes"],
  },
  {
    slug: "engine-parts",
    nameKey: "cat.engine",
    descKey: "cat.engineDesc",
    image: "/images/category/engine-parts.png",
    sourceSlugs: [
      "engine",
      "radiator-cap",
      "cooling",
      "fan",
      "sensor",
      "hand-throttle",
      "accelerator-pedal",
      "urea-adblue-tank-cap",
    ],
  },
  {
    slug: "suspension-steering",
    nameKey: "cat.suspension",
    descKey: "cat.suspensionDesc",
    image: "/images/category/suspension-steering.png",
    sourceSlugs: [
      "shock-absorbers-shockers",
      "steering-wheels",
      "springs",
      "linkage-rod",
      "rods",
      "suspension",
    ],
  },
  {
    slug: "clutch-transmission",
    nameKey: "cat.clutch",
    descKey: "cat.clutchDesc",
    image: "/images/category/clutch-transmission.png",
    sourceSlugs: ["gear-lever-knobs", "gear-lever-boot", "transmission"],
  },
  {
    slug: "electricals",
    nameKey: "cat.electricals",
    descKey: "cat.electricalsDesc",
    image: "/images/category/electricals.png",
    sourceSlugs: [
      "cables-wires",
      "switches",
      "horns",
      "motors",
      "battery-terminals",
      "relay",
      "connector",
      "head-lights",
      "fog-lamp",
      "meter",
      "electrical",
    ],
  },
  {
    slug: "lubricants",
    nameKey: "cat.lubricants",
    descKey: "cat.lubricantsDesc",
    image: "/images/category/lubricants.png",
    sourceSlugs: [
      "greases",
      "diesel-engine-oils",
      "gear-oils",
      "motorbike-oils",
      "passenger-car-engine-oils",
      "cng-engine-oils",
      "agriculture-tractor-oils",
      "mini-cv-engine-oils",
      "hydraulic-oil",
      "coolant",
      "diesel-exhaust-fluid",
      "rust-preventive-oil",
      "diesel-engine-oil",
      "metal-working-fluid",
      "rock-drill-oil",
      "circulating-oil",
      "gear-oil",
      "spinning-oil",
      "quenching-oil",
      "compressor-oil",
      "refrigeration-oil",
      "thermic-fluid",
      "special-grade-machinery-oil",
      "axle-transmission-oil",
    ],
  },
];

const bySlug = new Map(STOREFRONT_CATEGORIES.map((item) => [item.slug, item]));

const sourceToStorefront = new Map<string, string>();
for (const item of STOREFRONT_CATEGORIES) {
  for (const source of item.sourceSlugs) {
    sourceToStorefront.set(source, item.slug);
  }
}

export function findStorefrontCategory(slug: string): StorefrontCategoryDef | null {
  const key = slug.trim().toLowerCase();
  return bySlug.get(key) ?? null;
}

export function storefrontSlugForSourceCategory(sourceSlug: string): string | null {
  return sourceToStorefront.get(sourceSlug.trim().toLowerCase()) ?? null;
}

export function typesenseCategoryFilter(names: string[]): string | null {
  const values = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (!values.length) return null;
  return `category:=[${values.map((name) => `\`${name.replaceAll("`", "")}\``).join(",")}]`;
}
