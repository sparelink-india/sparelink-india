import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { user } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const users = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 },
    );
  }
}
