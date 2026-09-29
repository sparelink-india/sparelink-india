/**
 * Hero vehicle collections — pure rules and vocabulary.
 *
 * Split from the repository for the same reason `lib/vehicle-image-catalogue.ts`
 * is split from `lib/admin-vehicle-images.ts`: the inventory loader touches the
 * database, but the admin page that owns its state and the storefront that
 * renders a curated set both need the slot list and the fallback rules in
 * code that must not pull `drizzle-orm` into the browser bundle.
 *
 * A hero class is a MARKETING LABEL on the hero artwork. It is not a vehicle,
 * it has no `vehicle` row, and it must never be written into
 * `part_vehicle_compatibility`. That table is the authority for what a part
 * fits. This one is the authority for what a hero click shows. The two systems
 * deliberately share nothing.
 *
 * Nothing in this module reads a file, a database or the network.
 */

/** The eight approved hero class slots. Passenger Vehicle has two, by design. */
export const HERO_COLLECTION_SLOTS = [
  "heavy-commercial-vehicle",
  "light-commercial-vehicle",
  "passenger-red-suv",
  "passenger-white-saloon",
  "agriculture",
  "earthmover",
  "motorcycle",
  "scooter",
] as const;

export type HeroCollectionSlot = (typeof HERO_COLLECTION_SLOTS)[number];

/** Everything the admin and the storefront need to name a slot. */
export type HeroSlotMeta = {
  slot: HeroCollectionSlot;
  /** Short admin-facing name. */
  label: string;
  /** Which part of the hero artwork the hotspot sits on. */
  note: string;
};

export const HERO_SLOT_META: readonly HeroSlotMeta[] = [
  {
    slot: "heavy-commercial-vehicle",
    label: "Heavy Commercial Vehicle",
    note: "The container truck on the right of the hero.",
  },
  {
    slot: "light-commercial-vehicle",
    label: "Light Commercial Vehicle",
    note: "The mini truck below the container truck.",
  },
  {
    slot: "passenger-red-suv",
    label: "Passenger Vehicle — red SUV",
    note: "The red SUV, the first passenger-vehicle hotspot.",
  },
  {
    slot: "passenger-white-saloon",
    label: "Passenger Vehicle — white saloon",
    note: "The white saloon, the second passenger-vehicle hotspot.",
  },
  {
    slot: "agriculture",
    label: "Agriculture Vehicle",
    note: "The tractor on the left of the hero.",
  },
  {
    slot: "earthmover",
    label: "Earthmover",
    note: "The backhoe loader at the far right.",
  },
  {
    slot: "motorcycle",
    label: "Motorcycle",
    note: "The motorcycle in the collage.",
  },
  {
    slot: "scooter",
    label: "Scooter",
    note: "The scooter beside the motorcycle.",
  },
];

const SLOT_SET: ReadonlySet<string> = new Set(HERO_COLLECTION_SLOTS);

export function isHeroCollectionSlot(value: unknown): value is HeroCollectionSlot {
  return typeof value === "string" && SLOT_SET.has(value);
}

export function heroSlotLabel(slot: HeroCollectionSlot): string {
  return HERO_SLOT_META.find((m) => m.slot === slot)?.label ?? slot;
}

/**
 * Where a hero hotspot goes.
 *
 * A slot with a curated, enabled, non-empty set routes to that curated
 * collection. Everything else — unknown slot, no row, disabled, or zero items —
 * falls back to the real fitment browser rather than to a page that would render
 * nothing. The fallback is the point: a curation mistake must not become a dead
 * link on the homepage.
 */
export const HERO_COLLECTION_FALLBACK = "/vehicle-fitment";

export function heroCollectionHref(
  slot: string,
  counts: ReadonlyMap<HeroCollectionSlot, number>,
  enabled: ReadonlySet<HeroCollectionSlot>,
): string {
  if (!isHeroCollectionSlot(slot)) return HERO_COLLECTION_FALLBACK;
  if (!enabled.has(slot)) return HERO_COLLECTION_FALLBACK;
  if ((counts.get(slot) ?? 0) < 1) return HERO_COLLECTION_FALLBACK;
  return `/hero/${slot}`;
}

/* ------------------------------------------------------------------ bounds */

/**
 * Caps, mirroring the compatibility mutations.
 *
 * A curated hero set is meant to be a shortlist. 500 is the explicit-list
 * ceiling and 2000 the filtered ceiling, so a single admin action cannot
 * rewrite an entire collection by accident. Above the bulk threshold the
 * request must echo the count back, which is what stops a stale dialog
 * confirming a result set that has since changed.
 */
export const HERO_MAX_EXPLICIT_PART_IDS = 500;
export const HERO_MAX_FILTERED_PART_IDS = 2000;
export const HERO_BULK_CONFIRM_THRESHOLD = 25;

const MAX_ID_LENGTH = 120;

export function isWellFormedHeroPartId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const id = value.trim();
  if (!id || id.length > MAX_ID_LENGTH) return false;
  // A part id is a data row key, never a URL or a path.
  if (/[\s/\\?#]/.test(id)) return false;
  return true;
}

export type HeroMutationRequest =
  | { action: "add"; slot: string; partIds?: unknown; scope?: unknown; expectedCount?: unknown; confirmCount?: unknown; filters?: unknown }
  | { action: "remove"; slot: string; partIds?: unknown; scope?: unknown; expectedCount?: unknown; confirmCount?: unknown; filters?: unknown };

export type NormalisedHeroMutation =
  | { action: "add"; slot: HeroCollectionSlot; partIds: string[]; scope: "ids" | "filtered"; expectedCount: number | null }
  | { action: "remove"; slot: HeroCollectionSlot; partIds: string[]; scope: "ids" | "filtered"; expectedCount: number | null };

export function failHero(status: 400 | 404, error: string): { ok: false; status: 400 | 404; error: string } {
  return { ok: false, status, error };
}

function readFilters(raw: unknown) {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
  return { q: str(o.q), brand: str(o.brand), categoryId: str(o.categoryId) };
}

export type HeroFilters = ReturnType<typeof readFilters>;

export function validateHeroMutationRequest(
  body: HeroMutationRequest,
  action: "add" | "remove",
): { ok: true; value: NormalisedHeroMutation } | { ok: false; status: 400 | 404; error: string } {
  if (!isHeroCollectionSlot(body.slot)) {
    return failHero(404, "Unknown hero collection slot.");
  }

  const scope = body.scope === "filtered" ? "filtered" : "ids";

  if (scope === "filtered") {
    const raw = body.expectedCount;
    const expectedCount =
      typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : Number.NaN;
    if (!Number.isFinite(expectedCount) || expectedCount < 1) {
      return failHero(400, "A filtered change must state how many products it will affect.");
    }
    if (expectedCount > HERO_MAX_FILTERED_PART_IDS) {
      return failHero(
        400,
        `A filtered change is limited to ${HERO_MAX_FILTERED_PART_IDS} products. Narrow the filter, or select the products individually.`,
      );
    }
    if (expectedCount >= HERO_BULK_CONFIRM_THRESHOLD) {
      const confirm = body.confirmCount;
      if (typeof confirm !== "number" || Math.floor(confirm) !== expectedCount) {
        return failHero(
          400,
          `This affects ${expectedCount} products, so it is a bulk operation. Re-send with confirmCount: ${expectedCount} once the summary is confirmed.`,
        );
      }
    }
    return {
      ok: true,
      value: { action, slot: body.slot, partIds: [], scope, expectedCount },
    };
  }

  const raw = body.partIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return failHero(400, "Select at least one product.");
  }
  if (raw.length > HERO_MAX_EXPLICIT_PART_IDS) {
    return failHero(
      400,
      `Too many products in one request. The limit is ${HERO_MAX_EXPLICIT_PART_IDS}; use the filtered scope instead.`,
    );
  }
  const seen = new Set<string>();
  const partIds: string[] = [];
  for (const value of raw) {
    if (!isWellFormedHeroPartId(value)) {
      return failHero(400, "One or more product ids are not valid.");
    }
    const id = value.trim();
    if (seen.has(id)) {
      return failHero(400, "The same product was listed more than once.");
    }
    seen.add(id);
    partIds.push(id);
  }
  return { ok: true, value: { action, slot: body.slot, partIds, scope, expectedCount: null } };
}

export { readFilters as readHeroFilters };

/* ------------------------------------------------------------- inventory */

export type HeroSlotSummary = {
  slot: HeroCollectionSlot;
  label: string;
  enabled: boolean;
  count: number;
};

export function summariseHeroSlots(
  rows: ReadonlyArray<{ slot: HeroCollectionSlot; isEnabled: boolean; count: number }>,
): HeroSlotSummary[] {
  return HERO_SLOT_META.map((meta) => {
    const row = rows.find((r) => r.slot === meta.slot);
    return {
      slot: meta.slot,
      label: meta.label,
      enabled: row?.isEnabled ?? false,
      count: row?.count ?? 0,
    };
  });
}
