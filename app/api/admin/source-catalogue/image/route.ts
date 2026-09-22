import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  catalogueImagePublicPath,
  catalogueMediumPublicPath,
  catalogueThumbPublicPath,
} from "@/lib/catalogue-image-index";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sku = String(request.nextUrl.searchParams.get("sku") || "").trim();
  if (!sku) {
    return NextResponse.json({ error: "sku is required" }, { status: 400 });
  }

  const variant = String(request.nextUrl.searchParams.get("variant") || "thumb")
    .trim()
    .toLowerCase();

  let publicPath: string | null = null;
  if (variant === "original" || variant === "full") {
    publicPath = catalogueImagePublicPath(sku);
  } else if (variant === "medium") {
    publicPath = catalogueMediumPublicPath(sku) || catalogueImagePublicPath(sku);
  } else {
    publicPath = catalogueThumbPublicPath(sku) || catalogueImagePublicPath(sku);
  }

  if (!publicPath) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  return NextResponse.redirect(new URL(publicPath, request.nextUrl.origin), {
    status: 307,
    headers: {
      "Cache-Control": "private, max-age=3600",
    },
  });
}
