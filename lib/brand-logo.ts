import { PUBLIC_BRANDS } from "@/lib/public-brands";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns the same public Brands-section logo used for a catalogue brand,
 * or null when no official asset is registered.
 */
export function getBrandLogo(brand: string | null | undefined): string | null {
  const key = normalize(brand || "");
  if (!key) return null;

  for (const item of PUBLIC_BRANDS) {
    if (
      normalize(item.searchQuery) === key ||
      normalize(item.name) === key ||
      normalize(item.id) === key
    ) {
      return item.logo;
    }
  }

  if (key.includes("ci automotive") || key === "ci") return "/images/brands/01.png";
  if (key.includes("starlink")) return "/images/brands/starlinks.png";
  if (key.includes("meko")) return "/images/brands/meko.jpg";
  if (key.includes("pensol")) return "/images/brands/pensol.png";
  if (key.includes("menon")) return "/images/brands/menon-brakes.png";
  if (key.includes("super seal") || key.includes("superseal")) return "/images/brands/superseal.png";
  if (key.includes("akar")) return "/images/brands/akar.png";
  if (key.includes("sippy") || key.includes("shivaji")) {
    return "/images/brands/shivaji-industries.png";
  }
  if (key === "one") return "/images/brands/03.png";
  return null;
}
