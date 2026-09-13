import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { firm } from "@/drizzle/schema";

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
