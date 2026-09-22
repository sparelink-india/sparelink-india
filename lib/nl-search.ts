/**
 * Deterministic natural-language / Hinglish query normalization.
 * Never invents products, prices, stock, or compatibility — only rewrites
 * query tokens into catalogue-friendly English terms for Typesense retrieval.
 */

export type NlSide = "left" | "right" | null;
export type NlPosition = "front" | "rear" | null;

export type NaturalLanguageIntent = {
  originalQuery: string;
  normalizedQuery: string;
  fillerRemoved: boolean;
  side: NlSide;
  position: NlPosition;
  brandHints: string[];
  vehicleHints: string[];
  productHints: string[];
  quantity: number | null;
  viscosityHints: string[];
};

/** Hinglish / Hindi filler words that carry no catalogue meaning. */
const FILLERS = new Set([
  "ka",
  "ki",
  "ke",
  "ko",
  "se",
  "mein",
  "me",
  "mai",
  "mujhe",
  "muje",
  "mere",
  "mera",
  "meri",
  "chahiye",
  "chahie",
  "chaiye",
  "please",
  "pls",
  "for",
  "the",
  "a",
  "an",
  "of",
  "and",
  "ya",
  "aur",
  "hai",
  "hain",
  "ho",
  "wala",
  "wali",
  "wale",
]);

/** Safe synonym map — catalogue concepts only, never vehicle fitment claims. */
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  pani: ["water"],
  paani: ["water"],
  pump: ["pump"],
  handle: ["handle", "door handle"],
  door: ["door"],
  regulator: ["window regulator", "regulator"],
  window: ["window"],
  oil: ["oil"],
  filter: ["filter"],
  brake: ["brake"],
  lining: ["lining"],
  clutch: ["clutch"],
  mirror: ["mirror"],
  cable: ["cable"],
  gasket: ["gasket"],
  bearing: ["bearing"],
};

const SIDE_TOKENS: Record<string, NlSide> = {
  left: "left",
  lh: "left",
  "left-hand": "left",
  right: "right",
  rh: "right",
  "right-hand": "right",
};

const POSITION_TOKENS: Record<string, NlPosition> = {
  front: "front",
  fr: "front",
  frt: "front",
  rear: "rear",
  rr: "rear",
  back: "rear",
};

/** Common brand tokens present in SpareLink catalogues (explicit allow-list). */
const KNOWN_BRANDS = [
  "pensol",
  "meko",
  "menon",
  "starlinks",
  "ci",
  "oah",
];

/** Common vehicle/model tokens used as context filters only. */
const KNOWN_VEHICLES = [
  "bolero",
  "swift",
  "altroz",
  "nexon",
  "scorpio",
  "xylo",
  "thar",
  "alto",
  "wagonr",
  "dzire",
  "ertiga",
  "innova",
  "fortuner",
  "creta",
  "venue",
  "i20",
  "amaze",
  "city",
  "tata",
  "maruti",
  "mahindra",
  "hyundai",
  "honda",
  "toyota",
];

const VISCOSITY_RE = /\b(\d{1,2}\s*w\s*[-]?\s*\d{2})\b/i;
const QUANTITY_RE = /\b(\d{1,3})\s*(ltr|litre|liter|liters|litres|pcs|pc|piece|pieces|nos|no|qty)?\b/i;

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[.]/g, " ")
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function expandProductToken(token: string): string[] {
  const mapped = PRODUCT_SYNONYMS[token];
  if (!mapped) return [token];
  return mapped;
}

/**
 * Normalize a customer natural-language / Hinglish query into a Typesense-friendly
 * English query string plus structured hints. Does not invent catalogue attributes.
 */
export function parseNaturalLanguageIntent(query: string): NaturalLanguageIntent {
  const originalQuery = query.trim();
  const viscosityHints: string[] = [];
  const viscosityMatch = originalQuery.match(VISCOSITY_RE);
  if (viscosityMatch) {
    viscosityHints.push(viscosityMatch[1].replace(/\s+/g, "").toUpperCase());
  }

  let quantity: number | null = null;
  const qtyMatch = originalQuery.match(QUANTITY_RE);
  if (qtyMatch && qtyMatch[2]) {
    const n = Number(qtyMatch[1]);
    if (Number.isFinite(n) && n > 0 && n < 1000) quantity = n;
  }

  const tokens = tokenize(originalQuery);
  const brandHints: string[] = [];
  const vehicleHints: string[] = [];
  const productHints: string[] = [];
  const outTokens: string[] = [];
  let fillerRemoved = false;
  let side: NlSide = null;
  let position: NlPosition = null;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (FILLERS.has(token)) {
      fillerRemoved = true;
      continue;
    }

    if (SIDE_TOKENS[token]) {
      side = SIDE_TOKENS[token];
      outTokens.push(side);
      continue;
    }
    if (POSITION_TOKENS[token]) {
      position = POSITION_TOKENS[token];
      outTokens.push(position);
      continue;
    }

    if (KNOWN_BRANDS.includes(token)) {
      brandHints.push(token);
      outTokens.push(token);
      continue;
    }
    if (KNOWN_VEHICLES.includes(token)) {
      vehicleHints.push(token);
      outTokens.push(token);
      continue;
    }

    // "pani pump" / "paani pump" → water pump
    if ((token === "pani" || token === "paani") && tokens[i + 1] === "pump") {
      productHints.push("water pump");
      outTokens.push("water", "pump");
      i += 1;
      continue;
    }

    // "door handle"
    if (token === "door" && tokens[i + 1] === "handle") {
      productHints.push("door handle");
      outTokens.push("door", "handle");
      i += 1;
      continue;
    }

    // "window regulator"
    if (token === "window" && tokens[i + 1] === "regulator") {
      productHints.push("window regulator");
      outTokens.push("window", "regulator");
      i += 1;
      continue;
    }

    const expanded = expandProductToken(token);
    if (expanded.length > 1 || PRODUCT_SYNONYMS[token]) {
      productHints.push(expanded.join(" "));
    }
    outTokens.push(...expanded);
  }

  // Re-inject viscosity in canonical form for Typesense
  for (const v of viscosityHints) {
    if (!outTokens.some((t) => t.replace(/\s+/g, "").toLowerCase() === v.toLowerCase())) {
      outTokens.push(v.toLowerCase());
    }
  }

  const normalizedQuery = outTokens.join(" ").replace(/\s+/g, " ").trim() || originalQuery;

  return {
    originalQuery,
    normalizedQuery,
    fillerRemoved,
    side,
    position,
    brandHints: [...new Set(brandHints)],
    vehicleHints: [...new Set(vehicleHints)],
    productHints: [...new Set(productHints)],
    quantity,
    viscosityHints,
  };
}

/** True when the query looks like free-form language rather than a bare part number. */
export function looksLikeNaturalLanguageQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/^[0-9A-Za-z][0-9A-Za-z.,/_-]{0,32}$/.test(trimmed) && /\d/.test(trimmed)) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if ([...FILLERS].some((f) => new RegExp(`(?:^|\\s)${f}(?:\\s|$)`).test(lower))) {
    return true;
  }
  if (/\s/.test(trimmed)) return true;
  return KNOWN_VEHICLES.some((v) => lower.includes(v)) || KNOWN_BRANDS.some((b) => lower.includes(b));
}
