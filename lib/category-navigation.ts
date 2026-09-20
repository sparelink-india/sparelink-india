export type CatalogueCategory = {
  id: string;
  name: string;
  slug: string;
};

export type NavChild = {
  id: string;
  name: string;
  href: string;
  kind: "category" | "virtual";
};

export type NavGroup = {
  id: string;
  name: string;
  href: string | null;
  children: NavChild[];
};

export type CategoryRoute = {
  title: string;
  categoryName: string | null;
  nameContains: string | null;
  otherType: "cables" | "filters" | null;
  segment: WaterPumpSegment | null;
  breadcrumb: { label: string; href: string }[];
};

export type WaterPumpSegment =
  | "heavy-commercial-vehicle"
  | "passenger-vehicle"
  | "agriculture"
  | "earthmover"
  | "unclassified";

export type CoverageReport = {
  total: number;
  grouped: number;
  unmapped: string[];
  emptyGroups: string[];
  duplicates: string[];
};

export const WATER_PUMP_GROUP_ID = "water-pump-assy";
export const WATER_PUMP_SEGMENTS: Array<{
  id: WaterPumpSegment;
  name: string;
  slug: string;
}> = [
  {
    id: "heavy-commercial-vehicle",
    name: "Heavy Commercial Vehicle",
    slug: "heavy-commercial-vehicle",
  },
  {
    id: "passenger-vehicle",
    name: "Passenger Vehicle",
    slug: "passenger-vehicle",
  },
  { id: "agriculture", name: "Agriculture", slug: "agriculture" },
  { id: "earthmover", name: "Earthmover", slug: "earthmover" },
];

type GroupRule = {
  id: string;
  name: string;
  match: (normalized: string, original: string) => boolean;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyCategory(value: string): string {
  const slug = normalize(value).replace(/\s+/g, "-").slice(0, 80);
  return slug || "category";
}

function has(normalized: string, ...needles: string[]): boolean {
  return needles.some((needle) => {
    const token = normalize(needle);
    return token && (` ${normalized} `.includes(` ${token} `) || normalized.includes(token));
  });
}

const GROUP_RULES: GroupRule[] = [
  {
    id: "lubricants",
    name: "Lubricant Oil & Grease",
    match: (n) =>
      has(
        n,
        "oil",
        "oils",
        "grease",
        "greases",
        "lubricant",
        "lubricants",
        "gear oil",
        "engine oil",
        "metal working",
      ) && !has(n, "filter", "seal", "gauge"),
  },
  {
    id: "window-regulator",
    name: "Window Regulator & Parts",
    match: (n) =>
      has(
        n,
        "window regulator",
        "window regulator assy",
        "window regulator handles",
        "window lock",
        "rg handle",
        "glass machine",
        "channels guide rails",
        "sash",
        "quarter glass",
        "power window",
      ),
  },
  {
    id: "water-pump",
    name: "Water Pump Assy",
    match: (n) => has(n, "water pump", "waterpump"),
  },
  {
    id: "bonnet",
    name: "Bonnet Related Parts",
    match: (n) => has(n, "bonnet"),
  },
  {
    id: "cables",
    name: "Automotive Cables",
    match: (n) => has(n, "cable", "cables", "wires"),
  },
  {
    id: "filters",
    name: "Filters",
    match: (n) => has(n, "filter", "filters"),
  },
  {
    id: "fluids",
    name: "Fluids & Coolants",
    match: (n) =>
      has(n, "coolant", "brake fluid", "diesel exhaust fluid", "thermic fluid", "adblue"),
  },
  {
    id: "braking",
    name: "Braking System",
    match: (n) => has(n, "brake", "brakes", "brake linings", "brake shoes"),
  },
  {
    id: "suspension",
    name: "Suspension & Steering",
    match: (n) =>
      has(n, "shock", "shocker", "shockers", "suspension", "steering wheels", "spring", "springs") ||
      (has(n, "steering") && !has(n, "lock", "ignition")),
  },
  {
    id: "mirrors",
    name: "Mirrors",
    match: (n) => has(n, "mirror"),
  },
  {
    id: "wipers",
    name: "Wipers",
    match: (n) => has(n, "wiper"),
  },
  {
    id: "fuel",
    name: "Fuel System",
    match: (n) => has(n, "fuel tank", "urea", "adblue tank"),
  },
  {
    id: "engine",
    name: "Engine & Cooling",
    match: (n) =>
      has(n, "engine", "cooling", "fan", "radiator", "compressor oil") &&
      !has(n, "oil", "oils"),
  },
  {
    id: "electricals",
    name: "Electricals",
    match: (n) =>
      has(
        n,
        "electrical",
        "electricals",
        "horn",
        "horns",
        "switch",
        "switches",
        "relay",
        "sensor",
        "motor",
        "motors",
        "connector",
        "fog lamp",
        "head light",
        "head lights",
        "battery",
      ),
  },
  {
    id: "controls",
    name: "Pedals, Levers & Controls",
    match: (n) =>
      has(
        n,
        "accelerator pedal",
        "gear lever",
        "hand throttle",
        "linkage",
        "rods",
        "clutch",
        "transmission",
      ),
  },
  {
    id: "locks-latches",
    name: "Locks, Latches & Handles",
    match: (n) =>
      has(
        n,
        "door",
        "handle",
        "lock",
        "latch",
        "striker",
        "stopper",
        "ignition",
        "dickey",
        "trunklid",
        "glove box",
      ) && !has(n, "bonnet", "window", "fuel tank"),
  },
  {
    id: "body",
    name: "Body Parts",
    match: (n) =>
      has(
        n,
        "body",
        "bumper",
        "fender",
        "grill",
        "grills",
        "bezel",
        "mud guard",
        "foot step",
        "wheel cap",
        "license",
        "sunvisor",
        "sunshade",
        "stepney",
        "dala",
      ),
  },
  {
    id: "seats",
    name: "Seats & Cabin",
    match: (n) => has(n, "seat", "grab handle", "roof handle", "arm rest"),
  },
  {
    id: "tools",
    name: "Tools & Hardware",
    match: (n) => has(n, "clamp", "clamps", "ratchet", "tie down"),
  },
];

export type CableTypeDef = { name: string; slug: string; pattern: RegExp };

export const CABLE_TYPE_DEFS: CableTypeDef[] = [
  {
    name: "Accelerator Cable",
    slug: "accelerator-cable",
    pattern: /accelerat|accelar|accelator|\bacc\.|\bacc cable\b|\bacc\b/i,
  },
  { name: "Bonnet Cable", slug: "bonnet-cable", pattern: /\bbonnet\b/i },
  { name: "Clutch Cable", slug: "clutch-cable", pattern: /\bclutch\b/i },
  { name: "Gear Cable", slug: "gear-cable", pattern: /\bgear\b/i },
  { name: "Brake Cable", slug: "brake-cable", pattern: /\bbrake\b/i },
  { name: "Door Cable", slug: "door-cable", pattern: /\b(door|latch|dr hndl)\b/i },
  {
    name: "Speedometer Cable",
    slug: "speedometer-cable",
    pattern: /\b(speedo|speedometer|meter cable)\b/i,
  },
  { name: "Choke Cable", slug: "choke-cable", pattern: /\bchoke\b/i },
  { name: "Booster Cable", slug: "booster-cable", pattern: /\bbooster\b/i },
  { name: "Stop Cable", slug: "stop-cable", pattern: /\bstop cable\b/i },
];

export const FILTER_TYPE_DEFS: CableTypeDef[] = [
  {
    name: "Cabin Filter",
    slug: "cabin-filter",
    pattern: /\b(cabin filter|ac filter|pollen)\b/i,
  },
  {
    name: "Fuel Filter",
    slug: "fuel-filter",
    pattern: /\b(fuel filter|diesel filter)\b/i,
  },
  { name: "Oil Filter", slug: "oil-filter", pattern: /\boil filter\b/i },
  { name: "Air Filter", slug: "air-filter", pattern: /\bair filter\b/i },
  { name: "Hydraulic Filter", slug: "hydraulic-filter", pattern: /\bhydraulic filter\b/i },
  {
    name: "Transmission Filter",
    slug: "transmission-filter",
    pattern: /\btransmission filter\b/i,
  },
  { name: "CNG Filter", slug: "cng-filter", pattern: /\bcng filter\b/i },
  {
    name: "Water Separator",
    slug: "water-separator",
    pattern: /\bwater separator\b/i,
  },
];

export function discoverNamedTypes(
  names: string[],
  defs: CableTypeDef[],
  otherName: string,
  otherSlug: string,
): Array<{ name: string; slug: string; query: string }> {
  const counts = new Map<string, number>();
  let other = 0;
  for (const name of names) {
    const match = defs.find((def) => {
      def.pattern.lastIndex = 0;
      return def.pattern.test(name);
    });
    if (match) counts.set(match.slug, (counts.get(match.slug) || 0) + 1);
    else if (name.trim()) other += 1;
  }
  const found = defs
    .filter((def) => (counts.get(def.slug) || 0) > 0)
    .map((def) => ({ name: def.name, slug: def.slug, query: def.name }));
  if (other > 0) found.push({ name: otherName, slug: otherSlug, query: "" });
  return found;
}

const HCV_TYPES = new Set(
  [
    "TATA TRUCK",
    "ASHOK LEYLAND",
    "BHARAT BENZ",
    "MAHINDRA TRUCK",
    "TATA LCV",
    "LCV'S",
    "AMW",
    "VOLVO TRUCK",
    "MARUTI SUZUKI (LCV)",
  ].map((item) => item.toUpperCase()),
);

const PV_TYPES = new Set(
  [
    "MARUTI SUZUKI (CAR)",
    "HYUNDAI",
    "TATA CAR",
    "HONDA",
    "GM",
    "FORD",
    "RENAULT",
    "KIA",
    "SKODA",
    "NISSAN",
    "HM",
    "PREMIER",
    "DAEWOO",
    "MITSUBISHI",
    "FIAT",
    "MORRIS GARAGE",
    "TOYOTA",
    "JEEP",
    "VOLKSWAGEN",
  ].map((item) => item.toUpperCase()),
);

function classifyVehicleTypeLabel(label: string): WaterPumpSegment | null {
  const upper = label.trim().toUpperCase();
  if (!upper || upper === "UNIVERSAL") return null;
  const hasJcb = /\bJCB\b/.test(upper);
  const agriHint = /\bAGRICULTURE\b|\bTRACTOR\b/.test(upper);
  const machineryHint =
    /\bMACHINERY\b|\bEARTHMOVER\b|\bEXCAVATOR\b|\bBACKHOE\b/.test(upper);
  if (hasJcb && agriHint && machineryHint) {
    return null;
  }
  if (/\bTRACTOR\b/.test(upper) || (upper.includes("AGRICULTURE") && !machineryHint)) {
    return "agriculture";
  }
  if (
    upper.includes("EARTHMOVER") ||
    upper.includes("EXCAVATOR") ||
    upper.includes("BACKHOE")
  ) {
    return "earthmover";
  }
  if (HCV_TYPES.has(upper) || (/\bTRUCK\b|\bLCV\b|\bHCV\b/.test(upper) && !upper.includes("CAR"))) {
    return "heavy-commercial-vehicle";
  }
  if (PV_TYPES.has(upper) || upper.includes("CAR")) return "passenger-vehicle";
  return null;
}

export function classifyWaterPumpSegment(
  vehicleTypes: string[],
  productName = "",
): WaterPumpSegment {
  const fromName = productName.toUpperCase();
  const nameHint =
    /\bTRACTOR\b|\bAGRI\b/.test(fromName)
      ? ("agriculture" as const)
      : /\bEXCAVATOR\b|\bBACKHOE\b|\bEARTHMOVER\b/.test(fromName)
        ? ("earthmover" as const)
        : null;

  const labels = [...new Set(vehicleTypes.map((item) => item.trim()).filter(Boolean))];
  const segments = new Set<WaterPumpSegment>();
  for (const label of labels) {
    const segment = classifyVehicleTypeLabel(label);
    if (segment) segments.add(segment);
  }
  if (nameHint) segments.add(nameHint);
  if (segments.size === 1) return [...segments][0];
  return "unclassified";
}

export function isWaterPumpProduct(categoryName: string | null | undefined, productName = ""): boolean {
  const hay = `${categoryName || ""} ${productName}`.toLowerCase();
  return hay.includes("water pump") || hay.includes("waterpump");
}

function categoryHref(category: CatalogueCategory): string {
  return `/category/${category.slug || slugifyCategory(category.name)}`;
}

function isCatalogueCapsName(name: string): boolean {
  return name === name.toUpperCase() && /[A-Z]/.test(name);
}

function preferNavCategory(
  candidate: CatalogueCategory,
  current: CatalogueCategory,
): CatalogueCategory {
  const candidateCaps = isCatalogueCapsName(candidate.name);
  const currentCaps = isCatalogueCapsName(current.name);
  if (candidateCaps && !currentCaps) return candidate;
  if (currentCaps && !candidateCaps) return current;
  const candidateCanonical = candidate.slug === slugifyCategory(candidate.name);
  const currentCanonical = current.slug === slugifyCategory(current.name);
  if (candidateCanonical && !currentCanonical) return candidate;
  return current;
}

function childFromCategory(category: CatalogueCategory): NavChild {
  return {
    id: category.id,
    name: category.name,
    href: categoryHref(category),
    kind: "category",
  };
}

export function buildCategoryNavigation(
  categories: CatalogueCategory[],
  hints?: {
    cableNames?: string[];
    filterNames?: string[];
    hasUnclassifiedWaterPumps?: boolean;
  },
): { groups: NavGroup[]; coverage: CoverageReport } {
  const byId = new Map<string, CatalogueCategory[]>();
  const assigned = new Set<string>();
  const seenNames = new Map<string, number>();
  const duplicates: string[] = [];
  const preferredByKey = new Map<string, CatalogueCategory>();

  for (const category of categories) {
    const key = normalize(category.name);
    seenNames.set(key, (seenNames.get(key) || 0) + 1);
    if ((seenNames.get(key) || 0) === 2) duplicates.push(category.name);

    const existing = preferredByKey.get(key);
    if (!existing) {
      preferredByKey.set(key, category);
    } else {
      preferredByKey.set(key, preferNavCategory(category, existing));
    }
  }

  for (const category of preferredByKey.values()) {
    const key = normalize(category.name);
    const rule = GROUP_RULES.find((item) => item.match(key, category.name));
    const groupId = rule?.id || "other";
    const list = byId.get(groupId) ?? [];
    list.push(category);
    byId.set(groupId, list);
    if (rule) assigned.add(category.id);
  }

  for (const category of categories) {
    const key = normalize(category.name);
    const representative = preferredByKey.get(key);
    if (!representative || representative === category) continue;
    const grouped = GROUP_RULES.find((item) => item.match(key, representative.name));
    if (grouped) assigned.add(category.id);
  }

  const groups: NavGroup[] = [];

  const lubricants = byId.get("lubricants") ?? [];
  if (lubricants.length) {
    groups.push({
      id: "lubricants",
      name: "Lubricant Oil & Grease",
      href: null,
      children: lubricants.map(childFromCategory),
    });
  }

  const windowCats = byId.get("window-regulator") ?? [];
  if (windowCats.length) {
    groups.push({
      id: "window-regulator",
      name: "Window Regulator & Parts",
      href: windowCats.length === 1 ? categoryHref(windowCats[0]) : null,
      children: windowCats.map(childFromCategory),
    });
  }

  const waterPumpCats = byId.get("water-pump") ?? [];
  const waterChildren: NavChild[] = WATER_PUMP_SEGMENTS.map((segment) => ({
    id: `water-pump-${segment.slug}`,
    name: segment.name,
    href: `/category/${WATER_PUMP_GROUP_ID}/${segment.slug}`,
    kind: "virtual" as const,
  }));
  if (hints?.hasUnclassifiedWaterPumps) {
    waterChildren.push({
      id: "water-pump-unclassified",
      name: "Other / Unclassified",
      href: `/category/${WATER_PUMP_GROUP_ID}/unclassified`,
      kind: "virtual",
    });
  }
  groups.push({
    id: WATER_PUMP_GROUP_ID,
    name: "Water Pump Assy",
    href: waterPumpCats[0] ? categoryHref(waterPumpCats[0]) : `/category/${WATER_PUMP_GROUP_ID}`,
    children: [
      ...waterPumpCats.map(childFromCategory),
      ...waterChildren,
    ],
  });

  const bonnet = byId.get("bonnet") ?? [];
  const cableCategory =
    (byId.get("cables") ?? []).find((item) => /cable/i.test(item.name)) ?? null;
  const bonnetChildren = bonnet.map(childFromCategory);
  if (hints?.cableNames?.some((name) => /bonnet/i.test(name))) {
    bonnetChildren.push({
      id: "virtual-bonnet-cable",
      name: "Bonnet Cable",
      href: `/category/${cableCategory?.slug || "cables-wires"}/bonnet-cable`,
      kind: "virtual",
    });
  }
  if (bonnetChildren.length) {
    groups.push({
      id: "bonnet",
      name: "Bonnet Related Parts",
      href: null,
      children: bonnetChildren,
    });
  }

  const cables = byId.get("cables") ?? [];
  const cableTypes = discoverNamedTypes(
    hints?.cableNames ?? [],
    CABLE_TYPE_DEFS,
    "Other Cables",
    "other-cables",
  );
  if (cables.length || cableTypes.length) {
    const primary = cables[0] ?? null;
    groups.push({
      id: "cables",
      name: "Automotive Cables",
      href: primary ? categoryHref(primary) : null,
      children: [
        ...cables.map(childFromCategory),
        ...cableTypes.map((type) => ({
          id: `cable-${type.slug}`,
          name: type.name,
          href: `/category/${primary?.slug || "cables-wires"}/${type.slug}`,
          kind: "virtual" as const,
        })),
      ],
    });
  }

  const filters = byId.get("filters") ?? [];
  const filterTypes = discoverNamedTypes(
    hints?.filterNames ?? [],
    FILTER_TYPE_DEFS,
    "Other Filters",
    "other-filters",
  );
  if (filters.length || filterTypes.length) {
    const primary = filters[0] ?? null;
    groups.push({
      id: "filters",
      name: "Filters",
      href: primary ? categoryHref(primary) : null,
      children: [
        ...filters.map(childFromCategory),
        ...filterTypes.map((type) => ({
          id: `filter-${type.slug}`,
          name: type.name,
          href: `/category/${primary?.slug || "filters"}/${type.slug}`,
          kind: "virtual" as const,
        })),
      ],
    });
  }

  const orderedRest = [
    "fluids",
    "braking",
    "suspension",
    "engine",
    "electricals",
    "controls",
    "locks-latches",
    "body",
    "mirrors",
    "wipers",
    "fuel",
    "seats",
    "tools",
  ];
  for (const id of orderedRest) {
    const cats = byId.get(id) ?? [];
    if (!cats.length) continue;
    const rule = GROUP_RULES.find((item) => item.id === id);
    groups.push({
      id,
      name: rule?.name || id,
      href: cats.length === 1 ? categoryHref(cats[0]) : null,
      children: cats.map(childFromCategory),
    });
  }

  const other = byId.get("other") ?? [];
  if (other.length) {
    groups.push({
      id: "other",
      name: "Other Categories",
      href: null,
      children: other.map(childFromCategory),
    });
  }

  const unmapped = other.map((item) => item.name);
  const emptyGroups = groups.filter((group) => group.children.length === 0).map((group) => group.name);

  return {
    groups,
    coverage: {
      total: categories.length,
      grouped: assigned.size,
      unmapped,
      emptyGroups,
      duplicates,
    },
  };
}

export function flattenNavHrefs(groups: NavGroup[]): string[] {
  const hrefs: string[] = [];
  for (const group of groups) {
    if (group.href) hrefs.push(group.href);
    for (const child of group.children) hrefs.push(child.href);
  }
  return hrefs;
}

export function resolveCategoryRoute(
  slugs: string[],
  categories: CatalogueCategory[],
  groups: NavGroup[],
): CategoryRoute | null {
  const [first, second] = slugs.map((item) => item.trim()).filter(Boolean);
  if (!first) return null;

  if (first === WATER_PUMP_GROUP_ID) {
    const segment = WATER_PUMP_SEGMENTS.find((item) => item.slug === second);
    const unclassified = second === "unclassified";
    const title = segment
      ? `Water Pump Assy — ${segment.name}`
      : unclassified
        ? "Water Pump Assy — Other / Unclassified"
        : "Water Pump Assy";
    return {
      title,
      categoryName: null,
      nameContains: "water pump",
      otherType: null,
      segment: segment?.id ?? (unclassified ? "unclassified" : null),
      breadcrumb: [
        { label: "Home", href: "/" },
        { label: "Water Pump Assy", href: `/category/${WATER_PUMP_GROUP_ID}` },
        ...(segment || unclassified
          ? [{ label: segment?.name || "Other / Unclassified", href: `/category/${WATER_PUMP_GROUP_ID}/${second}` }]
          : []),
      ],
    };
  }

  const category =
    categories.find((item) => item.slug === first) ||
    categories.find((item) => slugifyCategory(item.name) === first);
  const typeChild = groups
    .flatMap((group) => group.children)
    .find((child) => child.kind === "virtual" && child.href.endsWith(`/${second}`));

  if (category && !second) {
    const parent = groups.find((group) =>
      group.children.some((child) => child.id === category.id),
    );
    return {
      title: category.name,
      categoryName: category.name,
      nameContains: null,
      otherType: null,
      segment: null,
      breadcrumb: [
        { label: "Home", href: "/" },
        ...(parent ? [{ label: parent.name, href: parent.href || categoryHref(category) }] : []),
        { label: category.name, href: categoryHref(category) },
      ],
    };
  }

  if (category && second) {
    const type =
      [...CABLE_TYPE_DEFS, ...FILTER_TYPE_DEFS].find((item) => item.slug === second) ||
      (second === "other-cables"
        ? { name: "Other Cables", slug: "other-cables" }
        : second === "other-filters"
          ? { name: "Other Filters", slug: "other-filters" }
          : null);
    if (!type && !typeChild) return null;
    const label = type?.name || typeChild?.name || second;
    return {
      title: label,
      categoryName: category.name,
      nameContains:
        second === "other-cables" || second === "other-filters" ? null : label,
      otherType:
        second === "other-cables" ? "cables" : second === "other-filters" ? "filters" : null,
      segment: null,
      breadcrumb: [
        { label: "Home", href: "/" },
        { label: category.name, href: categoryHref(category) },
        { label, href: `/category/${category.slug}/${second}` },
      ],
    };
  }

  const virtual = groups
    .flatMap((group) => group.children)
    .find((child) => child.href === `/category/${first}` || child.href.endsWith(`/${first}`));
  if (virtual) {
    const def = [...CABLE_TYPE_DEFS, ...FILTER_TYPE_DEFS].find((item) => item.slug === first);
    const parentGroup = groups.find((group) => group.children.some((child) => child.id === virtual.id));
    return {
      title: virtual.name,
      categoryName: parentGroup?.href ? null : null,
      nameContains: def?.name || virtual.name,
      otherType: first === "other-cables" ? "cables" : first === "other-filters" ? "filters" : null,
      segment: null,
      breadcrumb: [
        { label: "Home", href: "/" },
        ...(parentGroup ? [{ label: parentGroup.name, href: parentGroup.href || virtual.href }] : []),
        { label: virtual.name, href: virtual.href },
      ],
    };
  }

  return null;
}

export function productMatchesOtherType(
  name: string,
  defs: CableTypeDef[],
): boolean {
  return !defs.some((def) => def.pattern.test(name));
}
