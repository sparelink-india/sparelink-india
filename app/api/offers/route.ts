import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { catalogueImageUrls } from "@/lib/catalogue-image-index";

type OfferRecord = {
  partId?: string;
  partNumber?: string;
  name?: string;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  regularPricePaise?: number | null;
  offerPricePaise?: number | null;
  listingId?: string | null;
};

export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "special-offers.json");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { offers?: OfferRecord[] };
    const offers = Array.isArray(parsed.offers) ? parsed.offers : [];
    return NextResponse.json({
      offers: offers.map((offer) => {
        const images = offer.partNumber ? catalogueImageUrls(offer.partNumber) : null;
        return {
          ...offer,
          imageUrl: images?.imageUrl ?? null,
          thumbUrl: images?.thumbUrl ?? null,
          mediumUrl: images?.mediumUrl ?? null,
        };
      }),
    });
  } catch {
    return NextResponse.json({ offers: [] });
  }
}
