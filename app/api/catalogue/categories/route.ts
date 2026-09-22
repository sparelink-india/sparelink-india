import { NextResponse } from "next/server";

import { loadCategoryNav } from "@/lib/load-category-nav";

export async function GET() {
  try {
    const { categories, groups, coverage } = await loadCategoryNav();
    return NextResponse.json({ categories, groups, coverage });
  } catch {
    return NextResponse.json({ categories: [], groups: [], coverage: null });
  }
}
