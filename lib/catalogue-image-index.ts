import { readFileSync } from "fs";
import path from "path";

function sanitizeCatalogueImageKey(sku: string): string {
  return sku.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/** Public CDN origin for catalogue rasters (no trailing slash). Empty = same-origin relative paths. */
function catalogueImageOrigin(): string {
  return String(process.env.CATALOGUE_IMAGE_ORIGIN || "")
    .trim()
    .replace(/\/+$/, "");
}

function withCatalogueImageOrigin(publicPath: string): string {
  const origin = catalogueImageOrigin();
  return origin ? `${origin}${publicPath}` : publicPath;
}

let cachedIndex: Record<string, string> | null = null;

function loadCatalogueImageIndex(): Record<string, string> {
  if (cachedIndex) return cachedIndex;
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "data", "catalogue-image-index.json"),
      "utf8",
    );
    cachedIndex = JSON.parse(raw) as Record<string, string>;
  } catch {
    cachedIndex = {};
  }
  return cachedIndex;
}

function indexExt(key: string): string | null {
  const ext = loadCatalogueImageIndex()[key];
  return typeof ext === "string" && ext.startsWith(".") ? ext : null;
}

/**
 * Resolve the catalogue-image-index key for a SKU.
 * Exact sanitized key wins. Narrow fallbacks only when that key is absent:
 * 1) strip a trailing letter suffix separated by whitespace/underscore
 * 2) first token before `/`
 * Never invent keys that are not already in the index.
 */
function resolveCatalogueImageKey(sku: string): string | null {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const exact = sanitizeCatalogueImageKey(trimmed);
  if (exact && indexExt(exact)) return exact;

  // Trailing letter suffix: "M-644 A" / "M-644_A" → "M-644" (not "00110L")
  const letterStripped = trimmed.replace(/[\s_]+[A-Za-z]$/u, "").trim();
  if (letterStripped && letterStripped !== trimmed) {
    const key = sanitizeCatalogueImageKey(letterStripped);
    if (key && indexExt(key)) return key;
  }
  if (/_[A-Za-z]$/.test(exact)) {
    const key = exact.replace(/_[A-Za-z]$/, "");
    if (key && indexExt(key)) return key;
  }

  // Compound SKU: "M-650 / M-603 A" → try "M-650" (then letter-strip on that token)
  if (trimmed.includes("/")) {
    const first = trimmed.split("/")[0]?.trim() || "";
    if (first) {
      const firstExact = sanitizeCatalogueImageKey(first);
      if (firstExact && indexExt(firstExact)) return firstExact;
      const firstLetterStripped = first.replace(/[\s_]+[A-Za-z]$/u, "").trim();
      if (firstLetterStripped && firstLetterStripped !== first) {
        const key = sanitizeCatalogueImageKey(firstLetterStripped);
        if (key && indexExt(key)) return key;
      }
    }
  }

  return null;
}

export function getCatalogueImageExt(sku: string): string | null {
  const key = resolveCatalogueImageKey(sku);
  if (!key) return null;
  return indexExt(key);
}

export function catalogueImagePublicPath(sku: string): string | null {
  const key = resolveCatalogueImageKey(sku);
  if (!key) return null;
  const ext = indexExt(key);
  if (!ext) return null;
  return withCatalogueImageOrigin(
    `/catalogue-images/${encodeURIComponent(key)}${ext}`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Additional official images stored as SKU.2, SKU.3, … beside the primary SKU file. */
export function catalogueGalleryPublicPaths(sku: string): string[] {
  const safe = resolveCatalogueImageKey(sku);
  if (!safe) return [];
  const index = loadCatalogueImageIndex();
  const extra = new RegExp(`^${escapeRegExp(safe)}(?:\\.\\d+|_\\d+)$`, "i");
  const keys = Object.keys(index)
    .filter((key) => key === safe || extra.test(key))
    .sort((a, b) => {
      if (a === safe) return -1;
      if (b === safe) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const ext = index[key];
    if (typeof ext !== "string" || !ext.startsWith(".")) continue;
    const url = withCatalogueImageOrigin(
      `/catalogue-images/${encodeURIComponent(key)}${ext}`,
    );
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}
