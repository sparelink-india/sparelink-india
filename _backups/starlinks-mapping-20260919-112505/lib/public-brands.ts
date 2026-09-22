export type PublicBrandRelationship = "distributor" | "trader";

export type PublicBrand = {
  id: string;
  name: string;
  logo: string;
  relationship: PublicBrandRelationship;
  searchQuery: string;
};

/**
 * Customer-facing brand identities to hide from filters/lists.
 * Exact brand-name match only — does not strip "CE" from specs/certifications.
 */
export const CUSTOMER_HIDDEN_BRAND_NAMES = ["CE", "OAE"] as const;

function normalizeBrandKey(value: string): string {
  return value.trim().toLowerCase();
}

const HIDDEN_BRAND_KEYS = new Set(
  CUSTOMER_HIDDEN_BRAND_NAMES.map((name) => normalizeBrandKey(name)),
);

export function isCustomerVisibleCatalogueBrand(brand: string | null | undefined): boolean {
  if (!brand) return false;
  const key = normalizeBrandKey(brand);
  if (!key) return false;
  return !HIDDEN_BRAND_KEYS.has(key);
}

/**
 * Official public Brands presentation only.
 * Catalogue / Typesense brand records are not derived from this list.
 */
export const PUBLIC_BRANDS: readonly PublicBrand[] = [
  {
    id: "01",
    name: "CI Automotive",
    logo: "/images/brands/01.png",
    relationship: "distributor",
    searchQuery: "CI AUTOMOTIVE LLP",
  },
  {
    id: "meko",
    name: "MEKO",
    logo: "/images/brands/meko.jpg",
    relationship: "distributor",
    searchQuery: "MEKO",
  },
  {
    id: "starlinks",
    name: "STARLINKS",
    logo: "/images/brands/starlinks.jpeg",
    relationship: "distributor",
    searchQuery: "STARLINKS",
  },
  {
    id: "03",
    name: "ONE",
    logo: "/images/brands/03.png",
    relationship: "distributor",
    searchQuery: "ONE",
  },
  {
    id: "pensol",
    name: "Pensol",
    logo: "/images/brands/pensol.png",
    relationship: "distributor",
    searchQuery: "Pensol",
  },
  {
    id: "superseal",
    name: "Super Seal",
    logo: "/images/brands/superseal.png",
    relationship: "distributor",
    searchQuery: "Super Seal",
  },
  {
    id: "menon-brakes",
    name: "Menon Brakes",
    logo: "/images/brands/menon-brakes.png",
    relationship: "distributor",
    searchQuery: "Menon Brakes",
  },
  {
    id: "shivaji-industries",
    name: "Shivaji Industries / Sippy",
    logo: "/images/brands/shivaji-industries.png",
    relationship: "trader",
    searchQuery: "Sippy",
  },
  {
    id: "akar",
    name: "Akar",
    logo: "/images/brands/akar.png",
    relationship: "distributor",
    searchQuery: "Akar",
  },
] as const;
