import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-role";

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
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  return blocked();
}

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;
  return blocked();
}
