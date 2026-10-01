/**
 * Brand DISPLAY names, in Hindi.
 *
 * PART D, and the important part of this file is what it does NOT do.
 *
 * A brand is a proper noun and also a data identifier. `PUBLIC_BRANDS[].name`
 * and `PUBLIC_BRANDS[].searchQuery` are what the database stores, what Typesense
 * matched on, and what the catalogue links use. NONE of that is translated,
 * renamed, slugged or "corrected" here. This module is presentation only: it
 * takes a brand identifier and returns the string to SHOW.
 *
 * So:
 *   - `getBrandDisplayName("Pensol", "hi")` -> the Devanagari label
 *   - `getBrandDisplayName("Pensol", "en")` -> "Pensol", unchanged
 *   - a brand with no Hindi label                          -> the original name
 *
 * That last rule is the safety net. An unmapped brand falls back to its real
 * name rather than to a transliteration guessed at build time, so this file can
 * never invent a brand, and a missing translation degrades to the truthful
 * English proper noun rather than to something wrong.
 *
 * Keys are matched case-insensitively against the brand id, name and search
 * query, so callers can pass whichever they already hold.
 */

import { PUBLIC_BRANDS } from "@/lib/public-brands";
import type { PublicBrandRelationship } from "@/lib/public-brands";

/**
 * Brand id -> Hindi display name.
 *
 * Transliterations, not translations: a brand's Devanagari form is how that
 * brand is written, not a description of it. Deliberately limited to the nine
 * brands in PUBLIC_BRANDS; anything absent falls back to the original.
 */
const BRAND_NAME_HI: Readonly<Record<string, string>> = {
  "01": "सीआई ऑटोमोटिव",
  meko: "मेको",
  starlinks: "स्टारलिंक्स",
  "03": "वन",
  pensol: "पेंसॉल",
  superseal: "सुपर सील",
  "menon-brakes": "मेनन ब्रेक्स",
  "shivaji-industries": "शिवाजी इंडस्ट्रीज़ / सिप्पी",
  akar: "अकार",
};

/** Business relationship labels. These are descriptions, so they translate. */
const RELATIONSHIP_HI: Readonly<Record<PublicBrandRelationship, string>> = {
  distributor: "वितरक",
  trader: "व्यापारी",
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The name to display for a brand. English is the default and is returned
 * byte-for-byte, so switching to English can never alter a brand.
 */
export function getBrandDisplayName(
  brand: string | null | undefined,
  locale: string,
): string {
  const original = (brand ?? "").trim();
  if (!original) return "";
  if (locale !== "hi") return original;

  const key = normalize(original);
  if (BRAND_NAME_HI[key]) return BRAND_NAME_HI[key];

  // Fall back to matching the configured list, so a catalogue brand string that
  // differs in case or spacing from the config still resolves.
  const match = PUBLIC_BRANDS.find(
    (item) =>
      normalize(item.id) === key ||
      normalize(item.name) === key ||
      normalize(item.searchQuery) === key,
  );
  return (match && BRAND_NAME_HI[match.id]) || original;
}

/** Distributor / Trader, localised. */
export function getBrandRelationshipLabel(
  relationship: PublicBrandRelationship,
  locale: string,
): string {
  if (locale !== "hi") {
    return relationship === "distributor" ? "Distributor" : "Trader";
  }
  return RELATIONSHIP_HI[relationship];
}

/** Exposed so a test can assert coverage without reaching into internals. */
export const BRAND_DISPLAY_NAME_IDS = Object.keys(BRAND_NAME_HI);
