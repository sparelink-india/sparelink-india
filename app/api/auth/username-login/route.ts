import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { evaluateLoginRole, resolveLoginEmail } from "@/lib/auth-flags";
import { resolveLoginIdentifier } from "@/lib/dealer-identity";
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

  /* THE IDENTIFIER RESOLUTION ORDER, and why it is a dealer ID first.
     A dealer signs in with a permanent `DEALER…` identifier, so that is
     checked before the generic account path. The consequence that matters:
     a value that looks like a dealer ID can ONLY ever resolve to a dealer
     record, and the reserved dealer email namespace cannot be produced by the
     customer username mapping. `resolveLoginIdentifier` is a pure function and
     is tested directly in lib/dealer-identity.test.ts.

     The customer and admin path is unchanged - it is the same
     `resolveLoginEmail` call this route always made. */
  const resolution = resolveLoginIdentifier(username, resolveLoginEmail);
  if (resolution.kind === "unknown") {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const email = resolution.kind === "dealer" ? resolution.lookupEmail : resolution.email;

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
    });

    const user = result.user as { id: string; role?: string };
    /* The role is a RAW stored value, not a narrowed one. It comes from the
       session row and may be "suspended", so it is passed to the decision
       unvalidated - narrowing it to AppUserRole here would make the suspended
       branch unreachable and delete the check. */
    const role = user.role;

    /* THE ROLE GATE.
       This is the code that produced "This account cannot use this login."
       It was working correctly: the dealer surface sent expectedRole
       "dealer", an admin's role is "admin", so the check refused.

       It is kept, and its decision extracted to `evaluateLoginRole` so it can
       be tested as the security boundary it is. What is NOT done is widening
       it: no branch lets an admin through the dealer door, and none converts
       a role. The session is destroyed on every refusal, so a refused attempt
       leaves no authenticated cookie behind. */
    const decision = evaluateLoginRole(role, expectedRole);
    if (!decision.ok) {
      await auth.api.signOut({ headers: request.headers }).catch(() => undefined);
      return NextResponse.json(
        { error: decision.message },
        { status: decision.status },
      );
    }

    const mustChangePassword = await isMustChangePassword(user.id);

    /* WHERE EACH ROLE LANDS.
       A dealer identifier resolves to the dealer portal; an admin to /admin;
       anyone else to the storefront. Each role has exactly one home, so a
       session cannot end up in a surface that does not belong to it. */
    const redirectTo = mustChangePassword
      ? "/account/change-password"
      : resolution.kind === "dealer"
        ? "/dealer"
        : decision.role === "admin"
          ? "/admin"
          : decision.role === "dealer"
            ? "/dealer"
            : "/";

    return NextResponse.json({
      ok: true,
      role: decision.role,
      mustChangePassword,
      redirectTo,
    });
  } catch {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
}
