import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";

export type UserRole = "buyer" | "dealer" | "admin";

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;

  if (!allowedRoles.includes(role)) {
    redirect("/");
  }

  return session;
}
