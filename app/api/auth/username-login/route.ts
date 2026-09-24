import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/auth-flags";
import { isMustChangePassword } from "@/lib/must-change-password";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = consumeRateLimit(`username-login:${ip}`, 20, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const expectedRole = typeof body?.expectedRole === "string" ? body.expectedRole : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const email = resolveLoginEmail(username);
  if (!email) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
    });

    const user = result.user as { id: string; role?: string };
    const role = user.role || "buyer";

    if (role === "suspended") {
      await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
      return NextResponse.json(
        { error: "This account is suspended." },
        { status: 403 },
      );
    }

    if (expectedRole && role !== expectedRole) {
      await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
      return NextResponse.json(
        { error: "This account cannot use this login." },
        { status: 403 },
      );
    }
    const mustChangePassword = await isMustChangePassword(user.id);

    return NextResponse.json({
      ok: true,
      role,
      mustChangePassword,
      redirectTo: mustChangePassword
        ? "/account/change-password"
        : role === "admin"
          ? "/admin"
          : role === "dealer"
            ? "/dealer"
            : "/",
    });
  } catch {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
}
