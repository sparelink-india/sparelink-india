import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";

import { buildImportPreview, loadAdminOverlay, resolveSelectedProducts } from "@/lib/source-catalogue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const body = (await request.json()) as {
    scope?: "selected" | "filtered";
    keys?: string[];
    filters?: {
      status?: string;
      query?: string;
      category?: string;
      image?: string;
      firm?: string;
      issue?: string;
    };
  };

  const scope = body.scope === "filtered" ? "filtered" : "selected";
  const selected = await resolveSelectedProducts({
    scope,
    keys: body.keys,
    filters: body.filters,
  });

  const overlay = await loadAdminOverlay();
  const preview = buildImportPreview(selected, overlay);
  const previewCounts = {
    totalSelected: preview.totalSelected,
    validForImport: preview.validForImport,
    missingFirm: preview.missingFirm,
    missingPrice: preview.missingPrice,
    missingMrp: preview.missingMrp,
    missingSellingPrice: preview.missingSellingPrice,
    imageReview: preview.imageReview,
    sourceReview: preview.sourceReview,
    identityOrCategory: preview.identityOrCategory,
    databaseWrites: preview.databaseWrites,
    importDisabled: true,
  };
  return NextResponse.json({
    ...previewCounts,
    imported: false,
    note: "Preview only. Product import is disabled. No catalogue records were imported.",
  });
}
