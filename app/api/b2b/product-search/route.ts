import { NextRequest, NextResponse } from "next/server";
import { loadActiveListingsByPartNumbers } from "@/lib/b2b-listings";
import { requireAdminOrDealerApi } from "@/lib/require-role";

type SearchHit = {
  document?: {
    part_number?: string;
    name?: string;
    id?: string;
    [key: string]: unknown;
  };
  partNumber?: string;
  part_number?: string;
  [key: string]: unknown;
};

function hitPartNumber(hit: SearchHit): string {
  return String(
    hit.document?.part_number ?? hit.partNumber ?? hit.part_number ?? "",
  ).trim();
}

async function handleSearch(request: NextRequest, q: string) {
  const access = await requireAdminOrDealerApi();
  if ("error" in access) return access.error;

  if (!q) {
    return NextResponse.json({ hits: [], q: "" });
  }

  const searchUrl = new URL("/api/search/parts", request.url);
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("perPage", "20");

  const cookie = request.headers.get("cookie") ?? "";
  const searchRes = await fetch(searchUrl.toString(), {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  if (!searchRes.ok) {
    return NextResponse.json(
      { error: "Search failed", status: searchRes.status },
      { status: 502 },
    );
  }

  const data = (await searchRes.json()) as { results?: SearchHit[] };
  const hits = data.results ?? [];
  const partNumbers = hits.map(hitPartNumber).filter(Boolean);
  const listingMap = await loadActiveListingsByPartNumbers(partNumbers);

  const enriched = hits.map((hit) => {
    const partNumber = hitPartNumber(hit);
    const listing = partNumber ? listingMap.get(partNumber) : null;
    // Strip storefront listing payloads; expose only B2B-safe selling fields.
    const { listings: _drop, ...rest } = hit as SearchHit & {
      listings?: unknown;
    };
    return {
      ...rest,
      partNumber: partNumber || null,
      name: hit.document?.name ?? null,
      listing: listing
        ? {
            listingId: listing.id,
            pricePaise: listing.pricePaise,
            stock: listing.stock ?? 0,
            firmId: listing.firmId,
            partName: listing.partName,
            sku: listing.sku,
          }
        : null,
    };
  });

  return NextResponse.json({ q, hits: enriched });
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  return handleSearch(request, q);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const q =
    body && typeof body.q === "string"
      ? body.q.trim()
      : request.nextUrl.searchParams.get("q")?.trim() ?? "";
  return handleSearch(request, q);
}
