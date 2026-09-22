import { evaluateCiFetchCompleteness } from "./fetch-complete";
import { mapCiApiProduct } from "./normalize";
import type { CiCatalogueFetcher, CiFetchResult } from "./run";
import type { CiSourceProduct } from "./types";

const DEFAULT_BASE = "https://onlineautohandles.com";
const DEFAULT_LIMIT = 120;
const MAX_PAGES = 200;

export type CiHttpFetcherOptions = {
  baseUrl?: string;
  limit?: number;
  /** Optional bearer/token from env — never hardcode secrets. */
  authHeader?: string | null;
  fetchImpl?: typeof fetch;
};

/**
 * Live CI / OnlineAutoHandles catalogue fetcher.
 * Uses the known public B2B products API shape. If the source is unavailable,
 * returns fetchComplete=false so sync never treats products as deleted.
 */
export function createCiHttpFetcher(options: CiHttpFetcherOptions = {}): CiCatalogueFetcher {
  const baseUrl = (options.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
  const limit = options.limit ?? DEFAULT_LIMIT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (): Promise<CiFetchResult> => {
    const products: CiSourceProduct[] = [];
    let offset = 0;
    let total: number | null = null;
    let pages = 0;
    let lastPageEmpty = false;
    let hasMore: boolean | null = null;
    let hitMaxPages = false;

    try {
      while (pages < MAX_PAGES) {
        const url = `${baseUrl}/api/b2b/products?offset=${offset}&limit=${limit}`;
        const headers: Record<string, string> = {
          Accept: "application/json",
          "User-Agent": "SpareLinkIndiaCiSync/1.0",
        };
        if (options.authHeader) {
          headers.Authorization = options.authHeader;
        }

        const response = await fetchImpl(url, { headers });
        if (!response.ok) {
          return {
            products,
            fetchComplete: false,
            errorSummary: `CI source HTTP ${response.status} at offset ${offset}`,
          };
        }

        const payload = (await response.json()) as {
          items?: unknown[];
          total?: number;
          offset?: number;
          hasMore?: boolean;
        };
        const pageItems = Array.isArray(payload.items) ? payload.items : [];
        if (typeof payload.total === "number" && Number.isFinite(payload.total)) {
          total = payload.total;
        } else if (total == null && pageItems.length === 0 && pages === 0) {
          total = 0;
        }

        for (const raw of pageItems) {
          if (!raw || typeof raw !== "object") continue;
          const mapped = mapCiApiProduct(raw as Record<string, unknown>);
          if (mapped) products.push(mapped);
        }

        pages += 1;
        lastPageEmpty = pageItems.length === 0;
        hasMore =
          typeof payload.hasMore === "boolean" ? payload.hasMore : null;

        if (!pageItems.length || payload.hasMore === false) break;
        offset = Number(payload.offset ?? offset) + pageItems.length;
        if (total != null && products.length >= total) break;

        if (pages >= MAX_PAGES) {
          hitMaxPages = true;
        }
      }

      // Loop exited because of MAX_PAGES without a clean end.
      if (pages >= MAX_PAGES && hasMore !== false && !(total != null && products.length >= total)) {
        hitMaxPages = true;
      }

      const completeness = evaluateCiFetchCompleteness({
        productsMapped: products.length,
        total,
        pagesFetched: pages,
        hitMaxPages,
        lastPageEmpty,
        hasMore,
      });

      return {
        products,
        fetchComplete: completeness.fetchComplete,
        errorSummary: completeness.errorSummary,
      };
    } catch (error) {
      return {
        products,
        fetchComplete: false,
        errorSummary: error instanceof Error ? error.message : "CI source fetch failed",
      };
    }
  };
}
