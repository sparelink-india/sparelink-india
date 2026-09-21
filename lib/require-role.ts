import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-server";
import { isMustChangePassword } from "@/lib/must-change-password";

export type UserRole = "buyer" | "dealer" | "admin";

export function passwordChangeRequiredResponse() {
  return NextResponse.json(
    {
      error: "Password change required.",
      redirectTo: "/account/change-password",
    },
    { status: 403 },
  );
}

export async function denyIfMustChangePassword(userId: string) {
  if (await isMustChangePassword(userId)) {
    return passwordChangeRequiredResponse();
  }
  return null;
}

export async function requirePasswordReadyPage() {
  const session = await getServerSession();
  if (session?.user && (await isMustChangePassword(session.user.id))) {
    redirect("/account/change-password");
  }
}

export async function requireAdminApi() {
  const session = await getServerSession();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return { error: blocked };
  return { session };
}

export async function requireDealerApi() {
  const session = await getServerSession();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "dealer") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return { error: blocked };
  return { session };
}

/** Admin or dealer API access (B2B product search, etc.). */
export async function requireAdminOrDealerApi() {
  const session = await getServerSession();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const role = session.user.role as UserRole;
  if (role !== "admin" && role !== "dealer") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return { error: blocked };
  return { session };
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;

  if (!allowedRoles.includes(role)) {
    redirect("/");
  }

  if (await isMustChangePassword(session.user.id)) {
    redirect("/account/change-password");
  }

  return session;
}
