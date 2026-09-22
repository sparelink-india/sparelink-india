import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";

import { USERNAME_ACCOUNTS } from "../lib/auth-flags";

const BOOTSTRAP: Record<string, string> = {
  "000": "000",
  "111": "111",
  "123": "123",
};

async function main() {
  const { getDb } = await import("../lib/db");
  const { user, account, dealer } = await import("../drizzle/schema");
  const { setMustChangePassword } = await import("../lib/must-change-password");

  const db = getDb();
  const report: Array<Record<string, string | boolean | number>> = [];

  for (const username of Object.keys(USERNAME_ACCOUNTS)) {
    const spec = USERNAME_ACCOUNTS[username];
    const password = BOOTSTRAP[username];
    if (!spec || !password) throw new Error("Bootstrap map incomplete.");
    const hash = await hashPassword(password);
    const hashedOk = await verifyPassword({ hash, password });
    if (!hashedOk || hash === password) {
      throw new Error("Password hashing failed.");
    }

    const existing = await db.query.user.findFirst({
      where: eq(user.email, spec.email),
    });

    let userId = existing?.id || `user-bootstrap-${username}`;
    if (existing) {
      await db
        .update(user)
        .set({
          name: spec.name,
          role: spec.role,
          emailVerified: true,
        })
        .where(eq(user.id, existing.id));
      userId = existing.id;
    } else {
      await db.insert(user).values({
        id: userId,
        name: spec.name,
        email: spec.email,
        role: spec.role,
        emailVerified: true,
      });
    }

    const credentialAccount = (
      await db
        .select()
        .from(account)
        .where(eq(account.userId, userId))
    ).find((row) => row.providerId === "credential");

    let passwordWritten = false;
    if (credentialAccount) {
      // Never overwrite an existing credential hash (dealer 111 may already differ).
    } else {
      await db.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
      });
      passwordWritten = true;
    }

    if (!existing || passwordWritten) {
      await setMustChangePassword(userId, true);
    }

    if (spec.role === "dealer") {
      const dealerRow = await db.query.dealer.findFirst({
        where: eq(dealer.userId, userId),
      });
      if (!dealerRow) {
        await db.insert(dealer).values({
          id: `dealer-bootstrap-${username}`,
          userId,
          businessName: "SpareLink Bootstrap Dealer",
          approvalStatus: "approved",
          approvedAt: new Date(),
        });
      } else if (dealerRow.approvalStatus !== "approved") {
        await db
          .update(dealer)
          .set({ approvalStatus: "approved", approvedAt: new Date() })
          .where(eq(dealer.id, dealerRow.id));
      }
    }

    const duplicates = await db.select({ id: user.id }).from(user).where(eq(user.email, spec.email));
    const stored = (
      await db.select().from(account).where(eq(account.userId, userId))
    ).find((row) => row.providerId === "credential");
    const verifyAgain = stored?.password
      ? await verifyPassword({ hash: stored.password, password })
      : false;

    report.push({
      username,
      role: spec.role,
      unique: duplicates.length === 1,
      hashed: Boolean(stored?.password && stored.password !== password),
      passwordMatchesBootstrap: verifyAgain,
      passwordPreserved: Boolean(credentialAccount && !passwordWritten),
      mustChangePassword: !existing || passwordWritten,
      dealerApproved: spec.role !== "dealer" ? true : true,
    });
  }

  const { isMustChangePassword } = await import("../lib/must-change-password");
  const { auth } = await import("../lib/auth");

  for (const username of Object.keys(USERNAME_ACCOUNTS)) {
    const spec = USERNAME_ACCOUNTS[username];
    const password = BOOTSTRAP[username];
    if (!spec || !password) continue;
    const signedIn = await auth.api.signInEmail({
      body: { email: spec.email, password },
    });
    const sessionUser = signedIn.user as { id: string; role?: string };
    const roleOk = sessionUser.role === spec.role;
    const mustChange = await isMustChangePassword(sessionUser.id);
    const row = report.find((item) => item.username === username);
    if (row) {
      row.session = Boolean(signedIn.user);
      row.sessionRoleOk = roleOk;
      row.mustChangeVerified = mustChange;
      row.passwordInResponse = "password" in (signedIn.user as object);
    }
  }

  console.log(JSON.stringify({ bootstrap: report, googleConfigured: false, otpRequired: process.env.OTP_REQUIRED === "true" }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("BOOTSTRAP AUTH ERROR:", error instanceof Error ? error.message : "failed");
    process.exit(1);
  });
