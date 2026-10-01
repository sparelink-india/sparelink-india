/**
 * Shared catalogue view state.
 *
 * WHY THIS IS ITS OWN MODULE. Three separate surfaces render a product
 * listing - the search results page, category pages, and the vehicle fitment
 * catalogue. They used to disagree: the search page rendered a table on
 * desktop, category pages rendered a two-column grid, and the fitment catalogue
 * rendered a different two-column grid again. There was no single answer to
 * "which view is this?", so a default could not be enforced in one place.
 *
 * The four modes are a PRESENTATION choice only. Changing mode never touches
 * the query, the filters, the sort, or the page number - those are owned by
 * each surface and are deliberately left alone here.
 *
 * The search autocomplete is NOT a consumer of this module. The dropdown has
 * its own compact row layout and must never inherit a catalogue view mode, so
 * nothing in `header-search.tsx` imports from here.
 *
 * PERSISTENCE. localStorage only, no database column, because the requirement
 * is a display preference and adding a field to the product or user model for
 * it would be the wrong trade. Every access is wrapped: this module is imported
 * by client components that also render on the server, where `localStorage`
 * does not exist, and where a browser may have it disabled and make it throw.
 */

export const CATALOGUE_VIEW_MODES = ["grid", "tiles", "list", "detailed"] as const;

export type CatalogueViewMode = (typeof CATALOGUE_VIEW_MODES)[number];

/**
 * GRID is the default for every catalogue listing surface.
 *
 * This is the value that makes "search Enter opens GRID" true, and it is the
 * single most important line in this file: change it and every listing changes
 * default at once.
 */
export const DEFAULT_CATALOGUE_VIEW: CatalogueViewMode = "grid";

export const CATALOGUE_VIEW_STORAGE_KEY = "sparelink.catalogueView";

export function isCatalogueViewMode(value: unknown): value is CatalogueViewMode {
  return (
    typeof value === "string" &&
    (CATALOGUE_VIEW_MODES as readonly string[]).includes(value)
  );
}

/**
 * The smallest storage surface this module needs. Declared structurally so the
 * module stays testable with a plain object, and so it never depends on the
 * DOM `Storage` type being present.
 */
type ViewStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserStorage(): ViewStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Safari private mode and hardened browser profiles throw on access.
    return null;
  }
}

/** Reads the stored preference, falling back to the default for anything odd. */
export function readStoredCatalogueView(
  storage: ViewStorage | null = browserStorage(),
): CatalogueViewMode {
  if (!storage) return DEFAULT_CATALOGUE_VIEW;
  let raw: string | null = null;
  try {
    raw = storage.getItem(CATALOGUE_VIEW_STORAGE_KEY);
  } catch {
    return DEFAULT_CATALOGUE_VIEW;
  }
  return isCatalogueViewMode(raw) ? raw : DEFAULT_CATALOGUE_VIEW;
}

/** Persists the preference. Failure is silent and never breaks the page. */
export function writeStoredCatalogueView(
  mode: CatalogueViewMode,
  storage: ViewStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CATALOGUE_VIEW_STORAGE_KEY, mode);
  } catch {
    // A full or unavailable quota must not break switching views.
  }
}

/**
 * Grid column counts per breakpoint.
 *
 * Desktop is 4 columns, which is a hard requirement rather than a preference.
 * The container that uses this is `grid grid-cols-2 md:grid-cols-3
 * lg:grid-cols-4`; keeping the numbers here means the "exactly 4 on desktop"
 * rule has one definition that tests can assert against, instead of a class
 * string buried in three components.
 */
export const CATALOGUE_GRID_COLUMNS = {
  mobile: 2,
  tablet: 3,
  desktop: 4,
} as const;

/* -------------------------------------------------------------------------- */
/* Subscribable store                                                           */
/* -------------------------------------------------------------------------- */
/*
 * The preference is an EXTERNAL store (localStorage), not React state, so it is
 * read with `useSyncExternalStore` rather than copied into `useState` from an
 * effect.
 *
 * That is not a style preference. Reading it in an effect means the first paint
 * always shows GRID and then corrects itself, which is a visible flash and a
 * `set-state-in-effect` violation. `useSyncExternalStore` handles the
 * server/client split properly: the server snapshot is the default, and React
 * re-reads the client snapshot after hydration, so there is no mismatch error
 * and no flash for a visitor who has genuinely chosen another view.
 *
 * Two tabs stay in step too, because every writer notifies the subscribers.
 */

const listeners = new Set<() => void>();

export function subscribeCatalogueView(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Client snapshot: the stored preference, or the default. */
export function getCatalogueViewSnapshot(): CatalogueViewMode {
  return readStoredCatalogueView();
}

/**
 * Server snapshot: always the default. localStorage does not exist during
 * server rendering, and returning anything else would guarantee a hydration
 * mismatch for every visitor who has picked a different view.
 */
export function getCatalogueViewServerSnapshot(): CatalogueViewMode {
  return DEFAULT_CATALOGUE_VIEW;
}

/** Persists the choice and notifies every mounted switcher. */
export function setCatalogueView(mode: CatalogueViewMode): void {
  writeStoredCatalogueView(mode);
  for (const listener of listeners) listener();
}
