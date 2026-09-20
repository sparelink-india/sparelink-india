import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-server";
import {
  loadAdminOverlay,
  loadSourceCatalogue,
  parseNonNegativeNumber,
  productKey,
  updateAdminOverlay,
} from "@/lib/source-catalogue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    keys?: string[];
    mrp?: unknown;
    sellingPrice?: unknown;
    confirm?: boolean;
    confirmOverwrite?: boolean;
    updateMrp?: boolean;
    updateSellingPrice?: boolean;
  };

  const keys = [...new Set((body.keys || []).map((key) => String(key).trim()).filter(Boolean))];
  if (keys.length === 0) {
    return NextResponse.json({ error: "Select at least one product." }, { status: 400 });
  }
  if (!body.confirm) {
    return NextResponse.json({ error: "Confirmation is required before updating prices." }, { status: 400 });
  }
  const hasMrpInput = body.updateMrp && body.mrp !== "" && body.mrp !== null && body.mrp !== undefined;
  const hasSellingInput =
    body.updateSellingPrice && body.sellingPrice !== "" && body.sellingPrice !== null && body.sellingPrice !== undefined;
  if (!hasMrpInput && !hasSellingInput) {
    return NextResponse.json(
      { error: "Enter MRP and/or Selling Price. Blank fields are left unchanged." },
      { status: 400 },
    );
  }

  const mrpParsed = parseNonNegativeNumber(body.mrp);
  const sellingParsed = parseNonNegativeNumber(body.sellingPrice);
  if (hasMrpInput && !mrpParsed.ok) {
    return NextResponse.json({ error: `MRP: ${mrpParsed.error}` }, { status: 400 });
  }
  if (hasSellingInput && !sellingParsed.ok) {
    return NextResponse.json({ error: `Selling Price: ${sellingParsed.error}` }, { status: 400 });
  }

  const nextMrp = hasMrpInput && mrpParsed.ok ? mrpParsed.value : undefined;
  const nextSelling = hasSellingInput && sellingParsed.ok ? sellingParsed.value : undefined;

  const catalogue = await loadSourceCatalogue();
  const overlay = await loadAdminOverlay();
  const known = new Set(catalogue.map(productKey));
  const appliedKeys = keys.filter((key) => known.has(key));
  if (appliedKeys.length === 0) {
    return NextResponse.json({ error: "None of the selected keys exist in the source catalogue." }, { status: 400 });
  }

  for (const key of appliedKeys) {
    const current = overlay.assignments[key];
    const mrp = nextMrp === undefined ? current?.mrp ?? null : nextMrp;
    const sellingPrice = nextSelling === undefined ? current?.sellingPrice ?? null : nextSelling;
    if (mrp != null && sellingPrice != null && sellingPrice > mrp) {
      return NextResponse.json({ error: "Selling Price must not exceed MRP." }, { status: 400 });
    }
  }

  const overwriteCount = appliedKeys.filter((key) => {
    const current = overlay.assignments[key];
    if (!current) return false;
    const mrpClash = hasMrpInput && current.mrp != null && current.mrp !== nextMrp;
    const sellingClash =
      hasSellingInput && current.sellingPrice != null && current.sellingPrice !== nextSelling;
    return Boolean(mrpClash || sellingClash);
  }).length;

  if (overwriteCount > 0 && !body.confirmOverwrite) {
    return NextResponse.json(
      {
        error: `${overwriteCount} selected products already have SpareLink prices. Confirm overwrite to continue.`,
        overwriteCount,
        requiresOverwriteConfirmation: true,
        databaseWrites: 0,
      },
      { status: 409 },
    );
  }

  await updateAdminOverlay((current) => {
    const next = { ...current, assignments: { ...current.assignments } };
    const now = new Date().toISOString();
    for (const key of appliedKeys) {
      const existing = next.assignments[key] || {
        firm: null,
        mrp: null,
        sellingPrice: null,
        updatedAt: now,
      };
      next.assignments[key] = {
        ...existing,
        mrp: nextMrp === undefined ? existing.mrp : nextMrp,
        sellingPrice: nextSelling === undefined ? existing.sellingPrice : nextSelling,
        updatedAt: now,
      };
    }
    return next;
  });

  return NextResponse.json({
    ok: true,
    databaseWrites: 0,
    updated: appliedKeys.length,
    overwritten: overwriteCount,
    message: `Updated SpareLink prices on ${appliedKeys.length} products. Source price was not copied.`,
  });
}
