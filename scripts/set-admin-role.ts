import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { and, eq, ne } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

import { getDb } from "../lib/db";
import { user, auditLog } from "../drizzle/schema";
import {
  ADMIN_ROLE,
  runAdminRoleChange,
  type AdminRoleChangeAudit,
  type AdminRoleChangeStore,
  type AdminRoleChangeTarget,
  type AdminRoleChangeUser,
} from "../lib/admin-role-change";

/**
 * Explicitly promote one existing account to admin.
 *
 * This script intentionally requires an operator-supplied identifier and never
 * creates an account, changes the default role, or promotes the first user.
 * Run with either ADMIN_USER_ID or ADMIN_EMAIL set in the environment.
 *
 * Production is fail closed: a production environment additionally requires
 * SPARELINK_ALLOW_ADMIN_ROLE_CHANGE=YES. Every successful promotion writes an
 * `admin.role_change` audit_log row in the same transaction as the role
 * update, so the change and its audit record commit or roll back together.
 */

function createStore(): AdminRoleChangeStore {
  const db = getDb();

  return {
    async findUser(target: AdminRoleChangeTarget): Promise<AdminRoleChangeUser | null> {
      const [account] = await db
        .select({ id: user.id, email: user.email, role: user.role })
        .from(user)
        .where(target.kind === "email" ? eq(user.email, target.value) : eq(user.id, target.value))
        .limit(1);
      return account ?? null;
    },

    async promoteToAdmin({ userId, newRole, audit }): Promise<void> {
      await db.transaction(async (tx) => {
        // Narrowly scoped: this user id only, and never re-promote a row that
        // is already admin, so a concurrent run cannot double-apply.
        const promoted = await tx
          .update(user)
          .set({ role: newRole })
          .where(and(eq(user.id, userId), ne(user.role, ADMIN_ROLE)))
          .returning({ id: user.id });

        if (!promoted.length) return;

        await tx.insert(auditLog).values(auditRow(audit));
      });
    },
  };
}

function auditRow(audit: AdminRoleChangeAudit) {
  return {
    id: randomUUID(),
    // No authenticated operator session exists for a CLI run, so the actor is
    // left null; the operator context is carried in metadata instead.
    actorUserId: null,
    action: audit.action,
    entityType: audit.entityType,
    entityId: audit.entityId,
    metadata: JSON.stringify(audit.metadata),
  };
}

async function main() {
  const store = createStore();
  const result = await runAdminRoleChange({ env: process.env, store });

  if (result.outcome === "already-admin") {
    console.log("That account is already an admin. No changes were made.");
    return;
  }

  console.log(
    `Promoted one existing account to admin (${result.previousRole ?? "no role"} -> ${result.newRole}).`,
  );
  console.log(
    "An admin.role_change audit_log entry was written in the same transaction.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
