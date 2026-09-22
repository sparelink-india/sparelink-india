export type RecentlyViewedItem = {
  id: string;
  partNumber: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  viewedAt: number;
};

const STORAGE_KEY = "sparelink-recently-viewed";
const MAX_ITEMS = 12;

export function readRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyViewedItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string" && item.partNumber)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(item: Omit<RecentlyViewedItem, "viewedAt">) {
  if (typeof window === "undefined") return;
  try {
    const existing = readRecentlyViewed().filter((row) => row.id !== item.id);
    const next: RecentlyViewedItem[] = [
      { ...item, viewedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}
