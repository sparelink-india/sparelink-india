import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import {
  filterCatalogue,
  loadAdminOverlay,
  loadSourceCatalogue,
  overlaySummary,
  productKey,
  toListItem,
} from "@/lib/source-catalogue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin.error) return admin.error;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") || 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 50) || 50));
  const keysOnly = params.get("keysOnly") === "1";
  const filters = {
    status: String(params.get("status") || "ALL"),
    query: String(params.get("q") || ""),
    category: String(params.get("category") || ""),
    image: String(params.get("image") || "all"),
    firm: String(params.get("firm") || "all"),
    issue: String(params.get("issue") || "ALL"),
  };

  try {
    const products = await loadSourceCatalogue();
    const overlay = await loadAdminOverlay();
    const categories = [...new Set(products.map((item) => item.categoryName).filter(Boolean))] as string[];
    categories.sort((a, b) => a.localeCompare(b));

    const filtered = filterCatalogue(products, overlay, filters);
    const summary = overlaySummary(overlay, products);

    if (keysOnly) {
      return NextResponse.json({
        totalFiltered: filtered.length,
        keys: filtered.map((item) => productKey(item)).filter(Boolean),
        selectionNote: `All ${filtered.length} currently filtered records, including those not on this page.`,
        databaseWrites: 0,
      });
    }

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((item) => toListItem(item, overlay));

    return NextResponse.json({
      extractedAt: overlay.updatedAt,
      source: "https://onlineautohandles.com/b2b",
      counts: {
        READY: products.filter((item) => item.validationStatus === "READY").length,
        REVIEW: products.filter((item) => item.validationStatus === "REVIEW").length,
        DUPLICATE: products.filter((item) => item.validationStatus === "DUPLICATE").length,
        CONFLICT: products.filter((item) => item.validationStatus === "CONFLICT").length,
        TOTAL: products.length,
      },
      overlay: summary,
      firmAssignment: "Explicit admin action required. No automatic assignment.",
      pricing: {
        note: "Selling price is prepared from the source API Rate (items[].price) when that rate is explicit and greater than 0. MRP stays blank unless the source supplies MRP. previousPrice is not MRP.",
      },
      importStatus: "NOT IMPORTED",
      importDisabled: true,
      databaseWrites: 0,
      page,
      pageSize,
      totalFiltered: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      categories,
      items,
    });
  } catch {
    return NextResponse.json(
      { error: "Source catalogue files are not available." },
      { status: 404 },
    );
  }
}
