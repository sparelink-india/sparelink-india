import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { catalogueImagePublicPath } from "@/lib/catalogue-image-index";

type OfferRecord = {
  partId?: string;
  partNumber?: string;
  name?: string;
  imageUrl?: string | null;
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
      offers: offers.map((offer) => ({
        ...offer,
        imageUrl: offer.partNumber
          ? catalogueImagePublicPath(offer.partNumber)
          : null,
      })),
    });
  } catch {
    return NextResponse.json({ offers: [] });
  }
}
