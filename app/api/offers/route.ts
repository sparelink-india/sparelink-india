import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

type OfferRecord = {
  partId?: string;
  partNumber?: string;
  name?: string;
  imageUrl?: string | null;
  regularPricePaise?: number | null;
  offerPricePaise?: number | null;
};

export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "special-offers.json");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { offers?: OfferRecord[] };
    return NextResponse.json({ offers: Array.isArray(parsed.offers) ? parsed.offers : [] });
  } catch {
    return NextResponse.json({ offers: [] });
  }
}
