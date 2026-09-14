import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { user } from "../drizzle/schema";

/**
 * Explicitly promote one existing account to admin.
 *
 * This script intentionally requires an operator-supplied identifier and never
 * creates an account, changes the default role, or promotes the first user.
 * Run with either ADMIN_USER_ID or ADMIN_EMAIL set in the environment.
 */
async function main() {
  const userId = process.env.ADMIN_USER_ID?.trim();
  const email = process.env.ADMIN_EMAIL?.trim();

  if ((userId && email) || (!userId && !email)) {
    throw new Error("Set exactly one of ADMIN_USER_ID or ADMIN_EMAIL for an existing account.");
  }

  const db = getDb();
  const [account] = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(userId ? eq(user.id, userId) : eq(user.email, email!))
    .limit(1);

  if (!account) {
    throw new Error("No existing account matched the supplied identifier; no changes were made.");
  }

  if (account.role === "admin") {
    console.log(`Account ${account.email} is already an admin.`);
    return;
  }

  await db.update(user).set({ role: "admin" }).where(eq(user.id, account.id));
  console.log(`Promoted existing account ${account.email} to admin.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
