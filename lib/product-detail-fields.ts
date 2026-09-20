const MIN_360_FRAMES = 12;

const SPEC_SKIP_KEYS = new Set([
  "manufacturer",
  "source",
  "source_url",
  "official_image_url",
  "official_image_urls",
  "catalogue_image",
  "gallery_images",
  "application",
  "compatible_with",
  "reference_nos",
  "reference_no",
  "oem",
  "oem_unavailable",
  "subcategory",
  "vehicle_groups",
  "vehicle_types",
  "vehicle_brands",
  "fulfilled_by",
  "source_published_price_ignored",
  "gst",
  "moq",
  "uom",
  "hsn",
  "warranty",
  "warranty_months",
]);

const SPEC_LABELS: Record<string, string> = {
  pulley_holes: "Pulley Holes",
  pcd: "P.C.D.",
  fan_mounting_dia: "Fan Mounting Diameter",
  fan_mounting_diameter: "Fan Mounting Diameter",
  type: "Type",
  weight: "Weight",
  dimensions: "Dimensions",
  size: "Size",
  material: "Material",
  package_contents: "Package Contents",
  thread: "Thread",
  displacement: "Displacement",
  capacity: "Capacity",
  viscosity: "Viscosity",
  grade: "Grade",
  color: "Colour",
  colour: "Colour",
  length: "Length",
  width: "Width",
  height: "Height",
  diameter: "Diameter",
  voltage: "Voltage",
  wattage: "Wattage",
};

export function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function splitReferenceList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return uniqueNonEmpty(raw.split(/[,|;/]+/));
}

export function flattenReferenceValues(values: Array<string | null | undefined>): string[] {
  return uniqueNonEmpty(values.flatMap((value) => splitReferenceList(value)));
}

export function displayProductTitle(name: string, partNumber?: string | null): string {
  let title = name.replace(/\s+/g, " ").trim();
  const pn = (partNumber || "").trim();
  if (!title) return pn;
  if (!pn) return title;
  const escaped = pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  title = title
    .replace(new RegExp(`\\s*[\\(\\[]\\s*${escaped}\\s*[\\)\\]]\\s*$`, "i"), "")
    .replace(new RegExp(`\\s+${escaped}\\s*$`, "i"), "")
    .trim();
  return title || name.replace(/\s+/g, " ").trim();
}

export function shouldShowDescription(
  description: string | null | undefined,
  title: string,
  partNumber?: string | null,
): boolean {
  const text = (description || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const compact = text.toLowerCase();
  const titleKey = title.trim().toLowerCase();
  const pn = (partNumber || "").trim().toLowerCase();
  if (compact === titleKey) return false;
  if (pn && compact === `${titleKey} (${pn})`) return false;
  if (pn && compact === `${titleKey} ${pn}`) return false;
  if (/https?:\/\//i.test(text)) return false;
  if ((text.match(/\|/g) || []).length >= 2 && /ref\.?\s*nos?|official website/i.test(text)) return false;
  return true;
}

export function excludeKnownIds(
  values: string[],
  ...known: Array<string | null | undefined>
): string[] {
  const skip = new Set(
    known
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean),
  );
  return values.filter((value) => !skip.has(value.toLowerCase()));
}

export function isGenuine360Sequence(imageUrls: string[]): boolean {
  if (imageUrls.length < MIN_360_FRAMES) return false;
  const files = imageUrls.map((url) =>
    decodeURIComponent((url.split("?")[0].split("/").pop() || "")).toLowerCase(),
  );
  const tagged = files.filter((name) =>
    /(^|[._-])(360|spin|turntable|frame)([._-]|$)/i.test(name),
  );
  if (tagged.length >= MIN_360_FRAMES) return true;

  const seq = files
    .map((name) => {
      const match = name.match(/[._-](\d{2,3})\.[a-z0-9]+$/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null);
  const unique = [...new Set(seq)].sort((a, b) => a - b);
  if (unique.length < MIN_360_FRAMES) return false;
  const span = unique[unique.length - 1] - unique[0] + 1;
  return span <= unique.length + 2;
}

export type ProductSpecCard = {
  label: string;
  value: string;
};

function humanizeSpecKey(key: string): string {
  if (SPEC_LABELS[key]) return SPEC_LABELS[key];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stringifySpecValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const items = uniqueNonEmpty(value.map((item) => String(item)));
    return items.length ? items.join(" · ") : null;
  }
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text) return null;
    if (/^https?:\/\//i.test(text)) return null;
    return text;
  }
  return null;
}

export function extractSpecificationEntries(
  spec: Record<string, unknown> | null | undefined,
): ProductSpecCard[] {
  if (!spec) return [];
  const cards: ProductSpecCard[] = [];
  const seen = new Set<string>();
  for (const [rawKey, rawValue] of Object.entries(spec)) {
    const key = rawKey.trim().toLowerCase();
    if (!key || SPEC_SKIP_KEYS.has(key)) continue;
    if (!(key in SPEC_LABELS) && !/^(type|weight|dimensions|size|material|thread|grade|viscosity|capacity|voltage|wattage|diameter|length|width|height|color|colour|package_contents)$/.test(key)) {
      continue;
    }
    const value = stringifySpecValue(rawValue);
    if (!value) continue;
    const label = humanizeSpecKey(key);
    const dedupe = `${label.toLowerCase()}::${value.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    cards.push({ label, value });
  }
  return cards;
}

export function collectCompatibility(input: {
  vehicles?: string[];
  vehicleBrands?: string[];
  vehicleTypes?: string[];
  compatibleWith?: string | null;
  title?: string | null;
  partNumber?: string | null;
}): string[] {
  const title = (input.title || "").replace(/\s+/g, " ").trim().toLowerCase();
  const partNumber = (input.partNumber || "").trim().toLowerCase();
  const values = uniqueNonEmpty([
    ...(input.vehicles || []),
    ...(input.vehicleBrands || []),
    ...(input.vehicleTypes || []),
  ]);
  const application = (input.compatibleWith || "").replace(/\s+/g, " ").trim();
  if (application) {
    const key = application.toLowerCase();
    if (key !== title && key !== partNumber && key !== `${title} (${partNumber})`) {
      values.push(application);
    }
  }
  return uniqueNonEmpty(values);
}

export function formatVehicleFitment(input: {
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  yearFrom?: Date | string | null;
  yearTo?: Date | string | null;
}): string {
  const core = [input.make, input.model, input.variant].filter(Boolean).join(" ");
  const from = yearLabel(input.yearFrom);
  const to = yearLabel(input.yearTo);
  if (!from && !to) return core;
  if (from && to && from !== to) return `${core} (${from}–${to})`.trim();
  return `${core} (${from || to})`.trim();
}

function yearLabel(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getUTCFullYear());
}

export function buildProductSpecCards(input: {
  partNumber?: string | null;
  brand?: string | null;
  category?: string | null;
  oemNumber?: string | null;
  references?: string[];
  vehicles?: string[];
  warrantyMonths?: number | null;
  hsn?: string | null;
  moq?: string | number | null;
  uom?: string | null;
  hideBrand?: boolean;
  hideCategory?: boolean;
  includeLongFields?: boolean;
}): ProductSpecCard[] {
  const cards: ProductSpecCard[] = [];
  const partNumber = (input.partNumber || "").trim();
  const brand = (input.brand || "").trim();
  const category = (input.category || "").trim();
  const oemParts = excludeKnownIds(
    uniqueNonEmpty(String(input.oemNumber || "").split(/\s*(?:[·|,;|/])\s*/)),
    partNumber,
  );
  const references = excludeKnownIds(
    uniqueNonEmpty(input.references || []),
    partNumber,
    ...oemParts,
  );
  const vehicles = uniqueNonEmpty(input.vehicles || []);
  const includeLong = input.includeLongFields !== false;

  if (partNumber) cards.push({ label: "Part No.", value: partNumber });
  if (brand && !input.hideBrand) cards.push({ label: "Brand", value: brand });
  if (category && !input.hideCategory && category.toLowerCase() !== brand.toLowerCase()) {
    cards.push({ label: "Category", value: category });
  }
  if (includeLong && vehicles.length) {
    cards.push({ label: "Compatible With", value: vehicles.join(", ") });
  }
  if (includeLong && oemParts.length) cards.push({ label: "OEM Part No.", value: oemParts.join(" · ") });
  if (includeLong && references.length) {
    cards.push({ label: "Reference Nos.", value: references.join(" · ") });
  }
  if (input.warrantyMonths && input.warrantyMonths > 0) {
    cards.push({
      label: "Warranty",
      value: `${input.warrantyMonths} month${input.warrantyMonths === 1 ? "" : "s"}`,
    });
  }
  const hsn = String(input.hsn ?? "").trim();
  if (hsn) cards.push({ label: "HSN", value: hsn });
  if (input.moq != null && String(input.moq).trim()) {
    cards.push({ label: "MOQ", value: String(input.moq).trim() });
  }
  if (input.uom != null && String(input.uom).trim()) {
    cards.push({ label: "UOM", value: String(input.uom).trim() });
  }
  return cards;
}
