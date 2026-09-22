import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-server";
import { isMustChangePassword } from "@/lib/must-change-password";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ authenticated: false, mustChangePassword: false, role: null });
  }

  return NextResponse.json({
    authenticated: true,
    mustChangePassword: await isMustChangePassword(session.user.id),
    role: session.user.role ?? "buyer",
  });
}
