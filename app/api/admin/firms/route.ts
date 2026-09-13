import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { firm } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
