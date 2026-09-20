import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-server";
import { FIRM_NAME_SET, loadSourceCatalogue, productKey, updateAdminOverlay } from "@/lib/source-catalogue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    keys?: string[];
    firm?: string | null;
    confirm?: boolean;
  };

  const keys = [...new Set((body.keys || []).map((key) => String(key).trim()).filter(Boolean))];
  if (keys.length === 0) {
    return NextResponse.json({ error: "Select at least one product." }, { status: 400 });
  }
  if (!body.confirm) {
    return NextResponse.json(
      { error: "Confirmation is required before assigning a firm." },
      { status: 400 },
    );
  }

  const firm = body.firm === null || body.firm === "" || body.firm === "CLEAR" ? null : String(body.firm);
  if (firm && !FIRM_NAME_SET.has(firm)) {
    return NextResponse.json({ error: "Firm must be Ambaji Traders, Hind Motors, or India Sales." }, { status: 400 });
  }

  const catalogue = await loadSourceCatalogue();
  const known = new Set(catalogue.map(productKey));
  const appliedKeys = keys.filter((key) => known.has(key));
  if (appliedKeys.length === 0) {
    return NextResponse.json({ error: "None of the selected keys exist in the source catalogue." }, { status: 400 });
  }

  await updateAdminOverlay((overlay) => {
    const next = { ...overlay, assignments: { ...overlay.assignments } };
    const now = new Date().toISOString();
    for (const key of appliedKeys) {
      const current = next.assignments[key] || { firm: null, mrp: null, sellingPrice: null, updatedAt: now };
      next.assignments[key] = { ...current, firm, updatedAt: now };
    }
    return next;
  });

  return NextResponse.json({
    ok: true,
    databaseWrites: 0,
    assigned: appliedKeys.length,
    firm: firm || "CLEAR",
    message: firm
      ? `Assigned ${appliedKeys.length} products to ${firm}.`
      : `Cleared firm assignment on ${appliedKeys.length} products.`,
  });
}
