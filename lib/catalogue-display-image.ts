/**
 * Display helpers for catalogue images.
 * Prefer explicit thumbUrl / mediumUrl when APIs provide them.
 * Never invent derivative folders for paths that only have a primary URL —
 * broken thumbs would flash on every card before falling back.
 */
export function catalogueDisplayImageUrl(options: {
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  imageUrl?: string | null;
  size?: "thumb" | "medium" | "original";
}): string {
  const fallback = "/images/products/placeholder.svg";
  const size = options.size ?? "thumb";
  const thumb = options.thumbUrl?.trim() || "";
  const medium = options.mediumUrl?.trim() || "";
  const original = options.imageUrl?.trim() || "";

  if (size === "thumb") {
    return thumb || medium || original || fallback;
  }
  if (size === "medium") {
    return medium || thumb || original || fallback;
  }
  return original || medium || thumb || fallback;
}

export function catalogueImageFallbackChain(options: {
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  imageUrl?: string | null;
  size?: "thumb" | "medium";
}): string[] {
  const size = options.size ?? "thumb";
  const primary = catalogueDisplayImageUrl({ ...options, size });
  const medium = catalogueDisplayImageUrl({ ...options, size: "medium" });
  const original = catalogueDisplayImageUrl({ ...options, size: "original" });
  const chain = [primary, medium, original, "/images/products/placeholder.svg"];
  return [...new Set(chain.filter(Boolean))];
}
