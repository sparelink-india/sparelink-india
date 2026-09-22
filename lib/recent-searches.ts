const STORAGE_KEY = "sparelink-recent-searches";
const MAX_ITEMS = 8;

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item || "").trim()).filter(Boolean))].slice(
      0,
      MAX_ITEMS,
    );
  } catch {
    return [];
  }
}

export function rememberSearch(query: string): string[] {
  const next = query.trim();
  if (!next || typeof window === "undefined") return readRecentSearches();
  const items = [next, ...readRecentSearches().filter((item) => item.toLowerCase() !== next.toLowerCase())].slice(
    0,
    MAX_ITEMS,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items;
}
