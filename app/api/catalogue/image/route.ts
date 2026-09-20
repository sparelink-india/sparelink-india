import { NextRequest, NextResponse } from "next/server";

import { catalogueImagePublicPath } from "@/lib/catalogue-image-index";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sku = String(request.nextUrl.searchParams.get("sku") || "").trim();
  if (!sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const publicPath = catalogueImagePublicPath(sku);
  if (!publicPath) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(publicPath, request.nextUrl.origin), {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
