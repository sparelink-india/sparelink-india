import { NextResponse } from "next/server";

import { buildLoginOptionsPayload } from "@/lib/auth-flags";

export async function GET() {
  return NextResponse.json(buildLoginOptionsPayload());
}
