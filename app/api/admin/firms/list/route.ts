import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { firm } from "@/drizzle/schema";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const db = getDb();

  try {
    const firms = await db
      .select({
        id: firm.id,
        name: firm.name,
        code: firm.code,
      })
      .from(firm)
      .orderBy(firm.name);

    return NextResponse.json({ firms });
  } catch (error) {
    console.error("Firms list error:", error);
    return NextResponse.json(
      { error: "Failed to load firms" },
      { status: 500 },
    );
  }
}
