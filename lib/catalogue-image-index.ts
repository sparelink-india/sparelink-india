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

/** Additional official images stored as SKU.2, SKU.3, … beside the primary SKU file. */
export function catalogueGalleryPublicPaths(sku: string): string[] {
  const safe = sanitizeCatalogueImageKey(sku.trim());
  if (!safe) return [];
  const index = loadCatalogueImageIndex();
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    const ext = index[key];
    if (typeof ext !== "string" || !ext.startsWith(".")) return;
    const url = `/catalogue-images/${encodeURIComponent(key)}${ext}`;
    if (seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };
  add(safe);
  for (let i = 2; i <= 12; i += 1) {
    add(`${safe}.${i}`);
    add(`${safe}_${i}`);
  }
  return urls;
}
