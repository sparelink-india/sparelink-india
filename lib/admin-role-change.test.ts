import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_ROLE,
  ADMIN_ROLE_CHANGE_ACK_ENV,
  ADMIN_ROLE_CHANGE_ACTION,
  AdminRoleChangeError,
  planAdminRoleChange,
  resolveAdminRoleChangeTarget,
  runAdminRoleChange,
  type AdminRoleChangeAudit,
  type AdminRoleChangeStore,
  type AdminRoleChangeUser,
} from "./admin-role-change";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

/**
 * In-memory stand-in for the user table. Only `role` is ever writable, so a
 * test that passes proves the script cannot reach email, password or account
 * state even in principle.
 */
function createFakeStore(seed: AdminRoleChangeUser[]) {
  const rows = new Map(seed.map((row) => [row.id, { ...row }]));
  const audits: AdminRoleChangeAudit[] = [];
  const promotions: string[] = [];

  const store: AdminRoleChangeStore = {
    async findUser(target) {
      for (const row of rows.values()) {
        if (target.kind === "email" && row.email === target.value) return { ...row };
        if (target.kind === "userId" && row.id === target.value) return { ...row };
      }
      return null;
    },
    async promoteToAdmin({ userId, newRole, audit }) {
      const row = rows.get(userId);
      if (!row) throw new Error("unknown user");
      if (row.role === newRole) return;
      row.role = newRole;
      promotions.push(userId);
      audits.push(audit);
    },
  };

  return {
    store,
    audits,
    promotions,
    rows,
    roleOf(id: string) {
      return rows.get(id)?.role ?? null;
    },
  };
}

const buyer: AdminRoleChangeUser = {
  id: "user-buyer-1",
  email: "owner@example.invalid",
  role: "buyer",
};
const otherBuyer: AdminRoleChangeUser = {
  id: "user-buyer-2",
  email: "other@example.invalid",
  role: "buyer",
};
const existingAdmin: AdminRoleChangeUser = {
  id: "user-admin",
  email: "admin@sparelink.local",
  role: "admin",
};

const productionEnv = { [ADMIN_ROLE_CHANGE_ACK_ENV]: "YES" };

describe("admin role change target validation", () => {
  it("1. no target identifier fails closed", () => {
    assert.throws(
      () => resolveAdminRoleChangeTarget({}),
      (error: unknown) =>
        error instanceof AdminRoleChangeError && /exactly one of ADMIN_USER_ID or ADMIN_EMAIL/.test(error.message),
    );
  });

  it("2. both target identifiers fails closed", () => {
    assert.throws(
      () =>
        resolveAdminRoleChangeTarget({
          ADMIN_USER_ID: "user-buyer-1",
          ADMIN_EMAIL: "owner@example.invalid",
        }),
      (error: unknown) =>
        error instanceof AdminRoleChangeError && /not both/.test(error.message),
    );
  });

  it("accepts exactly one identifier, by email or by user id", () => {
    assert.deepEqual(resolveAdminRoleChangeTarget({ ADMIN_EMAIL: " owner@example.invalid " }), {
      kind: "email",
      value: "owner@example.invalid",
    });
    assert.deepEqual(resolveAdminRoleChangeTarget({ ADMIN_USER_ID: "user-buyer-1" }), {
      kind: "userId",
      value: "user-buyer-1",
    });
  });

  it("3. target not found fails closed and performs no write", async () => {
    const fake = createFakeStore([buyer]);
    await assert.rejects(
      runAdminRoleChange({
        env: { ADMIN_EMAIL: "missing@example.invalid" },
        store: fake.store,
      }),
      (error: unknown) =>
        error instanceof AdminRoleChangeError && /never creates an account/.test(error.message),
    );
    assert.deepEqual(fake.promotions, []);
    assert.deepEqual(fake.audits, []);
    assert.equal(fake.roleOf(buyer.id), "buyer");
  });
});

describe("admin role change production guard", () => {
  it("4. production without acknowledgement fails closed", async () => {
    const fake = createFakeStore([buyer]);
    await assert.rejects(
      runAdminRoleChange({
        env: { ADMIN_EMAIL: buyer.email ?? "", NODE_ENV: "production" },
        store: fake.store,
      }),
      (error: unknown) =>
        error instanceof AdminRoleChangeError &&
        new RegExp(ADMIN_ROLE_CHANGE_ACK_ENV).test(error.message),
    );
    assert.deepEqual(fake.promotions, []);
    assert.equal(fake.roleOf(buyer.id), "buyer");
  });

  it("5. production with a wrong acknowledgement fails closed", async () => {
    for (const value of ["yes", "true", "1", "ALLOWED", "", "Y E S"]) {
      const fake = createFakeStore([buyer]);
      await assert.rejects(
        runAdminRoleChange({
          env: {
            ADMIN_EMAIL: buyer.email ?? "",
            NODE_ENV: "production",
            [ADMIN_ROLE_CHANGE_ACK_ENV]: value,
          },
          store: fake.store,
        }),
        (error: unknown) =>
          error instanceof AdminRoleChangeError &&
          new RegExp(ADMIN_ROLE_CHANGE_ACK_ENV).test(error.message),
        `acknowledgement ${JSON.stringify(value)} must not be accepted`,
      );
      assert.deepEqual(fake.promotions, []);
    }
  });

  it("production is recognised from NODE_ENV, VERCEL_ENV and SPARELINK_ENV", async () => {
    for (const key of ["NODE_ENV", "VERCEL_ENV", "SPARELINK_ENV"]) {
      const fake = createFakeStore([buyer]);
      await assert.rejects(
        runAdminRoleChange({
          env: { ADMIN_EMAIL: buyer.email ?? "", [key]: "production" },
          store: fake.store,
        }),
        AdminRoleChangeError,
        `${key}=production must be fail closed`,
      );
      assert.deepEqual(fake.promotions, []);
    }
  });

  it("tolerates surrounding whitespace in the acknowledgement, like the rest of the repo", async () => {
    const fake = createFakeStore([buyer]);
    const result = await runAdminRoleChange({
      env: {
        ADMIN_EMAIL: buyer.email ?? "",
        NODE_ENV: "production",
        [ADMIN_ROLE_CHANGE_ACK_ENV]: "  YES  ",
      },
      store: fake.store,
    });
    assert.equal(result.outcome, "promoted");
  });

  it("6. valid non-production operation is allowed without acknowledgement", async () => {
    const fake = createFakeStore([buyer]);
    const result = await runAdminRoleChange({
      env: { ADMIN_EMAIL: buyer.email ?? "" },
      store: fake.store,
    });
    assert.equal(result.outcome, "promoted");
    assert.equal(fake.roleOf(buyer.id), "admin");
  });

  it("valid production operation is allowed only with the exact acknowledgement", async () => {
    const fake = createFakeStore([buyer]);
    const result = await runAdminRoleChange({
      env: { ADMIN_EMAIL: buyer.email ?? "", NODE_ENV: "production", ...productionEnv },
      store: fake.store,
    });
    assert.equal(result.outcome, "promoted");
    assert.equal(fake.roleOf(buyer.id), "admin");
  });
});

describe("admin role change outcomes", () => {
  it("7. an already-admin target is a no-op", async () => {
    const fake = createFakeStore([existingAdmin]);
    const result = await runAdminRoleChange({
      env: { ADMIN_EMAIL: existingAdmin.email ?? "", ...productionEnv, NODE_ENV: "production" },
      store: fake.store,
    });
    assert.equal(result.outcome, "already-admin");
    assert.deepEqual(fake.promotions, []);
    assert.deepEqual(fake.audits, []);
    assert.equal(fake.roleOf(existingAdmin.id), "admin");
  });

  it("8. a non-admin target is promoted to exactly admin", async () => {
    for (const role of ["buyer", "dealer", "suspended", null]) {
      const fake = createFakeStore([{ ...buyer, role }]);
      const result = await runAdminRoleChange({
        env: { ADMIN_USER_ID: buyer.id },
        store: fake.store,
      });
      assert.equal(result.outcome, "promoted");
      assert.equal(result.previousRole, role);
      assert.equal(result.newRole, ADMIN_ROLE);
      assert.equal(fake.roleOf(buyer.id), "admin");
    }
  });

  it("only admin is ever written as the resulting role", () => {
    assert.equal(planAdminRoleChange({ role: "dealer" }).newRole, ADMIN_ROLE);
    assert.equal(planAdminRoleChange({ role: "dealer" }).promote, true);
    assert.equal(planAdminRoleChange({ role: "admin" }).promote, false);
  });
});

describe("admin role change audit logging", () => {
  it("9. a promotion writes an admin.role_change audit record", async () => {
    const fake = createFakeStore([buyer]);
    await runAdminRoleChange({ env: { ADMIN_USER_ID: buyer.id }, store: fake.store });

    assert.equal(fake.audits.length, 1);
    const audit = fake.audits[0];
    assert.equal(audit.action, ADMIN_ROLE_CHANGE_ACTION);
    assert.equal(audit.entityType, "user");
    assert.equal(audit.entityId, buyer.id);
    assert.equal(audit.metadata.previousRole, "buyer");
    assert.equal(audit.metadata.newRole, "admin");
    assert.equal(audit.metadata.identifiedBy, "userId");
    assert.equal(audit.metadata.productionEnvironment, false);
  });

  it("the audit record never carries credentials or secrets", async () => {
    const fake = createFakeStore([buyer]);
    await runAdminRoleChange({ env: { ADMIN_EMAIL: buyer.email ?? "" }, store: fake.store });

    const serialised = JSON.stringify(fake.audits[0]).toLowerCase();
    for (const forbidden of [
      "password",
      "hash",
      "secret",
      "token",
      "cookie",
      "credential",
      "database_url",
      "authorization",
    ]) {
      assert.equal(serialised.includes(forbidden), false, `audit record must not contain ${forbidden}`);
    }
  });

  it("no audit record is written for a rejected or no-op run", async () => {
    const rejected = createFakeStore([buyer]);
    await assert.rejects(
      runAdminRoleChange({ env: { NODE_ENV: "production", ADMIN_USER_ID: buyer.id }, store: rejected.store }),
      AdminRoleChangeError,
    );
    assert.deepEqual(rejected.audits, []);

    const noop = createFakeStore([existingAdmin]);
    await runAdminRoleChange({ env: { ADMIN_USER_ID: existingAdmin.id }, store: noop.store });
    assert.deepEqual(noop.audits, []);
  });
});

describe("admin role change blast radius", () => {
  it("10. password and account state are not part of the change surface", () => {
    const script = source("scripts/set-admin-role.ts");
    const change = source("lib/admin-role-change.ts");

    for (const text of [script, change]) {
      // The credential `account` table and the user password column are never
      // read or written by either file.
      assert.equal(/from\(account\)/.test(text), false, "must not read the credential account table");
      assert.equal(/insert\(account\)|update\(account\)/.test(text), false, "must not write the credential account table");
      assert.equal(/user\.password|accountId|providerId/.test(text), false, "must not touch credential state");
    }

    // The only user column the script projects is identity plus role.
    assert.match(
      script,
      /\.select\(\{ id: user\.id, email: user\.email, role: user\.role \}\)/,
    );
    // The only user column the script writes is `role`.
    const writes = script.match(/\.set\(\{[^}]*\}\)/g) ?? [];
    assert.deepEqual(writes, [".set({ role: newRole })"]);
  });

  it("11. only the intended user is affected", async () => {
    const fake = createFakeStore([buyer, otherBuyer, existingAdmin]);
    await runAdminRoleChange({ env: { ADMIN_EMAIL: buyer.email ?? "" }, store: fake.store });

    assert.deepEqual(fake.promotions, [buyer.id]);
    assert.equal(fake.roleOf(buyer.id), "admin");
    assert.equal(fake.roleOf(otherBuyer.id), "buyer");
    assert.equal(fake.roleOf(existingAdmin.id), "admin");
    assert.equal(fake.audits.length, 1);
    assert.equal(fake.audits[0].entityId, buyer.id);
  });
});

describe("admin role script wiring", () => {
  it("writes the role update and the audit row in one transaction", () => {
    const script = source("scripts/set-admin-role.ts");
    assert.match(script, /db\.transaction\(async \(tx\)/);
    assert.match(script, /tx\.insert\(auditLog\)/);
    assert.match(script, /ne\(user\.role, ADMIN_ROLE\)/);
  });

  it("scopes the update to a single user id", () => {
    const script = source("scripts/set-admin-role.ts");
    assert.match(script, /where\(and\(eq\(user\.id, userId\), ne\(user\.role, ADMIN_ROLE\)\)\)/);
  });

  it("never creates a user and never prints the connection string", () => {
    const script = source("scripts/set-admin-role.ts");
    assert.equal(/insert\(user\)/.test(script), false);
    assert.equal(/DATABASE_URL/.test(script), false);
    assert.equal(/BETTER_AUTH_SECRET/.test(script), false);
  });
});
