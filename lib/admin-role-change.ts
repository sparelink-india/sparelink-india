/**
 * Guarded admin role promotion for `scripts/set-admin-role.ts`.
 *
 * This module owns every decision the operator script makes. It is pure
 * policy plus a narrow orchestration step so the safeguards can be unit
 * tested without a database and without ever touching production.
 *
 * Rules enforced here:
 * - exactly ONE target identifier (ADMIN_EMAIL or ADMIN_USER_ID, never both)
 * - production requires an explicit fail-closed acknowledgement
 * - the target must already exist; this never creates a user
 * - the only supported resulting role is "admin"
 * - an already-admin target is a no-op
 * - the write is scoped to the single target user id
 *
 * No credential, password, hash, token, or connection string is read, returned
 * or logged by this module. Audit metadata carries identity and role facts
 * only.
 */

export const ADMIN_ROLE = "admin";

/** Must be exactly this value, and only in production, to allow promotion. */
export const ADMIN_ROLE_CHANGE_ACK_ENV = "SPARELINK_ALLOW_ADMIN_ROLE_CHANGE";
export const ADMIN_ROLE_CHANGE_ACK_VALUE = "YES";

export const ADMIN_ROLE_CHANGE_ACTION = "admin.role_change";
export const ADMIN_ROLE_CHANGE_ENTITY_TYPE = "user";

export class AdminRoleChangeError extends Error {}

export type AdminRoleChangeEnv = Record<string, string | undefined>;

export type AdminRoleChangeTarget =
  | { kind: "email"; value: string }
  | { kind: "userId"; value: string };

export type AdminRoleChangeUser = {
  id: string;
  email: string | null;
  role: string | null;
};

export type AdminRoleChangeAudit = {
  action: typeof ADMIN_ROLE_CHANGE_ACTION;
  entityType: typeof ADMIN_ROLE_CHANGE_ENTITY_TYPE;
  entityId: string;
  metadata: {
    previousRole: string | null;
    newRole: typeof ADMIN_ROLE;
    identifiedBy: AdminRoleChangeTarget["kind"];
    productionEnvironment: boolean;
  };
};

/** Narrow write port. The production adapter owns the transaction. */
export type AdminRoleChangeStore = {
  findUser(target: AdminRoleChangeTarget): Promise<AdminRoleChangeUser | null>;
  promoteToAdmin(input: {
    userId: string;
    newRole: typeof ADMIN_ROLE;
    audit: AdminRoleChangeAudit;
  }): Promise<void>;
};

export function isProductionEnvironment(env: AdminRoleChangeEnv): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.SPARELINK_ENV === "production"
  );
}

export function isProductionAcknowledged(env: AdminRoleChangeEnv): boolean {
  return (env[ADMIN_ROLE_CHANGE_ACK_ENV] ?? "").trim() === ADMIN_ROLE_CHANGE_ACK_VALUE;
}

/** Exactly one identifier, or fail closed. */
export function resolveAdminRoleChangeTarget(
  env: AdminRoleChangeEnv,
): AdminRoleChangeTarget {
  const userId = (env.ADMIN_USER_ID ?? "").trim();
  const email = (env.ADMIN_EMAIL ?? "").trim();

  if (userId && email) {
    throw new AdminRoleChangeError(
      `Set exactly one of ADMIN_USER_ID or ADMIN_EMAIL, not both. No changes were made.`,
    );
  }
  if (!userId && !email) {
    throw new AdminRoleChangeError(
      `Set exactly one of ADMIN_USER_ID or ADMIN_EMAIL for an existing account. No changes were made.`,
    );
  }

  return userId ? { kind: "userId", value: userId } : { kind: "email", value: email };
}

/** Production role changes are refused without an explicit acknowledgement. */
export function assertProductionAcknowledgement(env: AdminRoleChangeEnv): void {
  if (!isProductionEnvironment(env)) return;
  if (isProductionAcknowledged(env)) return;
  throw new AdminRoleChangeError(
    `Refusing an admin role change in a production environment. Set ${ADMIN_ROLE_CHANGE_ACK_ENV}=${ADMIN_ROLE_CHANGE_ACK_VALUE} to confirm the operator intends this change, then unset it afterwards. No changes were made.`,
  );
}

export function assertTargetExists(
  target: AdminRoleChangeTarget,
  account: AdminRoleChangeUser | null,
): AdminRoleChangeUser {
  if (!account) {
    throw new AdminRoleChangeError(
      `No existing account matched the supplied ${target.kind === "email" ? "email" : "user id"}; no changes were made. This script never creates an account.`,
    );
  }
  return account;
}

/** An already-admin target is a safe no-op. Promotion is the only outcome. */
export function planAdminRoleChange(account: {
  role: string | null;
}): { promote: boolean; previousRole: string | null; newRole: typeof ADMIN_ROLE } {
  const previousRole = account.role ?? null;
  return {
    promote: previousRole !== ADMIN_ROLE,
    previousRole,
    newRole: ADMIN_ROLE,
  };
}

export type AdminRoleChangeResult =
  | { outcome: "promoted"; userId: string; previousRole: string | null; newRole: typeof ADMIN_ROLE }
  | { outcome: "already-admin"; userId: string };

/**
 * Full guarded flow. Validates every precondition before the single scoped
 * write, so a rejected run performs no database mutation at all.
 */
export async function runAdminRoleChange(input: {
  env: AdminRoleChangeEnv;
  store: AdminRoleChangeStore;
}): Promise<AdminRoleChangeResult> {
  const { env, store } = input;

  const target = resolveAdminRoleChangeTarget(env);
  assertProductionAcknowledgement(env);

  const account = assertTargetExists(target, await store.findUser(target));
  const plan = planAdminRoleChange(account);

  if (!plan.promote) {
    return { outcome: "already-admin", userId: account.id };
  }

  await store.promoteToAdmin({
    userId: account.id,
    newRole: ADMIN_ROLE,
    audit: {
      action: ADMIN_ROLE_CHANGE_ACTION,
      entityType: ADMIN_ROLE_CHANGE_ENTITY_TYPE,
      entityId: account.id,
      metadata: {
        previousRole: plan.previousRole,
        newRole: ADMIN_ROLE,
        identifiedBy: target.kind,
        productionEnvironment: isProductionEnvironment(env),
      },
    },
  });

  return {
    outcome: "promoted",
    userId: account.id,
    previousRole: plan.previousRole,
    newRole: ADMIN_ROLE,
  };
}
