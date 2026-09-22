import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-server";
import { exportAdminImportPackage, loadAdminOverlay, resolveSelectedProducts } from "@/lib/source-catalogue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    confirm?: boolean;
    confirmNoImport?: boolean;
  };

  if (!body.confirm || !body.confirmNoImport) {
    return NextResponse.json(
      {
        error: "Export requires confirmation that this will NOT import products or write to the database.",
        imported: false,
        databaseWrites: 0,
      },
      { status: 400 },
    );
  }

  const scope = body.scope === "filtered" ? "filtered" : "selected";
  const selected = await resolveSelectedProducts({
    scope,
    keys: body.keys,
    filters: body.filters,
  });
  const overlay = await loadAdminOverlay();
  const result = await exportAdminImportPackage(selected, overlay);
  const previewCounts = {
    totalSelected: result.preview.totalSelected,
    validForImport: result.preview.validForImport,
    missingFirm: result.preview.missingFirm,
    missingPrice: result.preview.missingPrice,
    missingMrp: result.preview.missingMrp,
    missingSellingPrice: result.preview.missingSellingPrice,
    imageReview: result.preview.imageReview,
    sourceReview: result.preview.sourceReview,
    identityOrCategory: result.preview.identityOrCategory,
    databaseWrites: result.preview.databaseWrites,
    importDisabled: true,
  };

  return NextResponse.json({
    ok: true,
    imported: false,
    typesenseReindex: false,
    originalFilesUntouched: true,
    ...previewCounts,
    files: result.files,
  });
}
