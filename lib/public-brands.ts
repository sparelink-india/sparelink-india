export type PublicBrandRelationship = "distributor" | "trader";

export type PublicBrand = {
  id: string;
  name: string;
  logo: string;
  relationship: PublicBrandRelationship;
  searchQuery: string;
};

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
    id: "02",
    name: "CE",
    logo: "/images/brands/02.png",
    relationship: "distributor",
    searchQuery: "CE",
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
