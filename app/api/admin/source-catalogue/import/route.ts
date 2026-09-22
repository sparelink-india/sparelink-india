import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function blocked() {
  return NextResponse.json(
    {
      error: "Product import is disabled. Review and file export only. No database writes.",
      imported: false,
      databaseWrites: 0,
      typesenseReindex: false,
    },
    { status: 403 },
  );
}

export async function GET() {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return blocked();
}

export async function POST() {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return blocked();
}
