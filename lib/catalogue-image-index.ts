import { readFileSync } from "fs";
import path from "path";

function sanitizeCatalogueImageKey(sku: string): string {
  return sku.replace(/[^A-Za-z0-9._-]+/g, "_");
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

export function getCatalogueImageExt(sku: string): string | null {
  const safe = sanitizeCatalogueImageKey(sku.trim());
  if (!safe) return null;
  const ext = loadCatalogueImageIndex()[safe];
  return typeof ext === "string" && ext.startsWith(".") ? ext : null;
}

export function catalogueImagePublicPath(sku: string): string | null {
  const safe = sanitizeCatalogueImageKey(sku.trim());
  const ext = getCatalogueImageExt(sku);
  if (!safe || !ext) return null;
  return `/catalogue-images/${encodeURIComponent(safe)}${ext}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Additional official images stored as SKU.2, SKU.3, … beside the primary SKU file. */
export function catalogueGalleryPublicPaths(sku: string): string[] {
  const safe = sanitizeCatalogueImageKey(sku.trim());
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
    const url = `/catalogue-images/${encodeURIComponent(key)}${ext}`;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}
