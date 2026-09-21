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
        total = Number(payload.total ?? total ?? pageItems.length);

        for (const raw of pageItems) {
          if (!raw || typeof raw !== "object") continue;
          const mapped = mapCiApiProduct(raw as Record<string, unknown>);
          if (mapped) products.push(mapped);
        }

        pages += 1;
        if (!pageItems.length || payload.hasMore === false) break;
        offset = Number(payload.offset ?? offset) + pageItems.length;
        if (total != null && products.length >= total) break;
      }

      const fetchComplete =
        total == null ? products.length > 0 : products.length >= total || pages > 0;

      // If API returned zero pages successfully but claimed a positive total, incomplete.
      if (total != null && total > 0 && products.length === 0) {
        return {
          products,
          fetchComplete: false,
          errorSummary: "CI source returned empty catalogue while total > 0",
        };
      }

      return {
        products,
        fetchComplete: Boolean(fetchComplete),
        errorSummary: null,
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
