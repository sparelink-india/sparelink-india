import { NextRequest, NextResponse } from "next/server";
import { typesense } from "@/lib/typesense";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  if (!typesense) {
    return NextResponse.json(
      { error: "Search service is not configured" },
      { status: 503 },
    );
  }

  try {
    const results = await typesense
      .collections("parts")
      .documents()
      .search({
        q: query,
        query_by: "part_number,name,description,brand,category",
        query_by_weights: "5,4,2,3,2",
        per_page: 20,
      });

    return NextResponse.json({
      results: results.hits ?? [],
      found: results.found,
    });
  } catch (error) {
    console.error("Parts search failed:", error);

    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 },
    );
  }
}
