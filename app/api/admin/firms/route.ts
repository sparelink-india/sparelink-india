import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { firm } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  const session = auth.session;

  const db = getDb();

  try {
    const firms = await db
      .select({
        id: firm.id,
        name: firm.name,
        code: firm.code,
        ledgerReference: firm.ledgerReference,
        isActive: firm.isActive,
        createdAt: firm.createdAt,
      })
      .from(firm)
      .orderBy(desc(firm.createdAt));

    return NextResponse.json({ firms });
  } catch (error) {
    console.error("Firms fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load firms" },
      { status: 500 },
    );
  }
}
